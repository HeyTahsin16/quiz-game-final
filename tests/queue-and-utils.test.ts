/**
 * Quiz Duel — Queue, Utilities, Immer & Seeded PRNG Unit Tests
 * Derived from oskarrough/slaytheweb (tests/queue.js, tests/utils.js, tests/immer.js)
 * License: AGPL-3.0-or-later (port-with-attribution)
 */

import test from 'ava'
import {produce} from 'immer'
import {
	clamp,
	createDeterministicId,
	nextSeededRandom,
	pick,
	Queue,
	random,
	range,
	seededRandomInt,
	seededShuffle,
	setToArray,
	shuffle,
} from '../src/engine/utils'

test('Queue enqueues and dequeues in FIFO order', (t) => {
	const q = new Queue<string>()
	t.is(q.list.length, 0)

	q.enqueue('first')
	q.enqueue('second')
	t.deepEqual(q.list, ['first', 'second'])

	const first = q.dequeue()
	t.is(first, 'first')
	t.is(q.list.length, 1)

	const second = q.dequeue()
	t.is(second, 'second')
	t.is(q.dequeue(), undefined)
})

test('clamp, range, random, pick, shuffle and setToArray utilities work', (t) => {
	t.is(clamp(5, 0, 10), 5)
	t.is(clamp(-3, 0, 10), 0)
	t.is(clamp(15, 0, 10), 10)

	t.deepEqual(range(4), [0, 1, 2, 3])
	t.deepEqual(range(3, 2), [2, 3, 4])

	const r = random(1, 5, 42, 1)
	t.true(r >= 1 && r <= 5)

	const item = pick(['a', 'b', 'c'], 42, 2)
	t.true(['a', 'b', 'c'].includes(item))

	const arr = [1, 2, 3, 4, 5, 6, 7, 8]
	const shuffled = shuffle(arr, 99, 1)
	t.is(shuffled.length, arr.length)
	t.notDeepEqual(shuffled, arr)

	t.deepEqual(setToArray(new Set([1, 2])), [1, 2])
})

test('seeded PRNG and seededShuffle are 100% deterministic across calls', (t) => {
	const stepA1 = nextSeededRandom(12345, 0)
	const stepA2 = nextSeededRandom(12345, stepA1.nextCounter)

	const stepB1 = nextSeededRandom(12345, 0)
	const stepB2 = nextSeededRandom(12345, stepB1.nextCounter)

	t.is(stepA1.value, stepB1.value)
	t.is(stepA2.value, stepB2.value)

	const input = ['M1', 'M2', 'P1', 'P2', 'C1', 'C2', 'B1', 'B2']
	const s1 = seededShuffle(input, 777, 0)
	const s2 = seededShuffle(input, 777, 0)
	t.deepEqual(s1.shuffled, s2.shuffled)
	t.is(s1.nextCounter, s2.nextCounter)

	const int1 = seededRandomInt(0, 10, 777, 10)
	const int2 = seededRandomInt(0, 10, 777, 10)
	t.is(int1.value, int2.value)
	t.is(createDeterministicId('card', 777, 1), createDeterministicId('card', 777, 1))
})

test('immer produce preserves immutability of nested state', (t) => {
	const base = {
		round: 1,
		players: [{hp: 80}, {hp: 80}],
	}
	const next = produce(base, (draft) => {
		draft.round = 2
		draft.players[0].hp = 65
	})
	t.is(base.round, 1)
	t.is(base.players[0].hp, 80)
	t.is(next.round, 2)
	t.is(next.players[0].hp, 65)
})
