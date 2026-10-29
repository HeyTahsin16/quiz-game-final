/**
 * Quiz Duel — Engine, Actions, Quiz Resolution, Keywords & Replay Unit Tests
 * Derived from oskarrough/slaytheweb (tests/actions.js, tests/powers.js, tests/game.js)
 * License: AGPL-3.0-or-later (port-with-attribution)
 */

import test from 'ava'
import {produce} from 'immer'
import {replayActionLog} from '../src/engine/action-manager'
import actions from '../src/engine/actions'
import {createCard} from '../src/engine/cards'
import {canPlay} from '../src/engine/conditions'
import {CHARACTERS} from '../src/engine/config'
import createNewGame from '../src/engine/game'
import {runSimulation} from '../src/engine/sim'

test('new match initializes two players with their balanced character starting HP, 5 mana, and 5 cards in hand', (t) => {
	const state = actions.createNewState({
		player0Character: 'samurai',
		player1Character: 'reaper',
		seed: 101,
	})

	t.is(state.players.length, 2)
	t.is(state.activePlayer, 0)
	t.is(state.round, 1)
	t.is(state.status, 'playing')

	t.is(state.players[0].maxHealth, 80)
	t.is(state.players[1].maxHealth, 101)

	for (const idx of [0, 1] as const) {
		const p = state.players[idx]
		const expectedHp = CHARACTERS[p.characterId].startingHp
		t.is(p.maxHealth, expectedHp)
		t.is(p.currentHealth, expectedHp)
		t.is(p.mana, 5)
		t.is(p.maxMana, 5)
		t.is(p.block, 0)
		t.is(p.deck.length, 24)
		t.is(p.hand.length, 5)
		t.is(p.drawPile.length, 19)
		t.is(p.discardPile.length, 0)
	}
})

test('persistent mana pool: spending mana keeps remaining mana, turn start adds +1, Skip adds +1 extra (max 5)', (t) => {
	// Use Samurai (affinity: maths, weakness: biology) vs Dark Ninja (affinity: chemistry, weakness: physics)
	let state = actions.createNewState({
		player0Character: 'samurai',
		player1Character: 'dark-ninja',
		seed: 202,
	})

	// Play a 2-cost Carnage (M9) from Player 0
	const carnage = createCard('M9')
	state = actions.playCard(state, {playerIndex: 0, card: carnage, answer: 'wrong'})
	t.is(state.players[0].mana, 3, '5 - 2 = 3 mana remaining')

	// End Player 0 turn -> Player 1 turn starts (Player 1 already at 5 mana, capped at 5)
	state = actions.endTurn(state)
	t.is(state.activePlayer, 1)
	t.is(state.players[1].mana, 5)

	// Player 1 spends 3 mana on Corpse Explosion (C19) then ends turn
	const corpseExplosion = createCard('C19')
	state = actions.playCard(state, {playerIndex: 1, card: corpseExplosion, answer: 'correct'})
	t.is(state.players[1].mana, 2)

	// End Player 1 turn -> Round 2 starts, Player 0 gets +1 mana (3 -> 4)
	state = actions.endTurn(state)
	t.is(state.activePlayer, 0)
	t.is(state.round, 2)
	t.is(state.players[0].mana, 4)

	// Player 1 skips on their next turn: +1 from turn start (2 -> 3) + 1 from skip (3 -> 4)
	state = actions.endTurn(state)
	t.is(state.activePlayer, 1)
	t.is(state.players[1].mana, 3)
	state = actions.skipTurn(state)
	t.is(state.players[1].mana, 4)
})

