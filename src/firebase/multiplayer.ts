import {
	doc,
	getDoc,
	onSnapshot,
	runTransaction,
	serverTimestamp,
	setDoc,
	type Timestamp,
	updateDoc,
} from 'firebase/firestore'
import {replayActionLog} from '../engine/action-manager'
import {createNewState, executeAction, type GameAction, type GameState} from '../engine/actions'
import {CHARACTER_IDS, CHARACTERS, type CharacterId} from '../engine/config'
import {auth, db, handleFirestoreError, OperationType} from './client'

export type RoomStatus = 'waiting' | 'playing' | 'finished'
export type MultiplayerSeat = 1 | 2

export interface RoomDocument {
	roomCode: string
	hostUid: string
	hostSeatId?: string
	hostName: string
	hostCharacter: CharacterId
	guestUid: string
	guestSeatId?: string
	guestName: string
	guestCharacter: CharacterId
	seed: number
	status: RoomStatus
	actionCount: number
	actionLog: GameAction[]
	hostLastSeenMs: number
	guestLastSeenMs: number
	winnerSeat: 0 | 1 | 2
	forfeitedBySeat: 0 | 1 | 2
	rematchCount: number
	createdAt?: Timestamp | null
	updatedAt?: Timestamp | null
}

const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/
const MAX_DISPLAY_NAME_LENGTH = 64
export const MAX_ACTION_LOG_LENGTH = 500
const TAB_SEAT_STORAGE_KEY = 'quiz-duel-tab-seat-id'

let fallbackTabSeatId: string | null = null

/**
 * Returns a persistent per-tab seat identifier stored in `sessionStorage` so one Google account
 * can host in Tab 1 and join as Challenger in Tab 2 during testing.
 */
export function getTabSeatId(): string {
	try {
		if (typeof window !== 'undefined' && window.sessionStorage) {
			const existing = window.sessionStorage.getItem(TAB_SEAT_STORAGE_KEY)
			if (existing && /^[a-zA-Z0-9_-]{4,64}$/.test(existing)) {
				return existing
			}
			const generated = `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
			window.sessionStorage.setItem(TAB_SEAT_STORAGE_KEY, generated)
			return generated
		}
	} catch {
		// Fallback when sessionStorage is blocked
	}
	if (!fallbackTabSeatId) {
		fallbackTabSeatId = `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
	}
	return fallbackTabSeatId
}

export function sanitizeRoomCode(raw: string): string {
	return raw
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.slice(0, 6)
}

export function isValidRoomCode(code: string): boolean {
	return ROOM_CODE_REGEX.test(code)
}

export function sanitizeDisplayName(name: string | null | undefined, fallback = 'Duelist'): string {
	const trimmed = (name || '').trim().slice(0, MAX_DISPLAY_NAME_LENGTH)
	return trimmed.length > 0 ? trimmed : fallback
}

function sanitizeCharacterId(charId: CharacterId): CharacterId {
	return CHARACTER_IDS.includes(charId) ? charId : 'dark-ninja'
}

export function generateRandomRoomCode(): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
	let result = ''
	for (let i = 0; i < 6; i++) {
		result += alphabet[Math.floor(Math.random() * alphabet.length)]
	}
	return result
}

/**
 * Pure helper that resolves the next action log, actionCount, and room outcome for a transactional append.
 * - Replays `currentDoc.actionLog` if `currentDoc.actionCount !== expectedActionCount` or if `precomputedState` is omitted.
 * - Does not slice the log; if `nextLog.length >= MAX_ACTION_LOG_LENGTH` (500), ends the match as a draw (`status = 'finished'`, `winnerSeat = 0`).
 */
