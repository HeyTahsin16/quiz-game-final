/**
 * Quiz Duel — Pure State Machine & Combat Actions (2-Player Symmetric + Quiz Pipeline)
 * Derived from oskarrough/slaytheweb (src/game/actions.js)
 * License: AGPL-3.0-or-later (port-with-attribution)
 */

import {produce} from 'immer'
import {buildCharacterDeck} from '../content/decks'
import {bindQuestionsToMatchDecks} from '../content/questions'
import {type CardEffect, type CardInstance, createCard, upgradeCardInstance} from './cards'
import {canPlay, canThrowSelection} from './conditions'
import {CHARACTERS, type CharacterId, ENGINE_CONFIG, type Subject} from './config'
import {DEBUFF_KEYS, type PlayerPowers, POWER_DEFINITIONS} from './powers'
import {clamp, createDeterministicId, seededRandomInt, seededShuffle} from './utils'

export type PlayerIndex = 0 | 1
export type QuizAnswerOutcome = 'correct' | 'wrong' | 'timeout'
export type CardQuizResolution = 'nullified' | 'reduced' | 'full'

export interface PlayerState {
	id: PlayerIndex
	name: string
	characterId: CharacterId
	maxHealth: number
	currentHealth: number
	mana: number
	maxMana: number
	block: number
	powers: PlayerPowers
	deck: CardInstance[]
	drawPile: CardInstance[]
	hand: CardInstance[]
	discardPile: CardInstance[]
	exhaustPile: CardInstance[]
	phoenixUsed: boolean
}

export interface ThrownCardEntry {
	card: CardInstance
	casterIndex: PlayerIndex
	defenderIndex: PlayerIndex
	questionId?: string
}

export interface QuizResolutionSummary {
	cardId: string
	cardName: string
	cardSubject: Subject
	cardRarity: CardInstance['rarity']
	casterIndex: PlayerIndex
	defenderIndex: PlayerIndex
	answer: QuizAnswerOutcome
	resolution: CardQuizResolution
	questionId?: string
	boundChoices?: [string, string, string, string]
	boundCorrectIndex?: 0 | 1 | 2 | 3
	selectedChoice?: number | null
}

export type GameAction =
	| {
			type: 'initMatch'
			player0Character?: CharacterId
			player1Character?: CharacterId
			seed?: number
	  }
	| {type: 'startTurn'}
	| {type: 'drawCards'; playerIndex?: PlayerIndex; amount?: number; respectHandSizeCap?: boolean}
	| {type: 'throwCards'; playerIndex?: PlayerIndex; cardInstanceIds: string[]}
	| {type: 'resolveQuizAnswer'; answer: QuizAnswerOutcome; selectedChoice?: number | null}
	| {
			type: 'playCard'
			playerIndex?: PlayerIndex
			card: CardInstance
			answer?: QuizAnswerOutcome
	  }
	| {type: 'endTurn'}
	| {type: 'skipTurn'}
	| {type: 'forfeit'; playerIndex: PlayerIndex}
	| {type: 'addCardToHand'; playerIndex?: PlayerIndex; card: CardInstance}
	| {type: 'addCardToDeck'; playerIndex?: PlayerIndex; card: CardInstance}
	| {type: 'discardCard'; playerIndex?: PlayerIndex; card: CardInstance}
	| {type: 'discardHand'; playerIndex?: PlayerIndex}
	| {type: 'upgradeCard'; playerIndex?: PlayerIndex; card: CardInstance}
	| {type: 'addHealth'; playerIndex?: PlayerIndex; amount: number; ignoreAntiHeal?: boolean}
	| {type: 'removeHealth'; playerIndex?: PlayerIndex; amount: number; ignoreApparition?: boolean}
	| {type: 'setHealth'; playerIndex?: PlayerIndex; amount: number}
	| {
			type: 'setPower'
			playerIndex?: PlayerIndex
			power: keyof PlayerPowers
			amount: number
			bypassWard?: boolean
	  }
	| {type: 'setDeck'; playerIndex?: PlayerIndex; cardNames: string[]}

export interface GameState {
	players: [PlayerState, PlayerState]
	activePlayer: PlayerIndex
	startingPlayer: PlayerIndex
	round: number
	turn: number
	seed: number
	rngCounter: number
	status: 'playing' | 'quizzing' | 'finished'
	winner: PlayerIndex | null
	forfeitedBy: PlayerIndex | null
	throwsThisTurn: number
	pendingThrow: ThrownCardEntry[]
	lastQuizResult: QuizResolutionSummary | null
	quizHistory: QuizResolutionSummary[]
	rampageCounts: Record<string, number>
	geneticCounts: Record<string, number>
}

export interface CreateStateOptions {
	player0Character?: CharacterId
	player1Character?: CharacterId
	player0Name?: string
	player1Name?: string
	seed?: number
	autoSetupDecks?: boolean
}

function createEmptyPlayer(id: PlayerIndex, characterId: CharacterId, name: string): PlayerState {
	return {
		id,
		name,
		characterId,
		maxHealth: ENGINE_CONFIG.startingHp,
		currentHealth: ENGINE_CONFIG.startingHp,
		mana: ENGINE_CONFIG.startingMana,
		maxMana: ENGINE_CONFIG.maxMana,
		block: 0,
		powers: {},
		deck: [],
		drawPile: [],
		hand: [],
		discardPile: [],
		exhaustPile: [],
		phoenixUsed: false,
	}
}

export function getOpponentIndex(playerIndex: PlayerIndex): PlayerIndex {
	return playerIndex === 0 ? 1 : 0
}

/**
 * Pure single damage pipeline implementation (Section 4 & Section 6):
 * round((base + buffs) * outAffinity * statusMod * inAffinity * quizScale)
 */