test('quiz resolution: Normal & Uncommon cards are nullified on correct answer and deal full effect on wrong/timeout', (t) => {
	// Dark Ninja vs Dark Ninja so Maths is neutral (x1.0 out, x1.0 in)
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 303,
	})

	const strike = createCard('M1') // Normal, Deal 6
	const carnage = createCard('M9') // Uncommon, Deal 20

	// Answered right -> Nullified (0 damage)
	state = actions.playCard(state, {playerIndex: 0, card: strike, answer: 'correct'})
	t.is(state.lastQuizResult?.resolution, 'nullified')
	t.is(state.players[1].currentHealth, 88)

	state = actions.playCard(state, {playerIndex: 0, card: carnage, answer: 'correct'})
	t.is(state.lastQuizResult?.resolution, 'nullified')
	t.is(state.players[1].currentHealth, 88)

	// Reset mana and answer wrong -> Full effect (6 + 20 = 26 damage)
	state = produce(state, (draft) => {
		draft.players[0].mana = 5
	})
	state = actions.playCard(state, {playerIndex: 0, card: strike, answer: 'wrong'})
	t.is(state.lastQuizResult?.resolution, 'full')
	t.is(state.players[1].currentHealth, 82)

	state = actions.playCard(state, {playerIndex: 0, card: carnage, answer: 'timeout'})
	t.is(state.lastQuizResult?.resolution, 'full')
	t.is(state.players[1].currentHealth, 62)
})

test('quiz resolution: Epic & Legendary cards are reduced (35% or custom reducedEffects) on correct answer', (t) => {
	// Dark Ninja vs Dark Ninja (Maths is neutral 1.0x)
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 404,
	})

	// Bludgeon (M18, Epic, Deal 32): 35% of 32 = round(11.2) = 11
	const bludgeon = createCard('M18')
	state = actions.playCard(state, {playerIndex: 0, card: bludgeon, answer: 'correct'})
	t.is(state.lastQuizResult?.resolution, 'reduced')
	t.is(state.players[1].currentHealth, 88 - 11)

	// Elixir of Life (B20, Legendary, Heal 30 + Cure all; reduced: Heal 10, no cure)
	state = actions.setHealth(state, {playerIndex: 0, amount: 40})
	state = actions.setPower(state, {playerIndex: 0, power: 'poison', amount: 4})
	state = produce(state, (draft) => {
		draft.players[0].mana = 5
	})

	const elixir = createCard('B20')
	state = actions.playCard(state, {playerIndex: 0, card: elixir, answer: 'correct'})
	t.is(state.players[0].currentHealth, 50, 'healed 10 from reduced form')
	t.is(state.players[0].powers.poison, 4, 'debuffs not cured in reduced form')
})

test('throwCards and resolveQuizAnswer process multi-card throws in selection order', (t) => {
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 505,
	})

	const c1 = createCard('M1', false, 505, 901) // Strike (cost 1, deal 6)
	const c2 = createCard('P1', false, 505, 902) // Defend (cost 1, block 5)
	state = actions.discardHand(state, {playerIndex: 0})
	state = actions.addCardToHand(state, {playerIndex: 0, card: c1})
	state = actions.addCardToHand(state, {playerIndex: 0, card: c2})

	state = actions.throwCards(state, {
		playerIndex: 0,
		cardInstanceIds: [c1.instanceId, c2.instanceId],
	})

	t.is(state.status, 'quizzing')
	t.is(state.players[0].mana, 3, 'mana deducted immediately on throw')
	t.is(state.pendingThrow.length, 2)

	// First quiz: wrong -> Strike deals 6
	state = actions.resolveQuizAnswer(state, {answer: 'wrong'})
	t.is(state.players[1].currentHealth, 82)
	t.is(state.status, 'quizzing')
	t.is(state.pendingThrow.length, 1)

	// Second quiz: wrong -> Defend grants 5 Block
	state = actions.resolveQuizAnswer(state, {answer: 'wrong'})
	t.is(state.players[0].block, 5)
	t.is(state.status, 'playing')
	t.is(state.pendingThrow.length, 0)
})

