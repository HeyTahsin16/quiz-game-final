/**
 * Quiz Duel — Card Types, Factory & Matchup Number Formatter
 * Derived from oskarrough/slaytheweb (src/game/cards.js)
 * License: AGPL-3.0-or-later (port-with-attribution)
 */

import {CATALOG_BY_ID, CATALOG_BY_NAME, CATALOG_CARDS} from '../content/cards'
import {CHARACTERS, type CharacterId, ENGINE_CONFIG, type Rarity, type Subject} from './config'
import type {PlayerPowers} from './powers'
import {createDeterministicId} from './utils'

export type CardTarget = 'self' | 'opponent'
export type CardOrigin = 'StS' | 'StS adapted' | 'new'

export type CardEffect =
	| {type: 'damage'; amount: number; hits?: number; strengthMultiplier?: number}
	| {type: 'damageEqualToBlock'}
	| {type: 'rampageDamage'; base: number; increment: number}
	| {type: 'block'; amount: number}
	| {type: 'conditionalNoBlock'; amount: number}
	| {type: 'doubleBlock'}
	| {type: 'removeOpponentBlock'}
	| {type: 'heal'; amount: number}
	| {type: 'geneticHeal'; base: number; increment: number}
	| {type: 'nextTurnHeal'; amount: number}
	| {type: 'regen'; amount: number; rounds: number}
	| {type: 'loseHp'; amount: number}
	| {type: 'raiseMaxHp'; amount: number}
	| {type: 'lifeSteal'; percent: number}
	| {type: 'draw'; amount: number}
	| {type: 'gainMana'; amount: number}
	| {type: 'doubleMana'}
	| {type: 'nextTurnExtraMana'; amount: number}
	| {type: 'stealMana'; amount: number}
	| {type: 'opponentLoseMana'; amount: number}
	| {type: 'applyPower'; target: CardTarget; power: keyof PlayerPowers; amount: number}
	| {type: 'banePoison'; base: number; ifPoisoned: number}
	| {type: 'doubleOpponentPoison'}
	| {type: 'poisonBurst'}
	| {type: 'stunOpponent'}
	| {type: 'cure'; debuffs: 'all' | Array<keyof PlayerPowers>}
	| {type: 'addCopyToDiscard'}
	| {type: 'exhaustRandomFromHand'; count: number}
	| {type: 'exhaustNonMathsInHand'}
	| {type: 'upgradeOneInHand'}
	| {type: 'upgradeAllInDeck'}
	| {type: 'upgradeAllInHand'}

export interface CardCondition {
	type: 'onlySubjectInHand'
	subject: Subject
}

export interface CardDefinition {
	id: string
	name: string
	subject: Subject
	rarity: Rarity
	cost: number
	target: CardTarget
	effects: CardEffect[]
	reducedEffects?: CardEffect[]
	text: string
	reducedText?: string
	power?: boolean
	exhaust?: boolean
	conditions?: CardCondition[]
	origin: CardOrigin
	upgraded?: boolean
	upgrade: (card: CardDefinition) => CardDefinition
}

export interface CardInstance {
	instanceId: string
	id: string
	name: string
	subject: Subject
	rarity: Rarity
	cost: number
	target: CardTarget
	effects: CardEffect[]
	reducedEffects?: CardEffect[]
	text: string
	reducedText?: string
	power: boolean
	exhaust: boolean
	conditions?: CardCondition[]
	origin: CardOrigin
	upgraded: boolean
	boundQuestionId?: string
	boundChoices?: [string, string, string, string]
	boundCorrectIndex?: 0 | 1 | 2 | 3
}

let instanceSeq = 1

export function resetCardInstanceSequence(): void {
	instanceSeq = 1
}

/**
 * Creates a serializable plain-object CardInstance from a catalog ID (e.g. 'M1') or name (e.g. 'Strike' or 'Strike+').
 */