export function calculateHitDamage(
	baseDamage: number,
	cardSubject: Subject,
	attacker: PlayerState,
	defender: PlayerState,
	strengthMultiplier = 1,
	quizScale = 1,
): number {
	if (quizScale <= 0) return 0

	const effStrength =
		(attacker.powers.strength || 0) + (attacker.powers.tempStrength || 0) - (attacker.powers.nextTurnStrengthLoss || 0)

	const buffed = Math.max(0, baseDamage + effStrength * strengthMultiplier)
	if (buffed === 0) return 0

	const atkChar = CHARACTERS[attacker.characterId]
	const defChar = CHARACTERS[defender.characterId]

	const outAff =
		cardSubject === atkChar.affinity
			? ENGINE_CONFIG.affinityMultiplier.outgoingAffinity
			: cardSubject === atkChar.weakness
				? ENGINE_CONFIG.affinityMultiplier.outgoingWeakness
				: 1.0

	const inAff =
		cardSubject === defChar.affinity
			? ENGINE_CONFIG.affinityMultiplier.incomingAffinity
			: cardSubject === defChar.weakness
				? ENGINE_CONFIG.affinityMultiplier.incomingWeakness
				: 1.0

	let statusMod = 1.0
	if ((attacker.powers.weak || 0) > 0) {
		statusMod *= 0.75
	}
	if ((defender.powers.vulnerable || 0) > 0) {
		statusMod *= 1.5
	}

	const scaled = Math.round(buffed * outAff * statusMod * inAff * quizScale)
	return baseDamage > 0 && quizScale > 0 ? Math.max(1, scaled) : scaled
}

/**
 * Determines whether a thrown card is 'nullified', 'reduced', or 'full'
 * based on the defender's quiz answer and the card's rarity (Section 5).
 */
export function computeQuizResolution(rarity: CardInstance['rarity'], answer: QuizAnswerOutcome): CardQuizResolution {
	if (answer === 'wrong' || answer === 'timeout') {
		return 'full'
	}
	if (rarity === 'normal' || rarity === 'uncommon') {
		return 'nullified'
	}
	return 'reduced'
}

function isMatchFinished(draft: GameState): boolean {
	return draft.status === 'finished'
}

/**
 * Internal draft helper: checks if a player's HP reached 0, triggers Phoenix if active,
 * or marks the match as finished.
 */
function checkFatalOrPhoenixDraft(draft: GameState, targetIndex: PlayerIndex): void {
	const player = draft.players[targetIndex]
	if (player.currentHealth > 0) return

	const phoenixPct = player.powers.phoenix || 0
	if (phoenixPct > 0 && !player.phoenixUsed) {
		player.phoenixUsed = true
		delete player.powers.phoenix
		const reviveHp = Math.max(1, Math.round(player.maxHealth * (phoenixPct / 100)))
		player.currentHealth = clamp(reviveHp, 1, player.maxHealth)
		return
	}

	player.currentHealth = 0
	if (draft.status !== 'finished') {
		draft.status = 'finished'
		draft.winner = getOpponentIndex(targetIndex)
		draft.pendingThrow = []
	}
}

/**
 * Internal draft helper: removes HP directly (bypasses Block, e.g. Poison, Parasite, Fatigue, Hemokinesis).
 */
function loseDirectHpDraft(
	draft: GameState,
	targetIndex: PlayerIndex,
	amount: number,
	respectApparition = true,
): number {
	if (amount <= 0 || draft.status === 'finished') return 0
	const player = draft.players[targetIndex]
	let finalLoss = amount

	if (respectApparition) {
		const app = player.powers.apparition || 0
		if (app === 1) {
			finalLoss = Math.min(finalLoss, 1)
		} else if (app === 2) {
			finalLoss = Math.max(1, Math.round(finalLoss * 0.5))
		}
	}

	const prevHp = player.currentHealth
	player.currentHealth = clamp(player.currentHealth - finalLoss, 0, player.maxHealth)
	const actualLost = prevHp - player.currentHealth
	checkFatalOrPhoenixDraft(draft, targetIndex)
	return actualLost
}

/**
 * Internal draft helper: heals HP (respects Anti-heal debuff and maxHealth).
 */
function healPlayerDraft(draft: GameState, targetIndex: PlayerIndex, amount: number, ignoreAntiHeal = false): number {
	if (amount <= 0 || draft.status === 'finished') return 0
	const player = draft.players[targetIndex]
	let healAmt = amount
	if (!ignoreAntiHeal && (player.powers.antiHeal || 0) > 0) {
		healAmt = Math.round(healAmt * 0.5)
	}
	if (healAmt <= 0) return 0
	const prev = player.currentHealth
	player.currentHealth = clamp(player.currentHealth + healAmt, 0, player.maxHealth)
	return player.currentHealth - prev
}

/**
 * Internal draft helper: applies a buff or debuff to a player.
 * If the power is a debuff and the target has Ward, 1 Ward is consumed and the debuff is negated.
 */
function applyPowerDraft(
	draft: GameState,
	targetIndex: PlayerIndex,
	power: keyof PlayerPowers,
	amount: number,
	bypassWard = false,
): void {
	if (amount === 0) return
	const target = draft.players[targetIndex]
	const isDebuff = DEBUFF_KEYS.includes(power) || (power === 'strength' && amount < 0)

	if (isDebuff && !bypassWard && (target.powers.ward || 0) > 0) {
		target.powers.ward = Math.max(0, (target.powers.ward || 0) - 1)
		if (target.powers.ward === 0) {
			delete target.powers.ward
		}
		return
	}

	if (power === 'stun' && (target.powers.stunImmune || 0) > 0) {
		return
	}

	const current = target.powers[power] || 0
	const nextVal = current + amount
	const def = POWER_DEFINITIONS[power]

	if (def?.canBeNegative) {
		if (nextVal === 0) {
			delete target.powers[power]
		} else {
			target.powers[power] = nextVal
		}
	} else {
		if (nextVal <= 0) {
			delete target.powers[power]
		} else {
			target.powers[power] = nextVal
		}
	}
}

/**
 * Internal draft helper: deals damage through Block and HP, triggers Envenom and Reflect,
 * and checks Phoenix / win condition. Returns unblocked HP damage dealt.
 */