test('powers & keywords: Strength, Weak, Vulnerable, Block, Corrode, Anti-heal, Ward, Cure', (t) => {
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 606,
	})

	// Give P0 +2 Strength and Weak 1; give P1 Vulnerable 1
	state = actions.setPower(state, {playerIndex: 0, power: 'strength', amount: 2})
	state = actions.setPower(state, {playerIndex: 0, power: 'weak', amount: 1})
	state = actions.setPower(state, {playerIndex: 1, power: 'vulnerable', amount: 1})

	// Strike base 6 + 2 Strength = 8; Weak (0.75) * Vulnerable (1.5) = 1.125 -> round(8 * 1.125) = 9
	const strike = createCard('M1')
	state = actions.playCard(state, {playerIndex: 0, card: strike, answer: 'wrong'})
	t.is(state.players[1].currentHealth, 88 - 9)

	// Corrode reduces Block gained by 25%: Defend (5) -> round(5 * 0.75) = 4
	state = actions.setPower(state, {playerIndex: 0, power: 'corrode', amount: 2})
	const defend = createCard('P1')
	state = actions.playCard(state, {playerIndex: 0, card: defend, answer: 'wrong'})
	t.is(state.players[0].block, 4)

	// Ward negates incoming debuffs
	state = actions.setPower(state, {playerIndex: 1, power: 'ward', amount: 1})
	const deadlyPoison = createCard('C1') // Apply 5 Poison
	state = produce(state, (draft) => {
		draft.players[0].mana = 5
	})
	state = actions.playCard(state, {playerIndex: 0, card: deadlyPoison, answer: 'wrong'})
	t.is(state.players[1].powers.poison, undefined, 'Ward negated Poison')
	t.is(state.players[1].powers.ward, undefined, 'Ward stack consumed')

	// Anti-heal reduces healing by 50%
	state = actions.setHealth(state, {playerIndex: 0, amount: 50})
	state = actions.setPower(state, {playerIndex: 0, power: 'antiHeal', amount: 2})
	const bandage = createCard('B1') // Heal 4 -> 2
	state = actions.playCard(state, {playerIndex: 0, card: bandage, answer: 'wrong'})
	t.is(state.players[0].currentHealth, 52)
})

test('Phoenix revives once at 30% (or 10% reduced) max HP when fatal damage is taken', (t) => {
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 707,
	})

	// Play Phoenix (B19) on Player 1 with full effect (30% of 88 = round(26.4) = 26 HP)
	const phoenix = createCard('B19')
	state = actions.playCard(state, {playerIndex: 1, card: phoenix, answer: 'wrong'})
	t.is(state.players[1].powers.phoenix, 30)

	// Deal fatal 88 damage to Player 1
	state = actions.removeHealth(state, {playerIndex: 1, amount: 88})
	t.is(state.status, 'playing', 'match continues because Phoenix revived Player 1')
	t.is(state.players[1].currentHealth, 26)
	t.true(state.players[1].phoenixUsed)
	t.is(state.players[1].powers.phoenix, undefined)

	// Deal fatal 26 damage again -> now Player 1 dies and Player 0 wins
	state = actions.removeHealth(state, {playerIndex: 1, amount: 26})
	t.is(state.status, 'finished')
	t.is(state.winner, 0)
})

test('Stun skips the target next turn and grants 2 rounds of Stun immunity', (t) => {
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 808,
	})

	const paralyticGas = createCard('C18') // Stun opponent
	state = actions.playCard(state, {playerIndex: 0, card: paralyticGas, answer: 'wrong'})
	t.is(state.players[1].powers.stun, 1)

	// When Player 0 ends turn, Player 1 starts turn, is immediately skipped by Stun, and control returns to Player 0!
	state = actions.endTurn(state)
	t.is(state.activePlayer, 0, 'Player 1 turn was skipped and control returned to Player 0')
	t.is(state.players[1].powers.stun, undefined)
	t.is(state.players[1].powers.stunImmune, 2, 'Player 1 has 2 rounds of Stun immunity')

	// Attempting to stun Player 1 while stunImmune is active does nothing
	state = produce(state, (draft) => {
		draft.players[0].mana = 5
	})
	state = actions.playCard(state, {playerIndex: 0, card: paralyticGas, answer: 'wrong'})
	t.is(state.players[1].powers.stun, undefined)
})