export function computeTransactionalAppend(
	currentDoc: RoomDocument,
	expectedActionCount: number,
	seat: MultiplayerSeat,
	action: GameAction,
	precomputedState?: GameState,
	nowMs = Date.now(),
): {
	replayedOnMismatch: boolean
	nextState: GameState
	updateFields: {
		status: RoomStatus
		actionCount: number
		actionLog: GameAction[]
		hostLastSeenMs?: number
		guestLastSeenMs?: number
		winnerSeat: 0 | 1 | 2
		forfeitedBySeat: 0 | 1 | 2
	}
} {
	const mismatch = currentDoc.actionCount !== expectedActionCount || currentDoc.actionLog.length !== expectedActionCount
	let evaluatedState: GameState
	let replayedOnMismatch = false

	if (mismatch || !precomputedState) {
		replayedOnMismatch = mismatch
		const baseState = createNewState({
			player0Character: currentDoc.hostCharacter,
			player1Character: currentDoc.guestCharacter,
			player0Name: currentDoc.hostName || CHARACTERS[currentDoc.hostCharacter].name,
			player1Name: currentDoc.guestName || CHARACTERS[currentDoc.guestCharacter].name,
			seed: currentDoc.seed,
			autoSetupDecks: false,
		})
		const stateAfterExistingLog = replayActionLog(baseState, currentDoc.actionLog)
		evaluatedState = executeAction(stateAfterExistingLog, action)
	} else {
		evaluatedState = precomputedState
	}

	const nextLog =
		currentDoc.actionLog.length >= MAX_ACTION_LOG_LENGTH ? currentDoc.actionLog : [...currentDoc.actionLog, action]
	const reachedCap = nextLog.length >= MAX_ACTION_LOG_LENGTH

	let nextStatus: RoomStatus = evaluatedState.status === 'finished' ? 'finished' : 'playing'
	let winnerSeat: 0 | 1 | 2 = evaluatedState.winner === null ? 0 : evaluatedState.winner === 0 ? 1 : 2
	let forfeitedBySeat: 0 | 1 | 2 = evaluatedState.forfeitedBy === null ? 0 : evaluatedState.forfeitedBy === 0 ? 1 : 2

	if (reachedCap && nextStatus !== 'finished') {
		nextStatus = 'finished'
		winnerSeat = 0
		forfeitedBySeat = 0
		evaluatedState = {
			...evaluatedState,
			status: 'finished',
			winner: null,
			forfeitedBy: null,
			pendingThrow: [],
		}
	}

	const updateFields: {
		status: RoomStatus
		actionCount: number
		actionLog: GameAction[]
		hostLastSeenMs?: number
		guestLastSeenMs?: number
		winnerSeat: 0 | 1 | 2
		forfeitedBySeat: 0 | 1 | 2
	} = {
		status: nextStatus,
		actionCount: nextLog.length,
		actionLog: nextLog,
		winnerSeat,
		forfeitedBySeat,
	}

	if (seat === 1) {
		updateFields.hostLastSeenMs = nowMs
	} else {
		updateFields.guestLastSeenMs = nowMs
	}

	return {
		replayedOnMismatch,
		nextState: evaluatedState,
		updateFields,
	}
}

/**
 * Host creates a new waiting room in /rooms/{roomCode} as Seat 1 (Player 1).
 */
export async function createMultiplayerRoom(
	rawCode: string,
	hostCharacter: CharacterId,
	defaultGuestCharacter: CharacterId = 'knight',
	customTabSeatId?: string,
): Promise<{roomCode: string; seat: MultiplayerSeat; tabSeatId: string}> {
	const user = auth.currentUser
	if (!user) {
		throw new Error('Please sign in with Google before creating an online room.')
	}

	const roomCode = sanitizeRoomCode(rawCode)
	if (!isValidRoomCode(roomCode)) {
		throw new Error('Room code must be exactly 6 uppercase alphanumeric characters.')
	}

	const tabSeatId = customTabSeatId || getTabSeatId()
	const seed = Math.floor(Date.now() % 2000000000) + 101
	const nowMs = Date.now()
	const initialAction: GameAction = {
		type: 'initMatch',
		player0Character: sanitizeCharacterId(hostCharacter),
		player1Character: sanitizeCharacterId(defaultGuestCharacter),
		seed,
	}

	const path = `rooms/${roomCode}`
	try {
		await setDoc(doc(db, 'rooms', roomCode), {
			roomCode,
			hostUid: user.uid,
			hostSeatId: tabSeatId,
			hostName: sanitizeDisplayName(user.displayName, 'Host P1'),
			hostCharacter: sanitizeCharacterId(hostCharacter),
			guestUid: '',
			guestSeatId: '',
			guestName: '',
			guestCharacter: sanitizeCharacterId(defaultGuestCharacter),
			seed,
			status: 'waiting',
			actionCount: 1,
			actionLog: [initialAction],
			hostLastSeenMs: nowMs,
			guestLastSeenMs: nowMs,
			winnerSeat: 0,
			forfeitedBySeat: 0,
			rematchCount: 0,
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
		})
		return {roomCode, seat: 1, tabSeatId}
	} catch (error) {
		handleFirestoreError(error, OperationType.CREATE, path)
	}
}