function applyDamageHitDraft(
	draft: GameState,
	attackerIndex: PlayerIndex,
	defenderIndex: PlayerIndex,
	rawDamage: number,
	options: {isFromCardHit?: boolean; allowReflect?: boolean} = {},
): number {
	if (rawDamage <= 0 || draft.status === 'finished') return 0
	const attacker = draft.players[attackerIndex]
	const defender = draft.players[defenderIndex]

	let incoming = rawDamage
	const app = defender.powers.apparition || 0
	if (app === 1) {
		incoming = 1
	} else if (app === 2) {
		incoming = Math.max(1, Math.round(incoming * 0.5))
	}

	const absorbedByBlock = Math.min(defender.block, incoming)
	defender.block = Math.max(0, defender.block - absorbedByBlock)
	const unblocked = Math.max(0, incoming - absorbedByBlock)

	let actualHpDamage = 0
	if (unblocked > 0) {
		const prevHp = defender.currentHealth
		defender.currentHealth = clamp(defender.currentHealth - unblocked, 0, defender.maxHealth)
		actualHpDamage = prevHp - defender.currentHealth
		checkFatalOrPhoenixDraft(draft, defenderIndex)
	}

	// Envenom / EnvenomOnce trigger on unblocked card hit damage
	if (options.isFromCardHit && unblocked > 0 && !isMatchFinished(draft)) {
		const env = attacker.powers.envenom || 0
		if (env > 0) {
			applyPowerDraft(draft, defenderIndex, 'poison', env)
		}
		const envOnce = attacker.powers.envenomOnce || 0
		if (envOnce > 0) {
			delete attacker.powers.envenomOnce
			applyPowerDraft(draft, defenderIndex, 'poison', envOnce)
		}
	}

	// Reflect (Flame Barrier) triggers when defender takes damage
	if (options.allowReflect !== false && (defender.powers.reflect || 0) > 0 && incoming > 0 && !isMatchFinished(draft)) {
		const reflectPct = defender.powers.reflect || 0
		const reflectedDamage = Math.round(incoming * (reflectPct / 100))
		if (reflectedDamage > 0) {
			applyDamageHitDraft(draft, defenderIndex, attackerIndex, reflectedDamage, {
				isFromCardHit: false,
				allowReflect: false,
			})
		}
	}

	return actualHpDamage
}

/**
 * Internal draft helper: grants Block to a player (respects Corrode and triggers Juggernaut).
 */
function gainBlockDraft(draft: GameState, playerIndex: PlayerIndex, rawBlock: number): number {
	if (rawBlock <= 0 || draft.status === 'finished') return 0
	const player = draft.players[playerIndex]
	let finalBlock = rawBlock
	if ((player.powers.corrode || 0) > 0) {
		finalBlock = Math.round(finalBlock * 0.75)
	}
	if (finalBlock <= 0) return 0

	player.block += finalBlock

	const juggernautDmg = player.powers.juggernaut || 0
	if (juggernautDmg > 0) {
		const oppIndex = getOpponentIndex(playerIndex)
		applyDamageHitDraft(draft, playerIndex, oppIndex, juggernautDmg, {
			isFromCardHit: false,
			allowReflect: true,
		})
	}
	return finalBlock
}

/**
 * Internal draft helper: draws up to `amount` cards for `playerIndex`, reshuffling discardPile
 * into drawPile with the seeded PRNG if needed. Respects `maxHandSize` (7) or optional cap.
 */
function drawCardsDraft(
	draft: GameState,
	playerIndex: PlayerIndex,
	amount: number,
	maxCap: number = ENGINE_CONFIG.maxHandSize,
): void {
	const player = draft.players[playerIndex]
	for (let i = 0; i < amount; i++) {
		if (player.hand.length >= maxCap) break

		if (player.drawPile.length === 0 && player.discardPile.length > 0) {
			const {shuffled, nextCounter} = seededShuffle(player.discardPile, draft.seed, draft.rngCounter)
			draft.rngCounter = nextCounter
			player.drawPile = shuffled
			player.discardPile = []
		}

		const nextCard = player.drawPile.shift()
		if (!nextCard) break
		player.hand.push(nextCard)
	}
}

/**
 * Internal draft helper: executes a list of CardEffects for a resolved card.
 */