export function createCard(idOrName: string, shouldUpgrade = false, seed = 1337, customCounter?: number): CardInstance {
	let lookup = idOrName.trim()
	let upgradeRequested = shouldUpgrade

	if (lookup.endsWith('+')) {
		lookup = lookup.slice(0, -1)
		upgradeRequested = true
	}

	const baseDef = CATALOG_BY_ID.get(lookup) || CATALOG_BY_NAME.get(lookup)
	if (!baseDef) {
		throw new Error(`Card not found in catalog: ${idOrName}`)
	}

	const def = upgradeRequested ? baseDef.upgrade(baseDef) : baseDef
	const counter = customCounter ?? instanceSeq++
	const instanceId = createDeterministicId(def.id, seed, counter)

	const instance: CardInstance = {
		instanceId,
		id: def.id,
		name: upgradeRequested && !def.name.endsWith('+') ? `${def.name}+` : def.name,
		subject: def.subject,
		rarity: baseDef.rarity, // Section 5: Upgraded (frame B) cards use the rarity of their base card
		cost: def.cost,
		target: def.target,
		effects: def.effects.map((e) => ({...e})),
		text: def.text,
		power: Boolean(def.power),
		exhaust: Boolean(def.exhaust),
		origin: def.origin,
		upgraded: upgradeRequested || Boolean(def.upgraded),
	}
	if (def.reducedEffects) {
		instance.reducedEffects = def.reducedEffects.map((e) => ({...e}))
	}
	if (def.reducedText !== undefined) {
		instance.reducedText = def.reducedText
	}
	if (def.conditions) {
		instance.conditions = def.conditions.map((c) => ({...c}))
	}
	return instance
}

/**
 * Upgrades an existing CardInstance in place (preserving its instanceId and boundQuestionId).
 */
export function upgradeCardInstance(card: CardInstance): CardInstance {
	if (card.upgraded) return card
	const baseDef = CATALOG_BY_ID.get(card.id)
	if (!baseDef) return card
	const upDef = baseDef.upgrade(baseDef)
	const nextCard: CardInstance = {
		...card,
		name: upDef.name.endsWith('+') ? upDef.name : `${upDef.name}+`,
		cost: upDef.cost,
		effects: upDef.effects.map((e) => ({...e})),
		text: upDef.text,
		upgraded: true,
	}
	if (upDef.reducedEffects) {
		nextCard.reducedEffects = upDef.reducedEffects.map((e) => ({...e}))
	}
	return nextCard
}

/**
 * Computes the single-hit preview damage for a card in the current matchup (as Slay the Spire does).
 */
export function previewCardDamage(
	baseDamage: number,
	cardSubject: Subject,
	attackerChar: CharacterId,
	defenderChar: CharacterId,
	attackerPowers: PlayerPowers = {},
	defenderPowers: PlayerPowers = {},
	strengthMultiplier = 1,
	quizScale = 1,
): number {
	if (quizScale <= 0) return 0
	const effStrength =
		(attackerPowers.strength || 0) + (attackerPowers.tempStrength || 0) - (attackerPowers.nextTurnStrengthLoss || 0)
	const buffed = Math.max(0, baseDamage + effStrength * strengthMultiplier)
	if (buffed === 0) return 0

	const atk = CHARACTERS[attackerChar]
	const def = CHARACTERS[defenderChar]

	const outAff =
		cardSubject === atk.affinity
			? ENGINE_CONFIG.affinityMultiplier.outgoingAffinity
			: cardSubject === atk.weakness
				? ENGINE_CONFIG.affinityMultiplier.outgoingWeakness
				: 1.0

	const inAff =
		cardSubject === def.affinity
			? ENGINE_CONFIG.affinityMultiplier.incomingAffinity
			: cardSubject === def.weakness
				? ENGINE_CONFIG.affinityMultiplier.incomingWeakness
				: 1.0

	let statusMod = 1.0
	if ((attackerPowers.weak || 0) > 0) statusMod *= 0.75
	if ((defenderPowers.vulnerable || 0) > 0) statusMod *= 1.5

	const raw = Math.round(buffed * outAff * statusMod * inAff * quizScale)
	return baseDamage > 0 && quizScale > 0 ? Math.max(1, raw) : raw
}

export {CATALOG_BY_ID, CATALOG_BY_NAME, CATALOG_CARDS}
