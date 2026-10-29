/**
 * Quiz Duel — Action Manager & Serializable Action Log Replay
 * Derived from oskarrough/slaytheweb (src/game/action-manager.js)
 * License: AGPL-3.0-or-later (port-with-attribution)
 */

import {executeAction, type GameAction, type GameState} from './actions'
import {Queue} from './utils'

export interface FutureActionItem {
	action: GameAction
}

export interface PastActionItem {
	action: GameAction
	state: GameState
}

export interface ActionManagerInstance {
	enqueue: (action: GameAction) => void
	dequeue: (state: GameState) => GameState
	undo: () => PastActionItem | undefined
	redo: () => PastActionItem | undefined
	getActionLog: () => GameAction[]
	replayActionLog: (initialState: GameState, actionLog: readonly GameAction[]) => GameState
	future: Queue<FutureActionItem>
	past: Queue<PastActionItem>
	redoStack: Queue<PastActionItem>
}

export default function ActionManager(props: {debug?: boolean} = {}): ActionManagerInstance {
	const future = new Queue<FutureActionItem>()
	const past = new Queue<PastActionItem>()
	const redoStack = new Queue<PastActionItem>()

	function enqueue(action: GameAction): void {
		if (props.debug) console.log('am:enqueue', action)
		future.enqueue({action})
		redoStack.list = []
	}

	function dequeue(state: GameState): GameState {
		const item = future.dequeue()
		const action = item?.action
		if (props.debug) console.log('am:dequeue', action)
		if (!action) return state

		const nextState = executeAction(state, action)
		past.enqueue({action, state})
		return nextState
	}

	function undo(): PastActionItem | undefined {
		if (props.debug) console.log('am:undo')
		const item = past.list.pop()
		if (item) {
			redoStack.enqueue(item)
		}
		return item
	}

	function redo(): PastActionItem | undefined {
		if (props.debug) console.log('am:redo')
		const item = redoStack.list.pop()
		if (item) {
			past.enqueue(item)
		}
		return item
	}

	function getActionLog(): GameAction[] {
		return past.list.map((entry) => entry.action)
	}

	return {
		enqueue,
		dequeue,
		undo,
		redo,
		getActionLog,
		replayActionLog,
		future,
		past,
		redoStack,
	}
}

/**
 * Pure deterministic replay of a serializable action log from an initial GameState.
 * Used for multiplayer state verification and simulation invariant checks.
 */
export function replayActionLog(initialState: GameState, actionLog: readonly GameAction[]): GameState {
	// Round-trip through JSON to verify every action is a plain serializable object
	const serializedLog: GameAction[] = JSON.parse(JSON.stringify(actionLog))
	let current = initialState
	for (const action of serializedLog) {
		current = executeAction(current, action)
	}
	return current
}