function executeCardEffectsDraft(
	draft: GameState,
	card: CardInstance,
	casterIndex: PlayerIndex,
	defenderIndex: PlayerIndex,
	effectsToRun: CardEffect[],
	quizScale: number,
): void {
	let totalUnblockedDealt = 0

	for (const effect of effectsToRun) {
		if (draft.status === 'finished') break
		const caster = draft.players[casterIndex]
		const defender = draft.players[defenderIndex]

		switch (effect.type) {
			case 'damage': {
				const hits = effect.hits || 1
				const strMult = effect.strengthMultiplier || 1
				for (let h = 0; h < hits; h++) {
					if (isMatchFinished(draft)) break
					const hitDmg = calculateHitDamage(
						effect.amount,
						card.subject,
						draft.players[casterIndex],
						draft.players[defenderIndex],
						strMult,
						quizScale,
					)
					totalUnblockedDealt += applyDamageHitDraft(draft, casterIndex, defenderIndex, hitDmg, {
						isFromCardHit: true,
						allowReflect: true,
					})
				}
				break
			}

			case 'damageEqualToBlock': {
				const base = caster.block
				if (base > 0) {
					const hitDmg = calculateHitDamage(base, card.subject, caster, defender, 1, quizScale)
					totalUnblockedDealt += applyDamageHitDraft(draft, casterIndex, defenderIndex, hitDmg, {
						isFromCardHit: true,
						allowReflect: true,
					})
				}
				break
			}

			case 'rampageDamage': {
				const playsSoFar = draft.rampageCounts[card.instanceId] || 0
				const base = effect.base + playsSoFar * effect.increment
				draft.rampageCounts[card.instanceId] = playsSoFar + 1
				const hitDmg = calculateHitDamage(base, card.subject, caster, defender, 1, quizScale)
				totalUnblockedDealt += applyDamageHitDraft(draft, casterIndex, defenderIndex, hitDmg, {
					isFromCardHit: true,
					allowReflect: true,
				})
				break
			}

			case 'block': {
				const scaledBlock = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
				gainBlockDraft(draft, casterIndex, scaledBlock)
				break
			}

			case 'conditionalNoBlock': {
				if (caster.block === 0) {
					const scaledBlock = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
					gainBlockDraft(draft, casterIndex, scaledBlock)
				}
				break
			}

			case 'doubleBlock': {
				if (caster.block > 0) {
					const addAmt = quizScale < 1 ? Math.max(1, Math.round(caster.block * quizScale)) : caster.block
					gainBlockDraft(draft, casterIndex, addAmt)
				}
				break
			}

			case 'removeOpponentBlock': {
				defender.block = 0
				break
			}

			case 'heal': {
				const scaledHeal = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
				healPlayerDraft(draft, casterIndex, scaledHeal)
				break
			}

			case 'geneticHeal': {
				const playsSoFar = draft.geneticCounts[card.instanceId] || 0
				const rawHeal = effect.base + playsSoFar * effect.increment
				draft.geneticCounts[card.instanceId] = playsSoFar + 1
				const scaledHeal = quizScale < 1 ? Math.max(1, Math.round(rawHeal * quizScale)) : rawHeal
				healPlayerDraft(draft, casterIndex, scaledHeal)
				break
			}

			case 'nextTurnHeal': {
				const scaled = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
				caster.powers.nextTurnHeal = (caster.powers.nextTurnHeal || 0) + scaled
				break
			}

			case 'regen': {
				const scaledAmt = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
				caster.powers.regenAmount = (caster.powers.regenAmount || 0) + scaledAmt
				caster.powers.regenRounds = Math.max(caster.powers.regenRounds || 0, effect.rounds)
				break
			}

			case 'loseHp': {
				const scaledLoss = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
				loseDirectHpDraft(draft, casterIndex, scaledLoss, true)
				break
			}

			case 'raiseMaxHp': {
				const raise = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
				caster.maxHealth += raise
				caster.currentHealth = clamp(caster.currentHealth + raise, 0, caster.maxHealth)
				break
			}

			case 'lifeSteal': {
				if ((caster.powers.noLifeSteal || 0) <= 0 && totalUnblockedDealt > 0) {
					const effectivePercent = quizScale < 1 ? effect.percent * quizScale : effect.percent
					const rawHeal = Math.round(totalUnblockedDealt * (effectivePercent / 100))
					const lifeStealHeal = effectivePercent > 0 ? Math.max(1, rawHeal) : 0
					if (lifeStealHeal > 0) {
						healPlayerDraft(draft, casterIndex, lifeStealHeal)
					}
				}
				break
			}

			case 'draw': {
				const drawCount = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
				drawCardsDraft(draft, casterIndex, drawCount, ENGINE_CONFIG.maxHandSize)
				break
			}

			case 'gainMana': {
				const manaAmt = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
				caster.mana = clamp(caster.mana + manaAmt, 0, caster.maxMana)
				break
			}

			case 'doubleMana': {
				const addMana = quizScale < 1 ? Math.max(1, Math.round(caster.mana * quizScale)) : caster.mana
				caster.mana = clamp(caster.mana + addMana, 0, caster.maxMana)
				break
			}

			case 'nextTurnExtraMana': {
				const extra = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
				caster.powers.nextTurnExtraMana = (caster.powers.nextTurnExtraMana || 0) + extra
				break
			}

			case 'stealMana': {
				const requested = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
				const stolen = Math.min(defender.mana, requested)
				defender.mana = clamp(defender.mana - stolen, 0, defender.maxMana)
				caster.mana = clamp(caster.mana + stolen, 0, caster.maxMana)
				break
			}

			case 'opponentLoseMana': {
				const lost = quizScale < 1 ? Math.max(1, Math.round(effect.amount * quizScale)) : effect.amount
				defender.mana = clamp(defender.mana - lost, 0, defender.maxMana)
				break
			}

			case 'applyPower': {
				const targetIdx = effect.target === 'self' ? casterIndex : defenderIndex
				const scaledAmt =
					quizScale < 1
						? Math.sign(effect.amount) * Math.max(1, Math.round(Math.abs(effect.amount) * quizScale))
						: effect.amount
				applyPowerDraft(draft, targetIdx, effect.power, scaledAmt)
				break
			}

			case 'banePoison': {
				const alreadyPoisoned = (defender.powers.poison || 0) > 0
				const rawPoison = alreadyPoisoned ? effect.ifPoisoned : effect.base
				const scaledPoison = quizScale < 1 ? Math.max(1, Math.round(rawPoison * quizScale)) : rawPoison
				applyPowerDraft(draft, defenderIndex, 'poison', scaledPoison)
				break
			}

			case 'doubleOpponentPoison': {
				const currentPoison = defender.powers.poison || 0
				if (currentPoison > 0) {
					const added = quizScale < 1 ? Math.max(1, Math.round(currentPoison * quizScale)) : currentPoison
					applyPowerDraft(draft, defenderIndex, 'poison', added)
				}
				break
			}

			case 'poisonBurst': {
				const burstDmg = defender.powers.poison || 0
				if (burstDmg > 0) {
					loseDirectHpDraft(draft, defenderIndex, burstDmg, true)
				}
				break
			}

			case 'stunOpponent': {
				applyPowerDraft(draft, defenderIndex, 'stun', 1)
				break
			}

			case 'cure': {
				const keysToCure = effect.debuffs === 'all' ? DEBUFF_KEYS : effect.debuffs
				for (const key of keysToCure) {
					delete caster.powers[key]
				}
				if (effect.debuffs === 'all' && (caster.powers.strength || 0) < 0) {
					delete caster.powers.strength
				}
				break
			}

			case 'addCopyToDiscard': {
				draft.rngCounter += 1
				const copyCard: CardInstance = {
					...card,
					instanceId: createDeterministicId(card.id, draft.seed, draft.rngCounter),
					effects: card.effects.map((e) => ({...e})),
				}
				caster.discardPile.push(copyCard)
				break
			}

			case 'exhaustRandomFromHand': {
				for (let c = 0; c < effect.count; c++) {
					if (caster.hand.length === 0) break
					const {value, nextCounter} = seededRandomInt(0, caster.hand.length - 1, draft.seed, draft.rngCounter)
					draft.rngCounter = nextCounter
					const [exhausted] = caster.hand.splice(value, 1)
					if (exhausted) {
						caster.exhaustPile.push(exhausted)
					}
				}
				break
			}

			case 'exhaustNonMathsInHand': {
				const keep: CardInstance[] = []
				for (const hCard of caster.hand) {
					if (hCard.subject === 'maths') {
						keep.push(hCard)
					} else {
						caster.exhaustPile.push(hCard)
					}
				}
				caster.hand = keep
				break
			}

			case 'upgradeOneInHand': {
				const candidateIndices = caster.hand.map((c, idx) => (!c.upgraded ? idx : -1)).filter((idx) => idx >= 0)
				if (candidateIndices.length > 0) {
					const {value, nextCounter} = seededRandomInt(0, candidateIndices.length - 1, draft.seed, draft.rngCounter)
					draft.rngCounter = nextCounter
					const targetHandIdx = candidateIndices[value]
					if (targetHandIdx !== undefined && caster.hand[targetHandIdx]) {
						caster.hand[targetHandIdx] = upgradeCardInstance(caster.hand[targetHandIdx])
					}
				}
				break
			}

			case 'upgradeAllInHand': {
				caster.hand = caster.hand.map((c) => upgradeCardInstance(c))
				break
			}

			case 'upgradeAllInDeck': {
				caster.hand = caster.hand.map((c) => upgradeCardInstance(c))
				caster.drawPile = caster.drawPile.map((c) => upgradeCardInstance(c))
				caster.discardPile = caster.discardPile.map((c) => upgradeCardInstance(c))
				caster.deck = caster.deck.map((c) => upgradeCardInstance(c))
				break
			}
		}
	}
}