test('Clash condition: only playable when every card in hand is a Maths card', (t) => {
	let state = actions.createNewState({
		player0Character: 'samurai',
		player1Character: 'knight',
		seed: 909,
	})
	state = actions.discardHand(state, {playerIndex: 0})

	const clash = createCard('M8')
	state = actions.addCardToHand(state, {playerIndex: 0, card: clash})
	t.true(canPlay(state, clash, 0), 'playable when only Maths cards are in hand')

	const defend = createCard('P1')
	state = actions.addCardToHand(state, {playerIndex: 0, card: defend})
	t.false(canPlay(state, clash, 0), 'not playable when a Physics card is in hand')
})

test('Fatigue starts at round 25 and deals 2 * (round - 24) HP at turn start', (t) => {
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 1010,
	})
	state = produce(state, (draft) => {
		draft.round = 25
	})
	state = actions.startTurn(state)
	t.is(state.players[0].currentHealth, 86, 'lost 2 * (25 - 24) = 2 HP at round 25')
})

test('ActionManager enqueue, dequeue, undo, redo, and replayActionLog work identically', (t) => {
	const game = createNewGame({
		player0Character: 'samurai',
		player1Character: 'knight',
		seed: 1111,
	})
	const initialSnapshot = JSON.parse(JSON.stringify(game.state))

	const card0 = game.state.players[0].hand[0]
	t.truthy(card0)
	if (!card0) return

	game.enqueue({type: 'throwCards', playerIndex: 0, cardInstanceIds: [card0.instanceId]})
	t.is(game.future.list.length, 1)
	game.dequeue()
	t.is(game.state.status, 'quizzing')

	// Test undo & redo
	game.undo()
	t.is(game.state.status, 'playing')
	game.redo()
	t.is(game.state.status, 'quizzing')

	game.run({type: 'resolveQuizAnswer', answer: 'wrong'})
	game.run({type: 'endTurn'})

	const replayed = replayActionLog(initialSnapshot, game.getActionLog())
	t.deepEqual(replayed, game.state)
})

test('skipTurn grants +1 bonus mana only when throwsThisTurn is 0', (t) => {
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 1212,
	})
	t.is(state.throwsThisTurn, 0)

	// Spend 3 mana by playing a 3-cost card -> mana drops to 2, throwsThisTurn becomes 1
	const bludgeon = createCard('M18') // cost 3
	state = actions.playCard(state, {playerIndex: 0, card: bludgeon, answer: 'wrong'})
	t.is(state.players[0].mana, 2)
	t.is(state.throwsThisTurn, 1)

	// Calling skipTurn after throwing a card does NOT grant +1 bonus mana
	state = actions.skipTurn(state)
	t.is(state.players[0].mana, 2, 'no bonus mana when throwsThisTurn > 0')
	t.is(state.activePlayer, 1)
	t.is(state.throwsThisTurn, 0, 'throwsThisTurn resets at start of next turn')

	// Player 1 reduces mana artificially without throwing, then skips -> gets +1 bonus mana
	state = produce(state, (draft) => {
		draft.players[1].mana = 2
	})
	state = actions.skipTurn(state)
	t.is(state.players[1].mana, 3, '+1 bonus mana granted when throwsThisTurn === 0')
})

test('Poison ticks direct HP at turn start bypassing Block and decrements by 1 each round', (t) => {
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 1313,
	})

	// Give Player 0 10 Block and 4 Poison
	state = actions.setPower(state, {playerIndex: 0, power: 'poison', amount: 4})
	state = produce(state, (draft) => {
		draft.players[0].block = 10
		draft.players[0].powers.barricade = 1 // Keep block across turn start to verify Poison bypasses Block
	})

	state = actions.startTurn(state)
	t.is(state.players[0].block, 10, 'Poison bypasses Block completely')
	t.is(state.players[0].currentHealth, 84, 'Poison dealt 4 direct HP')
	t.is(state.players[0].powers.poison, 3, 'Poison decremented from 4 to 3')
})

