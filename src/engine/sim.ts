/**
 * Quiz Duel — 500-Battle Random-Bot Simulation & Invariant Verifier
 * Verifies:
 *  - 0 <= currentHealth <= maxHealth
 *  - 0 <= mana <= 5
 *  - No negative status stacks except strength
 *  - No stuck turns (every battle terminates cleanly with a winner)
 *  - Deterministic action-log replay reproduces the exact final GameState
 */

import {replayActionLog} from './action-manager'
import type {GameState, QuizAnswerOutcome} from './actions'
import {canPlay, canThrowSelection} from './conditions'
import {CHARACTER_IDS, CHARACTERS} from './config'
import createNewGame from './game'
import {nextSeededRandom} from './utils'

export interface SimulationStats {
	matchesCompleted: number
	replaysVerified: number
	totalTurns: number
	totalRounds: number
	totalCardsThrown: number
	winsByPlayer: [number, number]
	winsByCharacter: Record<string, number>
	gamesByCharacter: Record<string, number>
	pairwiseWins: Record<string, Record<string, {wins: number; total: number}>>
	maxRoundReached: number
}

const NON_MIRROR_PAIRS: Array<[(typeof CHARACTER_IDS)[number], (typeof CHARACTER_IDS)[number]]> = []
for (const c0 of CHARACTER_IDS) {
	for (const c1 of CHARACTER_IDS) {
		if (c0 !== c1) {
			NON_MIRROR_PAIRS.push([c0, c1])
		}
	}
}

/**
 * Verifies all engine invariants on the given GameState.
 * Throws a descriptive Error if any invariant is violated.
 */
export function assertGameStateInvariants(state: GameState, context = ''): void {
	for (const idx of [0, 1] as const) {
		const p = state.players[idx]
		if (!Number.isFinite(p.currentHealth) || !Number.isFinite(p.maxHealth)) {
			throw new Error(`[${context}] Player ${idx} has non-finite HP: ${p.currentHealth}/${p.maxHealth}`)
		}
		if (p.currentHealth < 0 || p.currentHealth > p.maxHealth) {
			throw new Error(`[${context}] Player ${idx} HP out of bounds: ${p.currentHealth} (max ${p.maxHealth})`)
		}
		if (!Number.isFinite(p.mana) || p.mana < 0 || p.mana > 5) {
			throw new Error(`[${context}] Player ${idx} mana out of bounds [0, 5]: ${p.mana}`)
		}
		if (!Number.isFinite(p.block) || p.block < 0) {
			throw new Error(`[${context}] Player ${idx} block is negative or NaN: ${p.block}`)
		}
		if (p.hand.length > 7) {
			throw new Error(`[${context}] Player ${idx} exceeded max hand size 7: ${p.hand.length}`)
		}

		for (const [powerKey, val] of Object.entries(p.powers)) {
			if (val === undefined) continue
			if (!Number.isFinite(val)) {
				throw new Error(`[${context}] Player ${idx} power '${powerKey}' is non-finite: ${val}`)
			}
			if (powerKey !== 'strength' && val < 0) {
				throw new Error(`[${context}] Player ${idx} has negative stack on non-strength power '${powerKey}': ${val}`)
			}
		}
	}
}

/**
 * Runs a single deterministic random-bot match and verifies all state invariants + log replay.
 */
