/**
 * Quiz Duel — Game Instance Wrapper (State + ActionManager)
 * Derived from oskarrough/slaytheweb (src/game/new-game.js)
 * License: AGPL-3.0-or-later (port-with-attribution)
 */

import ActionManager, {type ActionManagerInstance, type PastActionItem} from './action-manager'
import actions, {type CreateStateOptions, type GameAction, type GameState} from './actions'

export interface GameInstance extends Omit<ActionManagerInstance, 'dequeue'> {
	state: GameState
	actions: typeof actions
	dequeue: () => GameState
	run: (action: GameAction) => GameState
}

export function createNewGame(options: CreateStateOptions & {debug?: boolean} = {}): GameInstance {
	const am = ActionManager({debug: options.debug})
	const initialState = actions.createNewState(options)

	const game: GameInstance = {
		...am,
		state: initialState,
		actions,
		dequeue() {
			this.state = am.dequeue(this.state)
			return this.state
		},
		run(action: GameAction) {
			am.enqueue(action)
			this.state = am.dequeue(this.state)
			return this.state
		},
		undo(): PastActionItem | undefined {
			const previous = am.undo()
			if (previous) this.state = previous.state
			return previous
		},
		redo(): PastActionItem | undefined {
			const item = am.redo()
			if (item) {
				this.state = actions.executeAction(item.state, item.action)
			}
			return item
		},
	}

	return game
}

export default createNewGame