/**
 * Resolves a single thrown card according to the defender's quiz answer,
 * handles Double Tap replay for Maths cards, and moves the card to discard or exhaust.
 */
function resolveSingleCardDraft(
	draft: GameState,
	entry: ThrownCardEntry,
	answer: QuizAnswerOutcome,
	selectedChoice?: number | null,
): void {
	const {card, casterIndex, defenderIndex} = entry
	const resolution = computeQuizResolution(card.rarity, answer)

	const summary: QuizResolutionSummary = {
		cardId: card.id,
		cardName: card.name,
		cardSubject: card.subject,
		cardRarity: card.rarity,
		casterIndex,
		defenderIndex,
		answer,
		resolution,
		questionId: entry.questionId ?? card.boundQuestionId,
		boundChoices: card.boundChoices
			? ([...card.boundChoices] as [string, string, string, string])
			: undefined,
		boundCorrectIndex: card.boundCorrectIndex,
		selectedChoice: selectedChoice ?? null,
	}
	draft.lastQuizResult = summary
	draft.quizHistory.push(summary)

	const caster = draft.players[casterIndex]

	// Check if Double Tap should trigger on this Maths card
	let doubleTapReplayScale = 0
	if (
		resolution !== 'nullified' &&
		card.subject === 'maths' &&
		card.id !== 'M15' &&
		(caster.powers.doubleTap || 0) > 0
	) {
		doubleTapReplayScale = (caster.powers.doubleTap || 100) / 100
		delete caster.powers.doubleTap
	}

	if (resolution === 'full') {
		executeCardEffectsDraft(draft, card, casterIndex, defenderIndex, card.effects, 1.0)
	} else if (resolution === 'reduced') {
		if (card.reducedEffects && card.reducedEffects.length > 0) {
			executeCardEffectsDraft(draft, card, casterIndex, defenderIndex, card.reducedEffects, 1.0)
		} else {
			executeCardEffectsDraft(draft, card, casterIndex, defenderIndex, card.effects, ENGINE_CONFIG.reducedStrengthScale)
		}
	}

	// Execute Double Tap second play if triggered
	if (doubleTapReplayScale > 0 && !isMatchFinished(draft)) {
		const primaryScale = resolution === 'reduced' ? ENGINE_CONFIG.reducedStrengthScale : 1.0
		executeCardEffectsDraft(draft, card, casterIndex, defenderIndex, card.effects, primaryScale * doubleTapReplayScale)
	}

	// Move card to exhaustPile (if Exhaust or Power) or discardPile
	if (card.exhaust || card.power) {
		caster.exhaustPile.push(card)
	} else {
		caster.discardPile.push(card)
	}
}

/**
 * Internal draft helper: runs start-of-turn sequence for `draft.activePlayer`.
 */
function runStartOfTurnDraft(draft: GameState, isFirstTurnOfMatch = false): void {
	if (isMatchFinished(draft)) return
	draft.throwsThisTurn = 0
	const pIdx = draft.activePlayer
	const oppIdx = getOpponentIndex(pIdx)
	const player = draft.players[pIdx]

	// 1. Block reset unless Barricade or BarricadeOneTurn is active
	if ((player.powers.barricade || 0) > 0) {
		// keep block permanently
	} else if ((player.powers.barricadeOneTurn || 0) > 0) {
		delete player.powers.barricadeOneTurn
	} else {
		player.block = 0
	}

	// 2. Clear turn-bound defensive/reflective buffs at the start of owner's turn
	delete player.powers.reflect
	delete player.powers.apparition

	// 3. Mana gain (+1 at start of turn after initial match start, plus any nextTurnExtraMana, max 5)
	const baseGain = isFirstTurnOfMatch ? 0 : ENGINE_CONFIG.turnStartManaGain
	const extraMana = player.powers.nextTurnExtraMana || 0
	delete player.powers.nextTurnExtraMana
	player.mana = clamp(player.mana + baseGain + extraMana, 0, player.maxMana)

	// 4. Start-of-turn permanent powers & scheduled heals
	if ((player.powers.demonForm || 0) > 0) {
		applyPowerDraft(draft, pIdx, 'strength', player.powers.demonForm || 0)
	}
	if ((player.powers.noxiousFumes || 0) > 0) {
		applyPowerDraft(draft, oppIdx, 'poison', player.powers.noxiousFumes || 0)
	}
	if ((player.powers.selfRepair || 0) > 0) {
		healPlayerDraft(draft, pIdx, player.powers.selfRepair || 0)
	}
	if ((player.powers.nextTurnHeal || 0) > 0) {
		const healAmt = player.powers.nextTurnHeal || 0
		delete player.powers.nextTurnHeal
		healPlayerDraft(draft, pIdx, healAmt)
	}
	if ((player.powers.regenRounds || 0) > 0 && (player.powers.regenAmount || 0) > 0) {
		healPlayerDraft(draft, pIdx, player.powers.regenAmount || 0)
		player.powers.regenRounds = (player.powers.regenRounds || 0) - 1
		if ((player.powers.regenRounds || 0) <= 0) {
			delete player.powers.regenRounds
			delete player.powers.regenAmount
		}
	}

	// 5. Poison tick: lose N HP, then Poison drops by 1
	if ((player.powers.poison || 0) > 0 && !isMatchFinished(draft)) {
		const poisonDmg = player.powers.poison || 0
		loseDirectHpDraft(draft, pIdx, poisonDmg, true)
		const nextPoison = poisonDmg - 1
		if (nextPoison <= 0) {
			delete player.powers.poison
		} else {
			player.powers.poison = nextPoison
		}
	}

	// 6. Parasite tick: lose N HP, then Parasite rises by 1
	if ((player.powers.parasite || 0) > 0 && !isMatchFinished(draft)) {
		const parasiteDmg = player.powers.parasite || 0
		loseDirectHpDraft(draft, pIdx, parasiteDmg, true)
		if (!isMatchFinished(draft) && (player.powers.parasite || 0) > 0) {
			player.powers.parasite = parasiteDmg + 1
		}
	}

	// 7. Fatigue (Section 8: from round 25, active player loses 2 * (round - 24) HP at turn start)
	if (draft.round >= ENGINE_CONFIG.fatigueStartRound && !isMatchFinished(draft)) {
		const fatigueLoss = ENGINE_CONFIG.fatigueMultiplier * (draft.round - (ENGINE_CONFIG.fatigueStartRound - 1))
		loseDirectHpDraft(draft, pIdx, fatigueLoss, true)
	}

	if (isMatchFinished(draft)) return

	// 8. Stun check: if stunned, skip this turn and grant 2 rounds of Stun immunity
	if ((player.powers.stun || 0) > 0) {
		delete player.powers.stun
		player.powers.stunImmune = Math.max(player.powers.stunImmune || 0, ENGINE_CONFIG.stunImmunityRounds + 1)
		runEndOfTurnDraft(draft)
		return
	}

	// 9. Draw at turn start: 1 card (up to handSize = 5)
	if (!isFirstTurnOfMatch && player.hand.length < ENGINE_CONFIG.handSize) {
		drawCardsDraft(draft, pIdx, ENGINE_CONFIG.turnStartDraw, ENGINE_CONFIG.handSize)
	}
}