export function runSingleBotBattle(
	matchSeed: number,
	verifyReplay = true,
	customPair?: [(typeof CHARACTER_IDS)[number], (typeof CHARACTER_IDS)[number]],
): {
	finalState: GameState
	cardsThrown: number
} {
	const defaultPair = NON_MIRROR_PAIRS[matchSeed % NON_MIRROR_PAIRS.length] ?? ['dark-ninja', 'knight']
	const [char0, char1] = customPair ?? defaultPair

	const game = createNewGame({
		player0Character: char0,
		player1Character: char1,
		seed: matchSeed,
	})

	const initialStateSnapshot: GameState = JSON.parse(JSON.stringify(game.state))
	assertGameStateInvariants(game.state, `seed=${matchSeed}:init`)

	let botRngCounter = 1
	let steps = 0
	let cardsThrown = 0
	const maxSteps = 2000

	while (game.state.status !== 'finished') {
		steps += 1
		if (steps > maxSteps) {
			throw new Error(
				`Stuck battle detected on seed=${matchSeed} at round=${game.state.round}, turn=${game.state.turn}`,
			)
		}

		if (game.state.status === 'quizzing') {
			const r = nextSeededRandom(matchSeed ^ 0xabcdef, botRngCounter)
			botRngCounter = r.nextCounter
			const answer: QuizAnswerOutcome = r.value < 0.45 ? 'correct' : 'wrong'
			game.run({type: 'resolveQuizAnswer', answer})
			assertGameStateInvariants(game.state, `seed=${matchSeed}:resolveQuiz:${steps}`)
			continue
		}

		// status === 'playing'
		const activeIdx = game.state.activePlayer
		const activePlayer = game.state.players[activeIdx]

		// Order playable cards sensibly (powers & attacks/blocks before redundant heals/cures, Block before Body Slam)
		const allPlayable = activePlayer.hand.filter((c) => canPlay(game.state, c, activeIdx))
		const hasToxicDebuff = (activePlayer.powers.poison || 0) > 0 || (activePlayer.powers.parasite || 0) > 0
		const hasAnyDebuff = Object.keys(activePlayer.powers).some((k) =>
			['poison', 'parasite', 'weak', 'vulnerable', 'corrode', 'antiHeal'].includes(k),
		)
		const isHighHp = activePlayer.currentHealth >= activePlayer.maxHealth - 5

		const scoreCard = (c: (typeof allPlayable)[number]): number => {
			if (c.id === 'P5' && activePlayer.block < 5) return -10 // Body Slam with low block
			if (c.id === 'B5') return hasToxicDebuff ? 25 : -20 // Antidote only when poisoned/parasited
			const isPureCure = c.effects.every((e) => e.type === 'cure')
			if (isPureCure) return hasAnyDebuff ? 22 : -20
			const isPureHeal = c.effects.every((e) => e.type === 'heal' || e.type === 'nextTurnHeal')
			if (isPureHeal) return isHighHp ? -15 : 18
			if (c.power) return 20 + c.cost
			if (c.subject === CHARACTERS[activePlayer.characterId].affinity) return 10 + c.cost
			return c.cost
		}

		const playableCards = [...allPlayable].sort((a, b) => scoreCard(b) - scoreCard(a))

		if (playableCards.length === 0) {
			game.run({type: 'skipTurn'})
			assertGameStateInvariants(game.state, `seed=${matchSeed}:skipTurn:${steps}`)
			continue
		}

		// Pick up to 2 cards that can be thrown together within current mana
		const selectedIds: string[] = []
		let remainingMana = activePlayer.mana

		for (const candidate of playableCards) {
			if (candidate.cost <= remainingMana) {
				const nextSelection = [...selectedIds, candidate.instanceId]
				if (canThrowSelection(game.state, nextSelection, activeIdx)) {
					selectedIds.push(candidate.instanceId)
					remainingMana -= candidate.cost
				}
			}
			if (selectedIds.length >= 2) break
		}

		if (selectedIds.length > 0) {
			cardsThrown += selectedIds.length
			game.run({type: 'throwCards', playerIndex: activeIdx, cardInstanceIds: selectedIds})
			assertGameStateInvariants(game.state, `seed=${matchSeed}:throwCards:${steps}`)

			// Resolve all pending quiz questions for this throw
			while ((game.state.status as GameState['status']) === 'quizzing') {
				const r = nextSeededRandom(matchSeed ^ 0xabcdef, botRngCounter)
				botRngCounter = r.nextCounter
				const answer: QuizAnswerOutcome = r.value < 0.45 ? 'correct' : 'wrong'
				game.run({type: 'resolveQuizAnswer', answer})
				assertGameStateInvariants(game.state, `seed=${matchSeed}:resolveQuizLoop:${steps}`)
			}

			// After resolving throw, end turn if still playing
			if (game.state.status === 'playing') {
				game.run({type: 'endTurn'})
				assertGameStateInvariants(game.state, `seed=${matchSeed}:endTurn:${steps}`)
			}
		} else {
			game.run({type: 'skipTurn'})
			assertGameStateInvariants(game.state, `seed=${matchSeed}:skipTurnFallback:${steps}`)
		}
	}

	if (game.state.winner !== 0 && game.state.winner !== 1) {
		throw new Error(`Finished battle on seed=${matchSeed} has no winner`)
	}

	if (verifyReplay) {
		const actionLog = game.getActionLog()
		const replayed = replayActionLog(initialStateSnapshot, actionLog)
		if (JSON.stringify(replayed) !== JSON.stringify(game.state)) {
			throw new Error(`Action log replay mismatch on seed=${matchSeed}`)
		}
	}

	return {
		finalState: game.state,
		cardsThrown,
	}
}

