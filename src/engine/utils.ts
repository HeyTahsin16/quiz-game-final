/**
 * Quiz Duel — Engine Utilities & Seeded PRNG
 * Derived from oskarrough/slaytheweb (src/utils.js & src/game/utils-state.js)
 * License: AGPL-3.0-or-later (port-with-attribution)
 */

/**
 * A FIFO Queue used by ActionManager to track future, past, and redo actions.
 */
export class Queue<T = unknown> {
	public list: T[]

	constructor(items: T[] = []) {
		this.list = [...items]
	}

	enqueue(item: T): void {
		this.list.push(item)
	}

	dequeue(): T | undefined {
		return this.list.shift()
	}
}

export function clamp(x: number, lower: number, upper: number): number {
	return Math.max(lower, Math.min(x, upper))
}

export function range(size: number, startAt = 0): number[] {
	return [...Array(Math.max(0, size)).keys()].map((i) => i + startAt)
}

/**
 * Pure deterministic Mulberry32 step from (seed, counter).
 * Returns a float in [0, 1) and the incremented counter.
 */
export function nextSeededRandom(seed: number, counter: number): {value: number; nextCounter: number} {
	let t = (seed + Math.imul(counter + 1, 0x6d2b79f5)) | 0
	t = Math.imul(t ^ (t >>> 15), t | 1)
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
	const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
	return {value, nextCounter: counter + 1}
}

/**
 * Deterministic Fisher-Yates shuffle using (seed, counter).
 */
export function seededShuffle<T>(
	array: readonly T[],
	seed: number,
	counter: number,
): {shuffled: T[]; nextCounter: number} {
	const copy = array.slice()
	let m = copy.length
	let currCounter = counter

	while (m > 0) {
		const {value, nextCounter} = nextSeededRandom(seed, currCounter)
		currCounter = nextCounter
		const i = Math.floor(value * m--)
		const temp = copy[m]
		copy[m] = copy[i]
		copy[i] = temp
	}

	return {shuffled: copy, nextCounter: currCounter}
}

/**
 * Deterministic integer in [from, to] inclusive.
 */
export function seededRandomInt(
	from: number,
	to: number,
	seed: number,
	counter: number,
): {value: number; nextCounter: number} {
	if (from >= to) return {value: from, nextCounter: counter + 1}
	const {value, nextCounter} = nextSeededRandom(seed, counter)
	const intVal = from + Math.floor(value * (to - from + 1))
	return {value: intVal, nextCounter}
}

/**
 * Creates a deterministic string ID from prefix, seed, and counter.
 */
export function createDeterministicId(prefix: string, seed: number, counter: number): string {
	const hash = ((seed ^ Math.imul(counter + 1, 0x9e3779b9)) >>> 0).toString(16).padStart(8, '0')
	return `${prefix}-${counter}-${hash}`
}

/**
 * Legacy helper functions preserved for compatibility with ported unit tests.
 */
let fallbackCounter = 1
export function uuid(): string {
	fallbackCounter++
	return createDeterministicId('id', 1337, fallbackCounter)
}

export function shuffle<T>(array: readonly T[], seed = 42, counter = fallbackCounter++): T[] {
	return seededShuffle(array, seed, counter).shuffled
}

export function random(from: number, to: number, seed = 42, counter = fallbackCounter++): number {
	return seededRandomInt(from, to, seed, counter).value
}

export function pick<T>(list: Iterable<T>, seed = 42, counter = fallbackCounter++): T {
	const arr = Array.from(list)
	return seededShuffle(arr, seed, counter).shuffled[0]
}

export function setToArray<T>(value: Set<T> | T[] | Record<string, unknown> | T): T[] | T {
	if (value instanceof Set) return Array.from(value)
	if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
		return []
	}
	return value as T[] | T
}