/**
 * Internal draft helper: runs end-of-turn sequence for `draft.activePlayer` and advances to next player's turn.
 */
function runEndOfTurnDraft(draft: GameState): void {
	if (isMatchFinished(draft)) return
	const pIdx = draft.activePlayer
	const player = draft.players[pIdx]

	// 1. End-of-turn powers: Metallicize
	if ((player.powers.metallicize || 0) > 0) {
		gainBlockDraft(draft, pIdx, player.powers.metallicize || 0)
	}
	if (isMatchFinished(draft)) return

	// 2. Expire turn-scoped temporary modifiers
	delete player.powers.tempStrength
	delete player.powers.nextTurnStrengthLoss
	delete player.powers.doubleTap

	// 3. Decrement round-decaying debuffs/buffs on the player finishing their turn
	const roundDecayingKeys: Array<keyof PlayerPowers> = [
		'weak',
		'vulnerable',
		'corrode',
		'antiHeal',
		'noLifeSteal',
		'stunImmune',
	]
	for (const key of roundDecayingKeys) {
		const cur = player.powers[key] || 0
		if (cur > 0) {
			if (cur - 1 <= 0) {
				delete player.powers[key]
			} else {
				player.powers[key] = cur - 1
			}
		}
	}

	// 4. Advance activePlayer, turn, and round
	const nextPlayer = getOpponentIndex(pIdx)
	draft.activePlayer = nextPlayer
	draft.turn += 1
	if (nextPlayer === draft.startingPlayer) {
		draft.round += 1
	}

	// 5. Run start of turn for the next active player
	runStartOfTurnDraft(draft, false)
}

/**
 * Creates a new serializable 2-player GameState.
 */
export function createNewState(options: CreateStateOptions = {}): GameState {
	const seed = options.seed ?? 1337
	const p0Char = options.player0Character ?? 'dark-ninja'
	const p1Char = options.player1Character ?? 'knight'
	const p0Name = options.player0Name ?? CHARACTERS[p0Char].name
	const p1Name = options.player1Name ?? CHARACTERS[p1Char].name

	const baseState: GameState = {
		players: [createEmptyPlayer(0, p0Char, p0Name), createEmptyPlayer(1, p1Char, p1Name)],
		activePlayer: 0,
		startingPlayer: 0,
		round: 1,
		turn: 1,
		seed,
		rngCounter: 0,
		status: 'playing',
		winner: null,
		forfeitedBy: null,
		throwsThisTurn: 0,
		pendingThrow: [],
		lastQuizResult: null,
		quizHistory: [],
		rampageCounts: {},
		geneticCounts: {},
	}

	if (options.autoSetupDecks !== false) {
		return initMatch(baseState, {
			type: 'initMatch',
			player0Character: p0Char,
			player1Character: p1Char,
			seed,
		})
	}

	return baseState
}

/**
 * Initializes both players' 24-card decks, shuffles their draw piles, and deals 5 starting cards each.
 */
export function initMatch(
	state: GameState,
	props: {
		type?: 'initMatch'
		player0Character?: CharacterId
		player1Character?: CharacterId
		seed?: number
	} = {},
): GameState {
	return produce(state, (draft) => {
		const seed = props.seed ?? draft.seed
		draft.seed = seed
		draft.rngCounter = 0
		draft.round = 1
		draft.turn = 1
		draft.activePlayer = 0
		draft.startingPlayer = 0
		draft.status = 'playing'
		draft.winner = null
		draft.forfeitedBy = null
		draft.throwsThisTurn = 0
		draft.pendingThrow = []
		draft.lastQuizResult = null
		draft.quizHistory = []
		draft.rampageCounts = {}
		draft.geneticCounts = {}

		const chars: [CharacterId, CharacterId] = [
			props.player0Character ?? draft.players[0].characterId,
			props.player1Character ?? draft.players[1].characterId,
		]

		const rawDeck0 = buildCharacterDeck(chars[0], seed).map((c) => ({
			...c,
			effects: c.effects.map((e) => ({...e})),
		}))
		const rawDeck1 = buildCharacterDeck(chars[1], seed + 1000).map((c) => ({
			...c,
			effects: c.effects.map((e) => ({...e})),
		}))
		const bound = bindQuestionsToMatchDecks(rawDeck0, rawDeck1, draft.seed, draft.rngCounter)
		draft.rngCounter = bound.nextCounter
		const boundDecks: [CardInstance[], CardInstance[]] = [bound.deck0, bound.deck1]

		for (const idx of [0, 1] as const) {
			const charId = chars[idx]
			const startingHp = CHARACTERS[charId]?.startingHp ?? ENGINE_CONFIG.startingHp
			const p = draft.players[idx]
			p.characterId = charId
			p.name = CHARACTERS[charId].name
			p.maxHealth = startingHp
			p.currentHealth = startingHp
			p.mana = ENGINE_CONFIG.startingMana
			p.maxMana = ENGINE_CONFIG.maxMana
			p.block = 0
			p.powers = {}
			p.phoenixUsed = false

			p.deck = boundDecks[idx]
			const {shuffled, nextCounter} = seededShuffle(p.deck, draft.seed, draft.rngCounter)
			draft.rngCounter = nextCounter
			p.drawPile = shuffled
			p.hand = []
			p.discardPile = []
			p.exhaustPile = []

			drawCardsDraft(draft, idx, ENGINE_CONFIG.handSize, ENGINE_CONFIG.handSize)
		}
	})
}

