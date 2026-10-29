/**
 * Quiz Duel — 80-Card Catalog, Upgrades & Character Decks Unit Tests
 * Derived from oskarrough/slaytheweb (tests/cards.js)
 * License: AGPL-3.0-or-later (port-with-attribution)
 */

import test from 'ava'
import {produce} from 'immer'
import {CATALOG_CARDS} from '../src/content/cards'
import {buildCharacterDeck, CHARACTER_DECKS} from '../src/content/decks'
import {getQuestionById} from '../src/content/questions'
import actions from '../src/engine/actions'
import {createCard, previewCardDamage, upgradeCardInstance} from '../src/engine/cards'
import {CHARACTER_IDS, CHARACTERS, RARITIES, SUBJECTS} from '../src/engine/config'
import {assertGameStateInvariants} from '../src/engine/sim'

test('catalog contains exactly 80 cards (20 per subject: 8N, 6U, 4E, 2L)', (t) => {
	t.is(CATALOG_CARDS.length, 80)

	for (const subject of SUBJECTS) {
		const subCards = CATALOG_CARDS.filter((c) => c.subject === subject)
		t.is(subCards.length, 20, `${subject} has 20 cards`)
		t.is(subCards.filter((c) => c.rarity === 'normal').length, 8)
		t.is(subCards.filter((c) => c.rarity === 'uncommon').length, 6)
		t.is(subCards.filter((c) => c.rarity === 'epic').length, 4)
		t.is(subCards.filter((c) => c.rarity === 'legendary').length, 2)
	}
})

test('every catalog card can be instantiated and upgraded via createCard and upgradeCardInstance', (t) => {
	for (const def of CATALOG_CARDS) {
		const base = createCard(def.id, false, 100)
		const up = createCard(def.id, true, 100)
		const upFromInstance = upgradeCardInstance(base)

		t.is(base.id, def.id)
		t.false(base.upgraded)
		t.true(up.upgraded)
		t.true(up.name.endsWith('+'))
		t.is(up.rarity, base.rarity, 'upgraded card retains base rarity')
		t.deepEqual(up.effects, upFromInstance.effects)
		t.is(up.cost, upFromInstance.cost)
		t.true(RARITIES.includes(base.rarity))
	}
})

test('all 80 catalog cards (base, upgraded, and reduced forms) execute cleanly in the engine', (t) => {
	for (const def of CATALOG_CARDS) {
		for (const upgraded of [false, true]) {
			for (const answer of ['wrong', 'correct'] as const) {
				let state = actions.createNewState({
					player0Character: 'samurai',
					player1Character: 'knight',
					seed: 500,
				})
				const card = createCard(def.id, upgraded, 500, 99)

				// Prepare state so Clash (M8), Bane (C6), Catalyst (C11), Body Slam (P5), Cure, and Heals have active targets
				state = produce(state, (draft) => {
					draft.players[0].mana = 5
					draft.players[0].currentHealth = 50
					draft.players[0].block = 10
					draft.players[0].powers.poison = 3
					draft.players[0].powers.weak = 1
					draft.players[1].block = 8
					draft.players[1].powers.poison = 4
					if (def.id === 'M8') {
						draft.players[0].hand = [card]
					} else {
						draft.players[0].hand.push(card)
					}
				})

				state = actions.playCard(state, {playerIndex: 0, card, answer})
				assertGameStateInvariants(state, `card=${def.id}:up=${upgraded}:ans=${answer}`)
			}
		}
	}
	t.pass()
})

test('createCard supports lookup by name and name+ suffix', (t) => {
	const strike = createCard('Strike')
	t.is(strike.id, 'M1')
	t.false(strike.upgraded)

	const strikePlus = createCard('Strike+')
	t.is(strikePlus.id, 'M1')
	t.true(strikePlus.upgraded)
	t.is(strikePlus.name, 'Strike+')
	t.deepEqual(strikePlus.effects, [{type: 'damage', amount: 8}])
})