/**
 * Guest joins an existing waiting room by 6-character code as Seat 2 (Player 2),
 * or reconnects to their existing seat if already seated in the room.
 * Uses a per-tab seat ID (`hostSeatId` / `guestSeatId`) so one Google account can host in Tab 1 and join in Tab 2.
 */
export async function joinMultiplayerRoom(
	rawCode: string,
	guestCharacter: CharacterId,
	customTabSeatId?: string,
): Promise<{roomCode: string; seat: MultiplayerSeat; room: RoomDocument; tabSeatId: string}> {
	const user = auth.currentUser
	if (!user) {
		throw new Error('Please sign in with Google before joining an online room.')
	}

	const roomCode = sanitizeRoomCode(rawCode)
	if (!isValidRoomCode(roomCode)) {
		throw new Error('Room code must be 6 characters (A–Z, 0–9).')
	}

	const tabSeatId = customTabSeatId || getTabSeatId()
	const path = `rooms/${roomCode}`
	const roomRef = doc(db, 'rooms', roomCode)

	let snap: Awaited<ReturnType<typeof getDoc>>
	try {
		snap = await getDoc(roomRef)
	} catch (error) {
		handleFirestoreError(error, OperationType.GET, path)
	}

	if (!snap.exists()) {
		throw new Error(`Room ${roomCode} was not found. Ask your opponent to host it first.`)
	}

	const data = snap.data() as RoomDocument

	// Reconnect if this exact browser tab is already the host (Seat 1)
	if (data.hostUid === user.uid && data.hostSeatId === tabSeatId) {
		return {roomCode, seat: 1, room: data, tabSeatId}
	}

	// Reconnect if this exact browser tab is already the guest (Seat 2)
	if (data.guestUid === user.uid && data.guestSeatId === tabSeatId) {
		return {roomCode, seat: 2, room: data, tabSeatId}
	}

	// If the room is already in play, allow UID-based reconnect when host and guest are distinct accounts
	if (data.status !== 'waiting' && data.guestUid !== '') {
		if (data.guestUid === user.uid && data.hostUid !== user.uid) {
			return {roomCode, seat: 2, room: data, tabSeatId}
		}
		if (data.hostUid === user.uid && data.guestUid !== user.uid) {
			return {roomCode, seat: 1, room: data, tabSeatId}
		}
		throw new Error(`Room ${roomCode} already has two players in battle.`)
	}

	if (data.status !== 'waiting' || data.guestUid !== '') {
		throw new Error(`Room ${roomCode} already has two players in battle.`)
	}

	const safeGuestChar = sanitizeCharacterId(guestCharacter)
	const nowMs = Date.now()
	const initAction: GameAction = {
		type: 'initMatch',
		player0Character: data.hostCharacter,
		player1Character: safeGuestChar,
		seed: data.seed,
	}

	try {
		await updateDoc(roomRef, {
			guestUid: user.uid,
			guestSeatId: tabSeatId,
			guestName: sanitizeDisplayName(user.displayName, 'Challenger P2'),
			guestCharacter: safeGuestChar,
			status: 'playing',
			actionCount: 1,
			actionLog: [initAction],
			guestLastSeenMs: nowMs,
			updatedAt: serverTimestamp(),
		})
	} catch (error) {
		handleFirestoreError(error, OperationType.UPDATE, path)
	}

	return {
		roomCode,
		seat: 2,
		tabSeatId,
		room: {
			...data,
			guestUid: user.uid,
			guestSeatId: tabSeatId,
			guestName: sanitizeDisplayName(user.displayName, 'Challenger P2'),
			guestCharacter: safeGuestChar,
			status: 'playing',
			actionCount: 1,
			actionLog: [initAction],
			guestLastSeenMs: nowMs,
		},
	}
}