test('Parasite ticks direct HP at turn start bypassing Block and increments by +1 each round until cured', (t) => {
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 1414,
	})

	// Give Player 0 10 Block and 2 Parasite
	state = actions.setPower(state, {playerIndex: 0, power: 'parasite', amount: 2})
	state = produce(state, (draft) => {
		draft.players[0].block = 10
		draft.players[0].powers.barricade = 1
	})

	// Turn start 1: ticks for 2, grows to 3
	state = actions.startTurn(state)
	t.is(state.players[0].block, 10, 'Parasite bypasses Block')
	t.is(state.players[0].currentHealth, 86, 'Parasite dealt 2 direct HP')
	t.is(state.players[0].powers.parasite, 3, 'Parasite grew from 2 to 3')

	// Turn start 2: ticks for 3, grows to 4
	state = actions.startTurn(state)
	t.is(state.players[0].currentHealth, 83, 'Parasite dealt 3 direct HP')
	t.is(state.players[0].powers.parasite, 4, 'Parasite grew from 3 to 4')

	// Antidote (B5) cures Parasite
	const antidote = createCard('B5')
	state = actions.playCard(state, {playerIndex: 0, card: antidote, answer: 'wrong'})
	t.is(state.players[0].powers.parasite, undefined, 'Parasite cured by Antidote')
})

test('Reflect (Flame Barrier) reflects percentage of incoming damage back to attacker and clears on owner next turn start', (t) => {
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 1515,
	})

	// Player 0 plays Flame Barrier (M19, Legendary, reflect 60% full / 21% reduced)
	const flameBarrier = createCard('M19')
	state = actions.playCard(state, {playerIndex: 0, card: flameBarrier, answer: 'wrong'})
	t.is(state.players[0].powers.reflect, 60)

	// End Player 0 turn -> Player 1 turn starts; Player 0 still has reflect 60
	state = actions.endTurn(state)
	t.is(state.activePlayer, 1)
	t.is(state.players[0].powers.reflect, 60)

	// Player 1 hits Player 0 with Carnage (M9, Deal 20) -> P0 takes 20, P1 takes round(20 * 0.6) = 12 reflected
	const carnage = createCard('M9')
	state = actions.playCard(state, {playerIndex: 1, card: carnage, answer: 'wrong'})
	t.is(state.players[0].currentHealth, 68)
	t.is(state.players[1].currentHealth, 76, 'Attacker took 12 reflected damage (60% of 20)')

	// End Player 1 turn -> Player 0 turn starts; reflect clears at start of owner turn
	state = actions.endTurn(state)
	t.is(state.activePlayer, 0)
	t.is(state.players[0].powers.reflect, undefined, 'Reflect cleared at start of owner turn')
})

