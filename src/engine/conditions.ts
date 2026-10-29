/**
 * Quiz Duel — Card Play Conditions
 * Derived from oskarrough/slaytheweb (src/game/conditions.js)
 * License: AGPL-3.0-or-later (port-with-attribution)
 */

import type {GameState} from './actions'
import type {CardCondition, CardInstance} from './cards'
import type {Subject} from './config'

function isGameState(val: unknown): val is GameState {
	return Boolean(val && typeof val === 'object' && 'players' in val && Array.isArray((val as GameState).players))
}

/**
 * Returns true if every card currently in the player's hand belongs to `subject`.
 * Used by M8 Clash ("Playable only if every card in your hand is a maths card").
 */
export function onlySubjectInHand(
	state: GameState,
	subject: Subject,
	playerIndex: 0 | 1 = state.activePlayer,
): boolean {
	if (!state?.players) return false
	const player = state.players[playerIndex]
	if (!player || player.hand.length === 0) return false
	return player.hand.every((card) => card.subject === subject)
}

/**
 * Evaluates all conditions attached to a card against the current GameState.
 */
export function conditionsAreValid(
	state: GameState,
	conditions?: CardCondition[],
	playerIndex: 0 | 1 = state.activePlayer,
): boolean {
	if (!conditions || conditions.length === 0) return true
	return conditions.every((cond) => {
		if (cond.type === 'onlySubjectInHand') {
			return onlySubjectInHand(state, cond.subject, playerIndex)
		}
		return false
	})
}

/**
 * Checks whether a single card can be played by the specified player right now.
 * Supports both `(state, card, playerIndex)` and `(card, state, playerIndex)` call signatures.
 */
export function canPlay(
	stateOrCard: GameState | CardInstance,
	cardOrState: CardInstance | GameState,
	playerIndex?: 0 | 1,
): boolean {
	const state = isGameState(stateOrCard) ? stateOrCard : isGameState(cardOrState) ? cardOrState : null
	const card = isGameState(stateOrCard) ? (cardOrState as CardInstance) : (stateOrCard as CardInstance)
	if (!state || !card) return false

	const idx: 0 | 1 = playerIndex ?? state.activePlayer
	const player = state.players[idx]
	if (!player) return false
	if (player.mana < card.cost) return false
	return conditionsAreValid(state, card.conditions, idx)
}

/**
 * Checks whether a sequence of selected cards from the player's hand can be thrown together.
 * Evaluates total mana cost and per-card play conditions.
 * Supports both `(state, cardsOrIds, playerIndex)` and `(cardsOrIds, state, playerIndex)` call signatures,
 * as well as `string[]` (instance IDs) or `CardInstance[]`.
 */
export function canThrowSelection(
	stateOrSelection: GameState | Array<string | CardInstance>,
	selectionOrState: Array<string | CardInstance> | GameState,
	playerIndex?: 0 | 1,
): boolean {
	const state = isGameState(stateOrSelection)
		? stateOrSelection
		: isGameState(selectionOrState)
			? selectionOrState
			: null
	const selection = Array.isArray(stateOrSelection)
		? stateOrSelection
		: Array.isArray(selectionOrState)
			? selectionOrState
			: []

	if (!state || selection.length === 0) return false
	const idx: 0 | 1 = playerIndex ?? state.activePlayer
	const player = state.players[idx]
	if (!player) return false

	let totalCost = 0
	const selectedCards: CardInstance[] = []

	for (const item of selection) {
		const card = typeof item === 'string' ? player.hand.find((c) => c.instanceId === item) : item
		if (!card) return false
		totalCost += card.cost
		selectedCards.push(card)
	}

	if (totalCost > player.mana) return false

	for (const card of selectedCards) {
		if (!conditionsAreValid(state, card.conditions, idx)) {
			return false
		}
	}

	return true
}