/**
 * Appends a serializable GameAction to the room's actionLog inside a Firestore transaction:
 * - Re-reads the room document and compares `actionCount` with `room.actionCount`.
 * - On mismatch, deterministically replays the server's `actionLog` and applies `action` before committing.
 * - Never slices the action log; if `actionLog` reaches the 500-action cap, ends the match as a draw (`status = 'finished'`, `winnerSeat = 0`).
 */
export async function appendRoomAction(
	room: RoomDocument,
	seat: MultiplayerSeat,
	action: GameAction,
	nextState?: GameState,
): Promise<void> {
	const path = `rooms/${room.roomCode}`
	const roomRef = doc(db, 'rooms', room.roomCode)

	try {
		await runTransaction(db, async (transaction) => {
			const snap = await transaction.get(roomRef)
			if (!snap.exists()) {
				throw new Error(`Room ${room.roomCode} does not exist.`)
			}
			const currentDoc = snap.data() as RoomDocument
			if (currentDoc.status === 'finished') {
				return
			}

			const {updateFields} = computeTransactionalAppend(
				currentDoc,
				room.actionCount,
				seat,
				action,
				nextState,
				Date.now(),
			)

			transaction.update(roomRef, {
				...updateFields,
				updatedAt: serverTimestamp(),
			})
		})
	} catch (error) {
		handleFirestoreError(error, OperationType.UPDATE, path)
	}
}

/**
 * Sends a presence heartbeat for the seated player every 30s.
 * Updates ONLY the sender's own lastSeen field (`hostLastSeenMs` or `guestLastSeenMs`) plus `updatedAt`.
 */
export async function sendRoomHeartbeat(room: RoomDocument, seat: MultiplayerSeat): Promise<void> {
	if (room.status !== 'playing') return
	const path = `rooms/${room.roomCode}`
	const roomRef = doc(db, 'rooms', room.roomCode)
	const nowMs = Date.now()

	try {
		if (seat === 1) {
			await updateDoc(roomRef, {
				hostLastSeenMs: nowMs,
				updatedAt: serverTimestamp(),
			})
		} else {
			await updateDoc(roomRef, {
				guestLastSeenMs: nowMs,
				updatedAt: serverTimestamp(),
			})
		}
	} catch (error) {
		handleFirestoreError(error, OperationType.UPDATE, path)
	}
}

/**
 * Resets a finished room for a rematch with a fresh PRNG seed.
 */
export async function triggerRoomRematch(room: RoomDocument): Promise<void> {
	if (room.status !== 'finished') return
	const path = `rooms/${room.roomCode}`
	const roomRef = doc(db, 'rooms', room.roomCode)
	const nextSeed = Math.floor(Date.now() % 2000000000) + 101 + room.rematchCount + 1
	const nowMs = Date.now()
	const initAction: GameAction = {
		type: 'initMatch',
		player0Character: room.hostCharacter,
		player1Character: room.guestCharacter,
		seed: nextSeed,
	}

	try {
		await updateDoc(roomRef, {
			hostCharacter: room.hostCharacter,
			guestCharacter: room.guestCharacter,
			seed: nextSeed,
			status: 'playing',
			actionCount: 1,
			actionLog: [initAction],
			hostLastSeenMs: nowMs,
			guestLastSeenMs: nowMs,
			winnerSeat: 0,
			forfeitedBySeat: 0,
			rematchCount: room.rematchCount + 1,
			updatedAt: serverTimestamp(),
		})
	} catch (error) {
		handleFirestoreError(error, OperationType.UPDATE, path)
	}
}

/**
 * Subscribes to live Firestore updates on /rooms/{roomCode}.
 */
export function subscribeToRoom(
	roomCode: string,
	onRoom: (room: RoomDocument | null) => void,
	onError?: (err: unknown) => void,
): () => void {
	const safeCode = sanitizeRoomCode(roomCode)
	const path = `rooms/${safeCode}`
	return onSnapshot(
		doc(db, 'rooms', safeCode),
		(snap) => {
			if (!snap.exists()) {
				onRoom(null)
				return
			}
			onRoom(snap.data() as RoomDocument)
		},
		(error) => {
			if (onError) onError(error)
			handleFirestoreError(error, OperationType.GET, path)
		},
	)
}