export function startTurn(state: GameState): GameState {
	return produce(state, (draft) => {
		runStartOfTurnDraft(draft, false)
	})
}

export function drawCards(
	state: GameState,
	props: {
		playerIndex?: PlayerIndex
		amount?: number
		respectHandSizeCap?: boolean
	} = {},
): GameState {
	return produce(state, (draft) => {
		const pIdx = props.playerIndex ?? draft.activePlayer
		const amount = props.amount ?? ENGINE_CONFIG.handSize
		const cap = props.respectHandSizeCap ? ENGINE_CONFIG.handSize : ENGINE_CONFIG.maxHandSize
		drawCardsDraft(draft, pIdx, amount, cap)
	})
}

/**
 * Throws 1 or more selected cards from the active player's hand:
 * - Validates total mana cost and card conditions
 * - Deducts mana immediately and removes cards from hand
 * - Queues the cards into `pendingThrow` and sets `status = 'quizzing'`
 */
export function throwCards(state: GameState, props: {playerIndex?: PlayerIndex; cardInstanceIds: string[]}): GameState {
	return produce(state, (draft) => {
		if (draft.status !== 'playing') {
			throw new Error(`Cannot throw cards while game status is '${draft.status}'`)
		}
		const pIdx = props.playerIndex ?? draft.activePlayer
		if (pIdx !== draft.activePlayer) {
			throw new Error('Only the active player can throw cards')
		}
		if (!canThrowSelection(draft, props.cardInstanceIds, pIdx)) {
			throw new Error('Invalid card selection or insufficient mana')
		}

		const player = draft.players[pIdx]
		const defenderIdx = getOpponentIndex(pIdx)
		const thrownEntries: ThrownCardEntry[] = []

		for (const instanceId of props.cardInstanceIds) {
			const handIdx = player.hand.findIndex((c) => c.instanceId === instanceId)
			if (handIdx === -1) {
				throw new Error(`Card instance ${instanceId} not found in hand`)
			}
			const [card] = player.hand.splice(handIdx, 1)
			if (card) {
				player.mana = clamp(player.mana - card.cost, 0, player.maxMana)
				thrownEntries.push({
					card,
					casterIndex: pIdx,
					defenderIndex: defenderIdx,
					questionId: card.boundQuestionId,
				})
			}
		}

		draft.throwsThisTurn += thrownEntries.length
		draft.pendingThrow.push(...thrownEntries)
		draft.status = 'quizzing'
	})
}

/**
 * Resolves the oldest card in `pendingThrow` using the defender's quiz answer ('correct' | 'wrong' | 'timeout').
 * When `pendingThrow` becomes empty (and the game hasn't finished), returns `status` to `'playing'`.
 */
export function resolveQuizAnswer(
	state: GameState,
	props: {answer: QuizAnswerOutcome; selectedChoice?: number | null},
): GameState {
	return produce(state, (draft) => {
		const nextEntry = draft.pendingThrow.shift()
		if (!nextEntry) {
			throw new Error('No pending thrown card to resolve')
		}

		resolveSingleCardDraft(draft, nextEntry, props.answer, props.selectedChoice)

		if (draft.status !== 'finished') {
			draft.status = draft.pendingThrow.length > 0 ? 'quizzing' : 'playing'
		}
	})
}

/**
 * Direct convenience action that throws and immediately resolves a single card.
 * Defaults to `answer = 'wrong'` (full 100% card effect) so unit tests can assert card mechanics directly.
 */
export function playCard(
	state: GameState,
	props: {
		playerIndex?: PlayerIndex
		card: CardInstance
		answer?: QuizAnswerOutcome
	},
): GameState {
	return produce(state, (draft) => {
		if (draft.status === 'finished') return
		const pIdx = props.playerIndex ?? draft.activePlayer
		const defenderIdx = getOpponentIndex(pIdx)
		const player = draft.players[pIdx]

		if (!canPlay(draft, props.card, pIdx)) {
			throw new Error(`Cannot play card ${props.card.name}: insufficient mana or unmet condition`)
		}

		player.mana = clamp(player.mana - props.card.cost, 0, player.maxMana)

		const handIdx = player.hand.findIndex((c) => c.instanceId === props.card.instanceId)
		if (handIdx >= 0) {
			player.hand.splice(handIdx, 1)
		}

		draft.throwsThisTurn += 1
		const answer: QuizAnswerOutcome = props.answer ?? 'wrong'
		resolveSingleCardDraft(
			draft,
			{
				card: props.card,
				casterIndex: pIdx,
				defenderIndex: defenderIdx,
				questionId: props.card.boundQuestionId,
			},
			answer,
		)
	})
}

/**
 * Ends the active player's turn and starts the opponent's turn.
 */
export function endTurn(state: GameState): GameState {
	return produce(state, (draft) => {
		if (draft.status !== 'playing') return
		runEndOfTurnDraft(draft)
	})
}

/**
 * Skips the active player's turn (Section 5: ending the turn without throwing any card
 * grants +1 extra mana, up to max 5, and ends the turn; if cards were already thrown this turn,
 * no bonus mana is granted).
 */
export function skipTurn(state: GameState): GameState {
	return produce(state, (draft) => {
		if (draft.status !== 'playing') return
		if (draft.throwsThisTurn === 0) {
			const player = draft.players[draft.activePlayer]
			player.mana = clamp(player.mana + ENGINE_CONFIG.skipTurnBonusMana, 0, player.maxMana)
		}
		runEndOfTurnDraft(draft)
	})
}