/**
 * Runs `numMatches` random-bot battles (default 500) and returns aggregate statistics.
 */
export function runSimulation(numMatches = 500, verifyReplay = true): SimulationStats {
	const pairwiseWins: Record<string, Record<string, {wins: number; total: number}>> = {}
	for (const c0 of CHARACTER_IDS) {
		pairwiseWins[c0] = {}
		for (const c1 of CHARACTER_IDS) {
			pairwiseWins[c0][c1] = {wins: 0, total: 0}
		}
	}

	const stats: SimulationStats = {
		matchesCompleted: 0,
		replaysVerified: 0,
		totalTurns: 0,
		totalRounds: 0,
		totalCardsThrown: 0,
		winsByPlayer: [0, 0],
		winsByCharacter: {
			'dark-ninja': 0,
			reaper: 0,
			samurai: 0,
			knight: 0,
		},
		gamesByCharacter: {
			'dark-ninja': 0,
			reaper: 0,
			samurai: 0,
			knight: 0,
		},
		pairwiseWins,
		maxRoundReached: 0,
	}

	for (let i = 0; i < numMatches; i++) {
		const pair = NON_MIRROR_PAIRS[i % NON_MIRROR_PAIRS.length] ?? ['dark-ninja', 'knight']
		const seed = 10000 + (i + 1) * 31
		const {finalState, cardsThrown} = runSingleBotBattle(seed, verifyReplay, pair)
		stats.matchesCompleted += 1
		if (verifyReplay) stats.replaysVerified += 1
		stats.totalTurns += finalState.turn
		stats.totalRounds += finalState.round
		stats.totalCardsThrown += cardsThrown
		if (finalState.round > stats.maxRoundReached) {
			stats.maxRoundReached = finalState.round
		}

		const c0 = finalState.players[0].characterId
		const c1 = finalState.players[1].characterId
		stats.gamesByCharacter[c0] = (stats.gamesByCharacter[c0] || 0) + 1
		stats.gamesByCharacter[c1] = (stats.gamesByCharacter[c1] || 0) + 1

		const cell01 = stats.pairwiseWins[c0]?.[c1]
		const cell10 = stats.pairwiseWins[c1]?.[c0]
		if (cell01) cell01.total += 1
		if (cell10) cell10.total += 1

		if (finalState.winner === 0 || finalState.winner === 1) {
			stats.winsByPlayer[finalState.winner] += 1
			const winChar = finalState.players[finalState.winner].characterId
			stats.winsByCharacter[winChar] = (stats.winsByCharacter[winChar] || 0) + 1
			if (finalState.winner === 0 && cell01) {
				cell01.wins += 1
			} else if (finalState.winner === 1 && cell10) {
				cell10.wins += 1
			}
		}
	}

	return stats
}

const nodeProcess = (globalThis as {process?: {argv?: string[]}}).process
const argv1 = nodeProcess?.argv?.[1]?.replace(/\\/g, '/') ?? ''
const isMainModule = Boolean(argv1 && import.meta.url.endsWith(argv1))

if (isMainModule) {
	const countArg = Number(nodeProcess?.argv?.[2]) || 500
	const startTime = Date.now()
	const stats = runSimulation(countArg)
	const elapsedMs = Date.now() - startTime
	console.log(
		`[sim] Completed ${stats.matchesCompleted} bot battles (${stats.replaysVerified} action logs replayed & verified) in ${elapsedMs}ms`,
	)
	console.log(
		`[sim] Avg rounds: ${(stats.totalRounds / stats.matchesCompleted).toFixed(1)}, Max round: ${stats.maxRoundReached}, Total cards thrown: ${stats.totalCardsThrown}`,
	)
	console.log(`[sim] Wins by slot: P0=${stats.winsByPlayer[0]}, P1=${stats.winsByPlayer[1]}`)
	console.log('[sim] Wins by character:', stats.winsByCharacter)
	for (const c0 of CHARACTER_IDS) {
		const row = CHARACTER_IDS.map((c1) => {
			if (c0 === c1) return '  —  '
			const cell = stats.pairwiseWins[c0]?.[c1]
			if (!cell || cell.total === 0) return ' N/A '
			return `${Math.round((cell.wins / cell.total) * 100)}% (${cell.wins}/${cell.total})`
		}).join(' | ')
		console.log(`[sim] ${c0.padEnd(11)}: ${row}`)
	}
}