test('Life steal & reduced forms scale both lifeSteal % and loseHp in Reaper (M17), Feed (M20), and Offering (P18)', (t) => {
	let state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'dark-ninja',
		seed: 1616,
	})

	// Damage Player 0 down to 40 HP
	state = actions.setHealth(state, {playerIndex: 0, amount: 40})

	// 1. Reaper (M17, Deal 10, Life steal 100%) on wrong answer -> deals 10, heals 100% of 10 = 10
	const reaper = createCard('M17')
	state = actions.playCard(state, {playerIndex: 0, card: reaper, answer: 'wrong'})
	t.is(state.players[1].currentHealth, 78)
	t.is(state.players[0].currentHealth, 50, 'Full Reaper dealt 10 and healed 10 (100% life steal)')

	// 2. Reaper (M17) on correct answer (35% reduced):
	// Damage: round(10 * 0.35) = 4; Life steal %: round(100 * 0.35) = 35%; Heal: round(4 * 0.35) = 1
	state = produce(state, (draft) => {
		draft.players[0].mana = 5
	})
	state = actions.playCard(state, {playerIndex: 0, card: reaper, answer: 'correct'})
	t.is(state.players[1].currentHealth, 74, 'Reduced Reaper dealt 4 damage')
	t.is(state.players[0].currentHealth, 51, 'Reduced Reaper healed round(4 * 35%) = 1 HP')

	// 3. Feed (M20, Deal 14, Life steal 50%, Raise max HP 4) on correct answer (35% reduced):
	// Damage: round(14 * 0.35) = 5; Life steal %: round(50 * 0.35) = 18%; Heal from lifesteal: round(5 * 0.18) = 1;
	// Raise max HP: round(4 * 0.35) = 1 (also heals +1 from maxHP increase) -> total HP 51 + 1 + 1 = 53, maxHP 89
	state = produce(state, (draft) => {
		draft.players[0].mana = 5
	})
	const feed = createCard('M20')
	state = actions.playCard(state, {playerIndex: 0, card: feed, answer: 'correct'})
	t.is(state.players[1].currentHealth, 69, 'Reduced Feed dealt 5 damage')
	t.is(state.players[0].maxHealth, 89, 'Reduced Feed raised max HP by 1')
	t.is(state.players[0].currentHealth, 53, 'Reduced Feed healed 1 from scaled lifesteal + 1 from max HP increase')

	// 4. Offering (P18, Lose 6 HP, Gain 2 mana, Draw 3) on correct answer (35% reduced):
	// Lose HP: round(6 * 0.35) = 2; Gain mana: round(2 * 0.35) = 1; Draw: round(3 * 0.35) = 1
	state = produce(state, (draft) => {
		draft.players[0].mana = 1
	})
	const handBefore = state.players[0].hand.length
	const offering = createCard('P18')
	state = actions.playCard(state, {playerIndex: 0, card: offering, answer: 'correct'})
	t.is(state.players[0].currentHealth, 51, 'Reduced Offering lost 2 HP instead of 6 HP')
	t.is(state.players[0].mana, 2, 'Reduced Offering gained 1 mana')
	t.is(state.players[0].hand.length, handBefore + 1, 'Reduced Offering drew 1 card')

	// 5. noLifeSteal (Hemostasis B18) prevents life steal healing completely
	state = actions.setPower(state, {playerIndex: 0, power: 'noLifeSteal', amount: 2})
	state = produce(state, (draft) => {
		draft.players[0].mana = 5
	})
	state = actions.playCard(state, {playerIndex: 0, card: reaper, answer: 'wrong'})
	t.is(state.players[1].currentHealth, 59, 'Reaper still dealt 10 damage')
	t.is(state.players[0].currentHealth, 51, 'noLifeSteal blocked Reaper from healing')
})

test('simulation runs random-bot battles with all invariants intact and deterministic replay', (t) => {
	const stats = runSimulation(25)
	t.is(stats.matchesCompleted, 25)
	t.is(stats.replaysVerified, 25)
	t.true(stats.totalCardsThrown > 0)
})

test('quizHistory records resolved quiz questions, selectedChoice, and bound question metadata for match result review', (t) => {
	let state = actions.createNewState({
		player0Character: 'samurai',
		player1Character: 'knight',
		seed: 2026,
	})

	t.deepEqual(state.quizHistory, [])

	const handCard = state.players[0].hand[0]
	t.truthy(handCard)
	if (!handCard) return

	state = actions.throwCards(state, {
		playerIndex: 0,
		cardInstanceIds: [handCard.instanceId],
	})
	state = actions.resolveQuizAnswer(state, {
		answer: 'wrong',
		selectedChoice: 2,
	})

	t.is(state.quizHistory.length, 1)
	const entry = state.quizHistory[0]
	t.truthy(entry)
	if (!entry) return
	t.is(entry.cardId, handCard.id)
	t.is(entry.answer, 'wrong')
	t.is(entry.selectedChoice, 2)
	t.is(entry.questionId, handCard.boundQuestionId)
	t.deepEqual(entry.boundChoices, handCard.boundChoices)
	t.is(entry.boundCorrectIndex, handCard.boundCorrectIndex)
})