/**
 * Marks the match as forfeited by `playerIndex` (e.g. 60s turn inactivity timeout).
 */
export function forfeit(state: GameState, props: {playerIndex: PlayerIndex}): GameState {
	return produce(state, (draft) => {
		if (draft.status === 'finished') return
		draft.status = 'finished'
		draft.forfeitedBy = props.playerIndex
		draft.winner = getOpponentIndex(props.playerIndex)
		draft.pendingThrow = []
	})
}

export function addCardToHand(state: GameState, props: {playerIndex?: PlayerIndex; card: CardInstance}): GameState {
	return produce(state, (draft) => {
		const pIdx = props.playerIndex ?? draft.activePlayer
		draft.players[pIdx].hand.push(props.card)
	})
}

export function addCardToDeck(state: GameState, props: {playerIndex?: PlayerIndex; card: CardInstance}): GameState {
	return produce(state, (draft) => {
		const pIdx = props.playerIndex ?? draft.activePlayer
		draft.players[pIdx].deck.push(props.card)
	})
}

export function discardCard(state: GameState, props: {playerIndex?: PlayerIndex; card: CardInstance}): GameState {
	return produce(state, (draft) => {
		const pIdx = props.playerIndex ?? draft.activePlayer
		const player = draft.players[pIdx]
		const idx = player.hand.findIndex((c) => c.instanceId === props.card.instanceId)
		if (idx >= 0) {
			const [removed] = player.hand.splice(idx, 1)
			if (removed) player.discardPile.push(removed)
		}
	})
}

export function discardHand(state: GameState, props: {playerIndex?: PlayerIndex} = {}): GameState {
	return produce(state, (draft) => {
		const pIdx = props.playerIndex ?? draft.activePlayer
		const player = draft.players[pIdx]
		player.discardPile.push(...player.hand)
		player.hand = []
	})
}

export function upgradeCard(state: GameState, props: {playerIndex?: PlayerIndex; card: CardInstance}): GameState {
	return produce(state, (draft) => {
		const pIdx = props.playerIndex ?? draft.activePlayer
		const player = draft.players[pIdx]
		const updateList = (list: CardInstance[]) =>
			list.map((c) => (c.instanceId === props.card.instanceId ? upgradeCardInstance(c) : c))
		player.hand = updateList(player.hand)
		player.drawPile = updateList(player.drawPile)
		player.discardPile = updateList(player.discardPile)
		player.deck = updateList(player.deck)
	})
}

export function addHealth(
	state: GameState,
	props: {playerIndex?: PlayerIndex; amount: number; ignoreAntiHeal?: boolean},
): GameState {
	return produce(state, (draft) => {
		const pIdx = props.playerIndex ?? draft.activePlayer
		healPlayerDraft(draft, pIdx, props.amount, Boolean(props.ignoreAntiHeal))
	})
}

export function removeHealth(
	state: GameState,
	props: {playerIndex?: PlayerIndex; amount: number; ignoreApparition?: boolean},
): GameState {
	return produce(state, (draft) => {
		const pIdx = props.playerIndex ?? draft.activePlayer
		loseDirectHpDraft(draft, pIdx, props.amount, !props.ignoreApparition)
	})
}

export function setHealth(state: GameState, props: {playerIndex?: PlayerIndex; amount: number}): GameState {
	return produce(state, (draft) => {
		const pIdx = props.playerIndex ?? draft.activePlayer
		const player = draft.players[pIdx]
		player.currentHealth = clamp(props.amount, 0, player.maxHealth)
		checkFatalOrPhoenixDraft(draft, pIdx)
	})
}

export function setPower(
	state: GameState,
	props: {
		playerIndex?: PlayerIndex
		power: keyof PlayerPowers
		amount: number
		bypassWard?: boolean
	},
): GameState {
	return produce(state, (draft) => {
		const pIdx = props.playerIndex ?? draft.activePlayer
		applyPowerDraft(draft, pIdx, props.power, props.amount, Boolean(props.bypassWard))
	})
}

export function setDeck(state: GameState, props: {playerIndex?: PlayerIndex; cardNames: string[]}): GameState {
	return produce(state, (draft) => {
		const pIdx = props.playerIndex ?? draft.activePlayer
		const player = draft.players[pIdx]
		const cards = props.cardNames.map((name, i) => createCard(name, false, draft.seed, draft.rngCounter + i + 1))
		draft.rngCounter += props.cardNames.length
		player.deck = cards
		const {shuffled, nextCounter} = seededShuffle(cards, draft.seed, draft.rngCounter)
		draft.rngCounter = nextCounter
		player.drawPile = shuffled
	})
}

/**
 * Executes any serializable GameAction object on `state` and returns the new `GameState`.
 */
export function executeAction(state: GameState, action: GameAction): GameState {
	switch (action.type) {
		case 'initMatch':
			return initMatch(state, action)
		case 'startTurn':
			return startTurn(state)
		case 'drawCards':
			return drawCards(state, action)
		case 'throwCards':
			return throwCards(state, action)
		case 'resolveQuizAnswer':
			return resolveQuizAnswer(state, action)
		case 'playCard':
			return playCard(state, action)
		case 'endTurn':
			return endTurn(state)
		case 'skipTurn':
			return skipTurn(state)
		case 'forfeit':
			return forfeit(state, action)
		case 'addCardToHand':
			return addCardToHand(state, action)
		case 'addCardToDeck':
			return addCardToDeck(state, action)
		case 'discardCard':
			return discardCard(state, action)
		case 'discardHand':
			return discardHand(state, action)
		case 'upgradeCard':
			return upgradeCard(state, action)
		case 'addHealth':
			return addHealth(state, action)
		case 'removeHealth':
			return removeHealth(state, action)
		case 'setHealth':
			return setHealth(state, action)
		case 'setPower':
			return setPower(state, action)
		case 'setDeck':
			return setDeck(state, action)
	}
}

export const actions = {
	createNewState,
	initMatch,
	startTurn,
	drawCards,
	throwCards,
	resolveQuizAnswer,
	playCard,
	endTurn,
	skipTurn,
	forfeit,
	addCardToHand,
	addCardToDeck,
	discardCard,
	discardHand,
	upgradeCard,
	addHealth,
	removeHealth,
	setHealth,
	setPower,
	setDeck,
	executeAction,
}

export default actions