test('each of the 4 characters has a valid 24-card fixed deck matching rarity, subject, and copy-limit rules', (t) => {
	for (const charId of CHARACTER_IDS) {
		const charDef = CHARACTERS[charId]
		const recipe = CHARACTER_DECKS[charId]
		t.is(recipe.cardIds.length, 24, `${charId} has 24 cards`)

		const instances = buildCharacterDeck(charId, 42)
		t.is(instances.length, 24)
		t.true(
			instances.every((c) => !c.upgraded),
			`${charId} deck starts un-upgraded (Frame A)`,
		)

		// Rarity split: 10 normal, 8 uncommon, 4 epic, 2 legendary
		t.is(instances.filter((c) => c.rarity === 'normal').length, 10)
		t.is(instances.filter((c) => c.rarity === 'uncommon').length, 8)
		t.is(instances.filter((c) => c.rarity === 'epic').length, 4)
		t.is(instances.filter((c) => c.rarity === 'legendary').length, 2)

		// Copy limits: Normal <= 3, Uncommon <= 2, Epic <= 1, Legendary <= 1
		const countsById = new Map<string, number>()
		for (const inst of instances) {
			countsById.set(inst.id, (countsById.get(inst.id) || 0) + 1)
		}
		for (const inst of instances) {
			const count = countsById.get(inst.id) || 0
			if (inst.rarity === 'normal') t.true(count <= 3, `${charId} normal ${inst.id} copies <= 3`)
			if (inst.rarity === 'uncommon') t.true(count <= 2, `${charId} uncommon ${inst.id} copies <= 2`)
			if (inst.rarity === 'epic') t.is(count, 1, `${charId} epic ${inst.id} is unique`)
			if (inst.rarity === 'legendary') t.is(count, 1, `${charId} legendary ${inst.id} is unique`)
		}

		// Subject split: 10 affinity, 2 weakness, 6 and 6 of the other two
		const affinityCount = instances.filter((c) => c.subject === charDef.affinity).length
		const weaknessCount = instances.filter((c) => c.subject === charDef.weakness).length
		t.is(affinityCount, 10, `${charId} has 10 cards in affinity (${charDef.affinity})`)
		t.is(weaknessCount, 2, `${charId} has 2 cards in weakness (${charDef.weakness})`)

		for (const subj of SUBJECTS) {
			if (subj !== charDef.affinity && subj !== charDef.weakness) {
				t.is(
					instances.filter((c) => c.subject === subj).length,
					6,
					`${charId} has 6 cards in neutral subject (${subj})`,
				)
			}
		}
	}
})

test('initMatch binds a unique matching QuizQuestion to every card in both players decks', (t) => {
	const state = actions.createNewState({
		player0Character: 'dark-ninja',
		player1Character: 'samurai',
		seed: 777,
	})

	for (const pIdx of [0, 1] as const) {
		const deck = state.players[pIdx].deck
		t.is(deck.length, 24)
		const seenIds = new Set<string>()
		for (const card of deck) {
			t.truthy(card.boundQuestionId, `Card ${card.id} has a boundQuestionId`)
			if (!card.boundQuestionId) continue
			t.false(seenIds.has(card.boundQuestionId), `No duplicate question IDs in player ${pIdx} deck`)
			seenIds.add(card.boundQuestionId)

			const q = getQuestionById(card.boundQuestionId)
			t.truthy(q)
			t.is(q?.subject, card.subject)
			t.is(q?.rarity, card.rarity)
		}
	}
})

test('previewCardDamage matches the single damage pipeline for affinity, weakness, statuses and quizScale', (t) => {
	// Dark Ninja (affinity: chemistry, weakness: physics) vs Knight (affinity: physics, weakness: chemistry)
	// Chemistry card thrown by Dark Ninja (+25% out) against Knight (+25% incoming weakness):
	// round(10 * 1.25 * 1.0 * 1.25 * 1.0) = round(15.625) = 16
	const chemHit = previewCardDamage(10, 'chemistry', 'dark-ninja', 'knight')
	t.is(chemHit, 16)

	// Physics card thrown by Dark Ninja (-25% out weakness) against Knight (-25% incoming affinity):
	// round(10 * 0.75 * 1.0 * 0.75 * 1.0) = round(5.625) = 6
	const physHit = previewCardDamage(10, 'physics', 'dark-ninja', 'knight')
	t.is(physHit, 6)
})

test('role-lint: all 80 catalog cards strictly respect their subject role boundaries', (t) => {
	for (const card of CATALOG_CARDS) {
		const allEffects = [...card.effects, ...(card.reducedEffects ?? [])]

		if (card.subject === 'maths') {
			// Maths (Offence): cannot grant Block or non-lifesteal Heal/Regen/Cure/Ward/Debuffs
			for (const eff of allEffects) {
				t.false(
					[
						'block',
						'conditionalNoBlock',
						'doubleBlock',
						'heal',
						'nextTurnHeal',
						'geneticHeal',
						'regen',
						'cure',
						'banePoison',
						'doubleOpponentPoison',
						'poisonBurst',
						'stunOpponent',
					].includes(eff.type),
					`Maths card ${card.id} (${card.name}) has forbidden effect ${eff.type}`,
				)
				if (eff.type === 'applyPower') {
					t.true(
						['strength', 'doubleTap', 'demonForm', 'reflect'].includes(eff.power),
						`Maths card ${card.id} (${card.name}) applies non-Maths power ${eff.power}`,
					)
				}
			}
		} else if (card.subject === 'physics') {
			// Physics (Defence & Offence): cannot have lifeSteal, reflect, heal, regen, poison, parasite, or stun
			for (const eff of allEffects) {
				t.false(
					[
						'lifeSteal',
						'heal',
						'nextTurnHeal',
						'geneticHeal',
						'regen',
						'cure',
						'banePoison',
						'doubleOpponentPoison',
						'poisonBurst',
						'stunOpponent',
					].includes(eff.type),
					`Physics card ${card.id} (${card.name}) has forbidden effect ${eff.type}`,
				)
				if (eff.type === 'applyPower') {
					t.true(
						['tempStrength', 'metallicize', 'barricade', 'barricadeOneTurn', 'juggernaut'].includes(eff.power),
						`Physics card ${card.id} (${card.name}) applies non-Physics power ${eff.power}`,
					)
				}
			}
		} else if (card.subject === 'chemistry') {
			// Chemistry (Debuffs): cannot deal direct hit damage, cannot heal, and cannot grant Block
			for (const eff of allEffects) {
				t.false(
					[
						'damage',
						'damageEqualToBlock',
						'rampageDamage',
						'lifeSteal',
						'block',
						'conditionalNoBlock',
						'doubleBlock',
						'heal',
						'nextTurnHeal',
						'geneticHeal',
						'regen',
						'cure',
					].includes(eff.type),
					`Chemistry card ${card.id} (${card.name}) has forbidden effect ${eff.type}`,
				)
				if (eff.type === 'applyPower') {
					t.true(
						[
							'poison',
							'weak',
							'vulnerable',
							'nextTurnStrengthLoss',
							'corrode',
							'noxiousFumes',
							'parasite',
							'antiHeal',
							'envenom',
							'envenomOnce',
						].includes(eff.power),
						`Chemistry card ${card.id} (${card.name}) applies non-Chemistry power ${eff.power}`,
					)
				}
			}
		} else if (card.subject === 'biology') {
			// Biology (Sustain): cannot deal damage (direct, poison, parasite, reflect, or juggernaut) or grant Block
			for (const eff of allEffects) {
				t.false(
					[
						'damage',
						'damageEqualToBlock',
						'rampageDamage',
						'lifeSteal',
						'block',
						'conditionalNoBlock',
						'doubleBlock',
						'banePoison',
						'doubleOpponentPoison',
						'poisonBurst',
						'stunOpponent',
					].includes(eff.type),
					`Biology card ${card.id} (${card.name}) has forbidden effect ${eff.type}`,
				)
				if (eff.type === 'applyPower') {
					t.true(
						['ward', 'selfRepair', 'apparition', 'antiHeal', 'noLifeSteal', 'phoenix'].includes(eff.power),
						`Biology card ${card.id} (${card.name}) applies non-Biology power ${eff.power}`,
					)
				}
			}
		}
	}
})
