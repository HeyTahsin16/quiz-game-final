import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {audioManager} from '../../audio/audioManager'
import type {GameState, PlayerIndex, QuizAnswerOutcome, QuizResolutionSummary} from '../../engine/actions'
import type {CardInstance} from '../../engine/cards'
import {canPlay, canThrowSelection} from '../../engine/conditions'
import {
	CHARACTERS,
	type CharacterId,
	DEFAULT_BATTLE_MAP_ID,
	ENGINE_CONFIG,
	type SpriteAnimationState,
} from '../../engine/config'
import createNewGame, {type GameInstance} from '../../engine/game'
import {
	appendRoomAction,
	MAX_ACTION_LOG_LENGTH,
	type MultiplayerSeat,
	type RoomDocument,
	sendRoomHeartbeat,
	subscribeToRoom,
	triggerRoomRematch,
} from '../../firebase/multiplayer'
import {getCharacterDisplay, useLanguage} from '../../i18n/LanguageContext'
import {BattleArenaStage, PlayerMapCropStage} from '../components/BattleArenaStage'
import {FailedQuestionsReview} from '../components/FailedQuestionsReview'
import {FlatBanner, FlatBar, FlatButton, FlatIcon, FlatManaPips, FlatPanel, FlatWell} from '../components/FlatUi'
import {NineSliceCard} from '../components/NineSliceCard'
import {QuizCanvasModal} from '../components/QuizCanvasModal'
import {StatusBadges} from '../components/StatusBadges'
import {formatLiveCardText} from '../utils/cardTextFormatter'

export interface MatchSummary {
	winnerSeat: 0 | 1 | 2
	rounds: number
	turns: number
	p1EndHp: number
	p1MaxHp: number
	p2EndHp: number
	p2MaxHp: number
	forfeitedBy: 1 | 2 | null
	actionCount: number
	seed?: number
	localPlayerIndex?: PlayerIndex
	isHotseat?: boolean
	p1Name?: string
	p2Name?: string
	quizHistory?: QuizResolutionSummary[]
}

export type LocalPlayMode = 'vs-bot' | 'hotseat-open' | 'hotseat-curtain'

export interface BattleScreenProps {
	p1Character: CharacterId
	p2Character: CharacterId
	roomCode: string
	localPlayMode?: LocalPlayMode
	isOnlineMultiplayer?: boolean
	onlineSeat?: MultiplayerSeat
	initialRoom?: RoomDocument | null
	onBackToMenu?: () => void
	onFinishBattle: (winner: 0 | 1 | 2, summary?: MatchSummary) => void
}

type PileModalState = {playerIndex: PlayerIndex; pile: 'draw' | 'discard' | 'exhaust'} | null

function getRestingIdleState(charId: CharacterId, isActiveTurn: boolean): SpriteAnimationState {
	if (charId === 'reaper') {
		return isActiveTurn ? 'idle' : 'idle2'
	}
	return 'idle'
}

export function BattleScreen({
	p1Character,
	p2Character,
	roomCode,
	localPlayMode = 'vs-bot',
	isOnlineMultiplayer = false,
	onlineSeat = 1,
	initialRoom = null,
	onBackToMenu,
	onFinishBattle,
}: BattleScreenProps) {
	const {lang, isBangla} = useLanguage()
	const gameRef = useRef<GameInstance | null>(null)
	const [matchSeed, setMatchSeed] = useState<number>(() => initialRoom?.seed ?? Math.floor(Date.now() % 1000000) + 101)
	const playMode: LocalPlayMode = localPlayMode
	const [onlineRoom, setOnlineRoom] = useState<RoomDocument | null>(initialRoom)
	const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([])
	const [hasThrownThisTurn, setHasThrownThisTurn] = useState<boolean>(false)
	const [curtainDismissedForTurn, setCurtainDismissedForTurn] = useState<number>(1)
	const [pileModal, setPileModal] = useState<PileModalState>(null)
	const [isPauseMenuOpen, setIsPauseMenuOpen] = useState<boolean>(false)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const [cameraView, setCameraView] = useState<'panoramic' | 'split'>('panoramic')
	const effectiveP1Char: CharacterId = onlineRoom?.hostCharacter ?? p1Character
	const effectiveP2Char: CharacterId = onlineRoom?.guestCharacter ?? p2Character
	const [p1Anim, setP1Anim] = useState<SpriteAnimationState>(() =>
		effectiveP1Char === 'reaper' ? 'turnStart' : 'idle',
	)
	const [p2Anim, setP2Anim] = useState<SpriteAnimationState>(() => (effectiveP2Char === 'reaper' ? 'idle2' : 'idle'))

	// Initialize or reset the local game engine instance
	const initGame = useCallback(
		(seedToUse: number, char0: CharacterId, char1: CharacterId) => {
			const g = createNewGame({
				player0Character: char0,
				player1Character: char1,
				player0Name: onlineRoom?.hostName || CHARACTERS[char0].name,
				player1Name: onlineRoom?.guestName || CHARACTERS[char1].name,
				seed: seedToUse,
			})
			g.run({
				type: 'initMatch',
				player0Character: char0,
				player1Character: char1,
				seed: seedToUse,
			})
			gameRef.current = g
			setSelectedInstanceIds([])
			setHasThrownThisTurn(false)
			setCurtainDismissedForTurn(1)
			setPileModal(null)
			setStatusMessage(null)
			setP1Anim(char0 === 'reaper' ? 'turnStart' : 'idle')
			setP2Anim(char1 === 'reaper' ? 'idle2' : 'idle')
			return g.state
		},
		[onlineRoom?.guestName, onlineRoom?.hostName],
	)

	const [gameState, setGameState] = useState<GameState>(() => initGame(matchSeed, effectiveP1Char, effectiveP2Char))

	// Re-init local game when not in online mode and characters/seed change
	useEffect(() => {
		if (isOnlineMultiplayer) return
		setGameState(initGame(matchSeed, effectiveP1Char, effectiveP2Char))
	}, [effectiveP1Char, effectiveP2Char, initGame, isOnlineMultiplayer, matchSeed])

	// Subscribe to Firestore room when in Online Multiplayer mode and deterministically replay actionLog
	useEffect(() => {
		if (!isOnlineMultiplayer || !roomCode) return
		const unsub = subscribeToRoom(roomCode, (remoteRoom) => {
			if (!remoteRoom) return
			setOnlineRoom(remoteRoom)

			const g = createNewGame({
				player0Character: remoteRoom.hostCharacter,
				player1Character: remoteRoom.guestCharacter,
				player0Name: remoteRoom.hostName || CHARACTERS[remoteRoom.hostCharacter].name,
				player1Name: remoteRoom.guestName || CHARACTERS[remoteRoom.guestCharacter].name,
				seed: remoteRoom.seed,
			})

			if (remoteRoom.actionLog && remoteRoom.actionLog.length > 0) {
				g.state = g.replayActionLog(g.state, remoteRoom.actionLog)
			} else {
				g.run({
					type: 'initMatch',
					player0Character: remoteRoom.hostCharacter,
					player1Character: remoteRoom.guestCharacter,
					seed: remoteRoom.seed,
				})
			}

			if (remoteRoom.status === 'finished' && g.state.status !== 'finished') {
				g.state = {
					...g.state,
					status: 'finished',
					winner: remoteRoom.winnerSeat === 1 ? 0 : remoteRoom.winnerSeat === 2 ? 1 : null,
					forfeitedBy: remoteRoom.forfeitedBySeat === 1 ? 0 : remoteRoom.forfeitedBySeat === 2 ? 1 : null,
					pendingThrow: [],
				}
			}

			const prevTurn = gameRef.current?.state.turn ?? 1
			const prevActive = gameRef.current?.state.activePlayer ?? 0
			gameRef.current = g
			setGameState(g.state)

			if (g.state.turn !== prevTurn) {
				setSelectedInstanceIds([])
				setHasThrownThisTurn(false)
			}
			if (g.state.status !== 'finished' && g.state.activePlayer !== prevActive) {
				if (remoteRoom.hostCharacter === 'reaper') {
					setP1Anim(g.state.activePlayer === 0 ? 'turnStart' : 'turnEnd')
				}
				if (remoteRoom.guestCharacter === 'reaper') {
					setP2Anim(g.state.activePlayer === 1 ? 'turnStart' : 'turnEnd')
				}
			}
		})
		return () => unsub()
	}, [isOnlineMultiplayer, roomCode])

	// Online presence heartbeat (every 30s) + 60-second disconnect forfeit monitor (Section 5)
	useEffect(() => {
		if (!isOnlineMultiplayer || !onlineRoom || onlineRoom.status !== 'playing') {
			return
		}

		const heartbeatInterval = window.setInterval(() => {
			sendRoomHeartbeat(onlineRoom, onlineSeat).catch(() => {})
		}, 30000)

		const silenceMonitor = window.setInterval(() => {
			const owingPlayerIndex: PlayerIndex =
				gameState.status === 'quizzing' && gameState.pendingThrow[0]
					? gameState.pendingThrow[0].defenderIndex
					: gameState.activePlayer
			const owingSeat: MultiplayerSeat = owingPlayerIndex === 0 ? 1 : 2

			if (owingSeat === onlineSeat) {
				return
			}

			const lastSeenMs = owingSeat === 1 ? onlineRoom.hostLastSeenMs : onlineRoom.guestLastSeenMs
			const elapsedSec = Math.max(0, Math.floor((Date.now() - lastSeenMs) / 1000))

			if (elapsedSec >= ENGINE_CONFIG.disconnectForfeitSeconds && gameState.status !== 'finished') {
				const g = gameRef.current
				if (!g) return
				const forfeitAction = {type: 'forfeit' as const, playerIndex: owingPlayerIndex}
				const next = g.run(forfeitAction)
				setGameState(next)
				appendRoomAction(onlineRoom, onlineSeat, forfeitAction, next).catch(() => {})
			}
		}, 1000)

		return () => {
			window.clearInterval(heartbeatInterval)
			window.clearInterval(silenceMonitor)
		}
	}, [gameState.activePlayer, gameState.pendingThrow, gameState.status, isOnlineMultiplayer, onlineRoom, onlineSeat])

	const dispatchAction = useCallback(
		(
			action: Parameters<GameInstance['run']>[0],
			options?: {resetSelection?: boolean; markThrown?: boolean; resetThrown?: boolean},
		) => {
			const g = gameRef.current
			if (!g) return
			const prevP1Hp = g.state.players[0].currentHealth
			const prevP2Hp = g.state.players[1].currentHealth
			const prevP1Block = g.state.players[0].block
			const prevP2Block = g.state.players[1].block
			const prevP1Poison = g.state.players[0].powers.poison ?? 0
			const prevP2Poison = g.state.players[1].powers.poison ?? 0
			const prevCasterIdx = g.state.pendingThrow[0]?.casterIndex
			const prevDefenderIdx = g.state.pendingThrow[0]?.defenderIndex
			const prevActiveIdx = g.state.activePlayer

			let next = g.run(action)
			if (g.getActionLog().length >= MAX_ACTION_LOG_LENGTH && next.status !== 'finished') {
				next = {
					...next,
					status: 'finished',
					winner: null,
					forfeitedBy: null,
					pendingThrow: [],
				}
				g.state = next
			}
			setGameState(next)

			if (action.type === 'throwCards') {
				audioManager.playSfx('card-fan')
				if (action.playerIndex === 0) {
					setP1Anim('attack')
				} else {
					setP2Anim('attack')
				}
			} else if (action.type === 'resolveQuizAnswer') {
				const p1TookHit =
					next.players[0].currentHealth < prevP1Hp ||
					(prevDefenderIdx === 0 && next.lastQuizResult?.resolution !== 'nullified')
				const p2TookHit =
					next.players[1].currentHealth < prevP2Hp ||
					(prevDefenderIdx === 1 && next.lastQuizResult?.resolution !== 'nullified')

				const gainedBlock = next.players[0].block > prevP1Block || next.players[1].block > prevP2Block
				const gainedHp = next.players[0].currentHealth > prevP1Hp || next.players[1].currentHealth > prevP2Hp
				const gainedPoison =
					(next.players[0].powers.poison ?? 0) > prevP1Poison || (next.players[1].powers.poison ?? 0) > prevP2Poison

				if (gainedBlock) audioManager.playSfx('shield')
				if (gainedHp) audioManager.playSfx('heal')
				if (gainedPoison) audioManager.playSfx('poison')

				if (prevCasterIdx === 0 && next.lastQuizResult?.resolution !== 'nullified') {
					setP1Anim('attack')
				} else if (prevCasterIdx === 1 && next.lastQuizResult?.resolution !== 'nullified') {
					setP2Anim('attack')
				}

				if (p1TookHit) {
					setP1Anim('hurt')
					if (next.players[0].currentHealth > 0 && next.status !== 'finished') {
						audioManager.playCharacterVoice(effectiveP1Char, 'hurt')
					} else {
						audioManager.playSfx('hurt')
					}
				}
				if (p2TookHit) {
					setP2Anim('hurt')
					if (next.players[1].currentHealth > 0 && next.status !== 'finished') {
						audioManager.playCharacterVoice(effectiveP2Char, 'hurt')
					} else {
						audioManager.playSfx('hurt')
					}
				}
			}

			if (next.status !== 'finished' && next.activePlayer !== prevActiveIdx) {
				if (effectiveP1Char === 'reaper') {
					setP1Anim(next.activePlayer === 0 ? 'turnStart' : 'turnEnd')
				}
				if (effectiveP2Char === 'reaper') {
					setP2Anim(next.activePlayer === 1 ? 'turnStart' : 'turnEnd')
				}
			}

			if (next.status === 'finished' && next.winner !== null) {
				if (next.winner === 0) {
					setP2Anim('death')
				} else {
					setP1Anim('death')
				}
			}

			if (options?.resetSelection) {
				setSelectedInstanceIds([])
			}
			if (options?.markThrown) {
				setHasThrownThisTurn(true)
			}
			if (options?.resetThrown) {
				setHasThrownThisTurn(false)
			}
			setStatusMessage(null)

			if (isOnlineMultiplayer && onlineRoom) {
				appendRoomAction(onlineRoom, onlineSeat, action, next).catch((err) => {
					setStatusMessage(err instanceof Error ? err.message : 'Failed to sync action to Firestore.')
				})
			}
		},
		[effectiveP1Char, effectiveP2Char, isOnlineMultiplayer, onlineRoom, onlineSeat],
	)

	// Play defeated character's death voice and victory fanfare when match finishes
	useEffect(() => {
		if (gameState.status === 'finished' && gameState.winner !== null) {
			const defeatedChar = gameState.winner === 0 ? effectiveP2Char : effectiveP1Char
			audioManager.playCharacterVoice(defeatedChar, 'death')
			window.setTimeout(() => {
				audioManager.playSfx('victory')
			}, 350)
		}
	}, [effectiveP1Char, effectiveP2Char, gameState.status, gameState.winner])

	const activeIdx = gameState.activePlayer
	const activePlayer = gameState.players[activeIdx]
	const p1State = gameState.players[0]
	const p2State = gameState.players[1]

	const myPlayerIndex: PlayerIndex = isOnlineMultiplayer
		? onlineSeat === 1
			? 0
			: 1
		: playMode === 'vs-bot'
			? 0
			: activeIdx
	const displayedHandPlayer = gameState.players[myPlayerIndex]
	const isMyTurnToAct = isOnlineMultiplayer
		? onlineRoom?.status === 'playing' && activeIdx === myPlayerIndex && gameState.status === 'playing'
		: gameState.status === 'playing' && !(playMode === 'vs-bot' && activeIdx === 1)

	const selectedCards = useMemo(() => {
		return selectedInstanceIds
			.map((id) => displayedHandPlayer.hand.find((c) => c.instanceId === id))
			.filter((c): c is CardInstance => Boolean(c))
	}, [displayedHandPlayer.hand, selectedInstanceIds])

	const selectedManaCost = useMemo(() => {
		return selectedCards.reduce((sum, c) => sum + c.cost, 0)
	}, [selectedCards])

	const hasAnyPlayableCard = useMemo(() => {
		return displayedHandPlayer.hand.some((c) => canPlay(gameState, c, myPlayerIndex))
	}, [displayedHandPlayer.hand, gameState, myPlayerIndex])

	// Smart Bot Turn Automation when in local 'vs-bot' mode and activePlayer === 1
	useEffect(() => {
		if (isOnlineMultiplayer) return
		if (playMode !== 'vs-bot') return
		if (gameState.status !== 'playing') return
		if (gameState.activePlayer !== 1) return

		const timer = window.setTimeout(
			() => {
				const bot = gameState.players[1]
				const sortedHand = [...bot.hand].sort((a, b) => b.cost - a.cost)
				const chosenIds: string[] = []

				for (const candidate of sortedHand) {
					const testIds = [...chosenIds, candidate.instanceId]
					if (canThrowSelection(gameState, testIds, 1)) {
						chosenIds.push(candidate.instanceId)
					}
				}

				if (chosenIds.length > 0 && !hasThrownThisTurn) {
					audioManager.playCharacterVoice(effectiveP2Char, 'attack')
					dispatchAction(
						{
							type: 'throwCards',
							playerIndex: 1,
							cardInstanceIds: chosenIds,
						},
						{resetSelection: true, markThrown: true},
					)
				} else if (!hasThrownThisTurn && chosenIds.length === 0) {
					dispatchAction({type: 'skipTurn'}, {resetSelection: true, resetThrown: true})
				} else {
					dispatchAction({type: 'endTurn'}, {resetSelection: true, resetThrown: true})
				}
			},
			effectiveP2Char === 'reaper' && !hasThrownThisTurn ? 1100 : 900,
		)

		return () => window.clearTimeout(timer)
	}, [dispatchAction, effectiveP2Char, gameState, hasThrownThisTurn, isOnlineMultiplayer, playMode])

	const handleToggleCard = (card: CardInstance) => {
		if (!isMyTurnToAct) {
			audioManager.playSfx('error')
			if (isOnlineMultiplayer && activeIdx !== myPlayerIndex) {
				setStatusMessage(
					isBangla
						? 'কার্ড ছোড়ার জন্য নির্বাচন করার আগে আপনার প্রতিপক্ষের চাল শেষ হওয়া পর্যন্ত অপেক্ষা করুন।'
						: "Wait for your opponent's turn to finish before selecting cards to throw.",
				)
			}
			return
		}

		if (selectedInstanceIds.includes(card.instanceId)) {
			audioManager.playSfx('cancel')
			setSelectedInstanceIds((prev) => prev.filter((id) => id !== card.instanceId))
			setStatusMessage(null)
			return
		}

		const nextIds = [...selectedInstanceIds, card.instanceId]

		if (!canThrowSelection(gameState, nextIds, myPlayerIndex)) {
			audioManager.playSfx('error')
			const hasClashCondition = card.conditions?.some((c) => c.type === 'onlySubjectInHand')
			if (hasClashCondition && !canPlay(gameState, card, myPlayerIndex)) {
				setStatusMessage(
					isBangla
						? `${card.name} ব্যবহারের জন্য আপনার হাতের প্রতিটি কার্ড অবশ্যই Maths কার্ড হতে হবে!`
						: `${card.name} requires every card in your hand to be a Maths card!`,
				)
			} else {
				setStatusMessage(
					isBangla
						? `পর্যাপ্ত মানা নেই! নির্বাচিত কার্ডগুলোর খরচ ${selectedManaCost + card.cost}, আপনার আছে ${displayedHandPlayer.mana}।`
						: `Not enough Mana! Selected cards cost ${selectedManaCost + card.cost}, you have ${displayedHandPlayer.mana}.`,
				)
			}
			return
		}

		audioManager.playSfx('card-draw')
		setSelectedInstanceIds(nextIds)
		setStatusMessage(null)
	}

	const handleThrowSelected = () => {
		if (selectedInstanceIds.length === 0 || !isMyTurnToAct) return
		const activeChar = myPlayerIndex === 0 ? effectiveP1Char : effectiveP2Char
		audioManager.playCharacterVoice(activeChar, 'attack')
		dispatchAction(
			{
				type: 'throwCards',
				playerIndex: myPlayerIndex,
				cardInstanceIds: selectedInstanceIds,
			},
			{resetSelection: true, markThrown: true},
		)
	}

	const handleResolveQuiz = useCallback(
		(outcome: QuizAnswerOutcome, selectedChoice?: number | null) => {
			dispatchAction(
				selectedChoice !== undefined
					? {
							type: 'resolveQuizAnswer',
							answer: outcome,
							selectedChoice,
						}
					: {
							type: 'resolveQuizAnswer',
							answer: outcome,
						},
			)
		},
		[dispatchAction],
	)

	const handleEndTurn = useCallback(() => {
		if (!isMyTurnToAct) return
		audioManager.playSfx('swipe')
		dispatchAction({type: 'endTurn'}, {resetSelection: true, resetThrown: true})
	}, [dispatchAction, isMyTurnToAct])

	const handleSkipTurn = useCallback(() => {
		if (!isMyTurnToAct || hasThrownThisTurn) return
		audioManager.playSfx('swipe')
		dispatchAction({type: 'skipTurn'}, {resetSelection: true, resetThrown: true})
	}, [dispatchAction, hasThrownThisTurn, isMyTurnToAct])

	const handleForfeit = (playerIndex: PlayerIndex) => {
		audioManager.playSfx('cancel')
		dispatchAction({type: 'forfeit', playerIndex}, {resetSelection: true})
	}

	const handleRematchClick = () => {
		audioManager.playSfx('match-start')
		if (isOnlineMultiplayer && onlineRoom) {
			triggerRoomRematch(onlineRoom).catch((err) => {
				setStatusMessage(err instanceof Error ? err.message : 'Failed to start online rematch.')
			})
		} else {
			setMatchSeed((s) => s + 1)
		}
	}

	const handleProceedToResult = () => {
		const winSeat: 0 | 1 | 2 = gameState.winner === null ? 0 : gameState.winner === 1 ? 2 : 1
		const g = gameRef.current
		onFinishBattle(winSeat, {
			winnerSeat: winSeat,
			rounds: gameState.round,
			turns: gameState.turn,
			p1EndHp: p1State.currentHealth,
			p1MaxHp: p1State.maxHealth,
			p2EndHp: p2State.currentHealth,
			p2MaxHp: p2State.maxHealth,
			forfeitedBy: gameState.forfeitedBy === null ? null : gameState.forfeitedBy === 0 ? 1 : 2,
			actionCount: g ? g.getActionLog().length : 0,
			seed: gameState.seed,
			localPlayerIndex: isOnlineMultiplayer ? (onlineSeat === 1 ? 0 : 1) : 0,
			isHotseat: !isOnlineMultiplayer && (playMode === 'hotseat-open' || playMode === 'hotseat-curtain'),
			p1Name: p1State.name,
			p2Name: p2State.name,
			quizHistory: gameState.quizHistory,
		})
	}

	const currentQuizEntry = gameState.status === 'quizzing' ? gameState.pendingThrow[0] : undefined
	const isMyQuizToAnswer =
		currentQuizEntry !== undefined && (!isOnlineMultiplayer || currentQuizEntry.defenderIndex === myPlayerIndex)

	const showPassCurtain =
		!isOnlineMultiplayer &&
		playMode === 'hotseat-curtain' &&
		gameState.status === 'playing' &&
		curtainDismissedForTurn !== gameState.turn

	// Automatically end turn (or skip turn if no card was thrown) when the active player cannot throw any more cards
	useEffect(() => {
		if (!isMyTurnToAct) return
		if (showPassCurtain) return
		if (hasAnyPlayableCard) return

		const timer = window.setTimeout(() => {
			audioManager.playSfx('swipe')
			if (hasThrownThisTurn || gameState.throwsThisTurn > 0) {
				dispatchAction({type: 'endTurn'}, {resetSelection: true, resetThrown: true})
			} else {
				dispatchAction({type: 'skipTurn'}, {resetSelection: true, resetThrown: true})
			}
		}, 450)

		return () => window.clearTimeout(timer)
	}, [
		dispatchAction,
		gameState.throwsThisTurn,
		hasAnyPlayableCard,
		hasThrownThisTurn,
		isMyTurnToAct,
		showPassCurtain,
	])

	return (
		<div
			className={
				cameraView === 'panoramic'
					? 'relative h-screen w-full overflow-hidden select-none'
					: 'mx-auto max-w-[1400px] select-none space-y-5 px-4 py-5 md:px-6'
			}
		>
			{/* Floating Status Banners (Online Waiting / Last Quiz Result) */}
			{(isOnlineMultiplayer && onlineRoom?.status === 'waiting') ||
			(isOnlineMultiplayer && currentQuizEntry && !isMyQuizToAnswer) ||
			gameState.lastQuizResult ? (
				<div
					className={
						cameraView === 'panoramic'
							? 'pointer-events-auto absolute top-16 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 space-y-2 px-4'
							: 'space-y-3'
					}
				>
					{isOnlineMultiplayer && onlineRoom?.status === 'waiting' && (
						<FlatPanel variant="gold" wellVariant="gold-dark" wellClassName="px-6 py-3 text-center">
							<div className="font-pixel text-xs text-amber-300">
								{isBangla
									? `রুম ${roomCode}-এ চ্যালেঞ্জারের যোগদানের অপেক্ষায়...`
									: `WAITING FOR CHALLENGER TO JOIN ROOM ${roomCode}...`}
							</div>
							<p className="mt-1 text-xs text-slate-200">
								{isBangla ? (
									<>
										Player 2-এর সাথে রুম কোড <strong className="font-mono text-white">{roomCode}</strong> শেয়ার করুন।
										লবি থেকে তারা যোগ দিলেই যুদ্ধ স্বয়ংক্রিয়ভাবে শুরু হবে!
									</>
								) : (
									<>
										Share room code <strong className="font-mono text-white">{roomCode}</strong> with Player 2. As soon
										as they join from the Lobby, the battle will unlock automatically!
									</>
								)}
							</p>
						</FlatPanel>
					)}

					{isOnlineMultiplayer && currentQuizEntry && !isMyQuizToAnswer && (
						<FlatPanel variant="blue" wellVariant="blue-dark" wellClassName="px-6 py-3 text-center">
							<div className="font-pixel text-xs text-sky-300">
								{isBangla
									? `প্রতিপক্ষ আপনার ${currentQuizEntry.card.name.toUpperCase()} (#${currentQuizEntry.card.id})-এর STEM কুইজের উত্তর দিচ্ছে...`
									: `OPPONENT IS ANSWERING YOUR STEM QUIZ FOR ${currentQuizEntry.card.name.toUpperCase()} (#${currentQuizEntry.card.id})...`}
							</div>
							<p className="mt-1 text-xs text-slate-200">
								{isBangla
									? `বাকি সারি: ${gameState.pendingThrow.length}টি কার্ড। প্রতিরক্ষাকারী উত্তর দিলেই বা সময় শেষ হলেই কার্ড কার্যকর হবে।`
									: `Queue remaining: ${gameState.pendingThrow.length} card(s). Card resolves as soon as the defender answers or their timer expires.`}
							</p>
						</FlatPanel>
					)}

					{gameState.lastQuizResult && (
						<FlatWell
							variant={
								gameState.lastQuizResult.resolution === 'nullified'
									? 'blue-dark'
									: gameState.lastQuizResult.resolution === 'reduced'
										? 'gold-dark'
										: 'dark'
							}
							className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs shadow-lg"
						>
							<div className="flex flex-wrap items-center gap-2 font-pixel text-[10px]">
								<FlatIcon name="point" />
								<span>{isBangla ? 'সর্বশেষ নিষ্পত্তিকৃত কার্ড:' : 'LAST RESOLVED CARD:'}</span>
								<span className="text-amber-300">
									{gameState.lastQuizResult.cardName} (#{gameState.lastQuizResult.cardId})
								</span>
								<span aria-hidden="true">·</span>
								<span>
									{isBangla ? 'প্রতিরক্ষাকারীর উত্তর: ' : 'Defender Answer: '}
									<strong>{gameState.lastQuizResult.answer.toUpperCase()}</strong>
								</span>
								<span aria-hidden="true">→</span>
								<span className="underline">
									{gameState.lastQuizResult.resolution === 'nullified'
										? isBangla
											? 'বাতিল (0% প্রভাব)'
											: 'NULLIFIED (0% EFFECT)'
										: gameState.lastQuizResult.resolution === 'reduced'
											? isBangla
												? '35% শক্তিতে হ্রাসপ্রাপ্ত'
												: 'REDUCED TO 35% STRENGTH'
											: isBangla
												? 'পূর্ণ প্রভাব (100%)'
												: 'FULL EFFECT (100%)'}
								</span>
							</div>
							<span className="font-mono text-[11px] text-slate-300">
								{isBangla
									? `অপেক্ষমাণ সারি: ${gameState.pendingThrow.length}টি কার্ড`
									: `Pending Queue: ${gameState.pendingThrow.length} card(s)`}
							</span>
						</FlatWell>
					)}
				</div>
			) : null}

			{/* Arena Duel Viewport: Full-Screen moon.png Battle Map Stage + Top-Left / Top-Right HUD Panels */}
			<div className={cameraView === 'panoramic' ? 'relative h-full w-full' : 'relative space-y-4'}>
				{/* Single Pause Button anchored in the middle-top of the map */}
				<div className="absolute top-6 left-1/2 z-40 -translate-x-1/2 sm:top-7">
					<FlatButton
						variant="cream"
						size="sm"
						className="items-center justify-center px-4 text-center"
						onClick={() => {
							audioManager.playSfx('popup-open')
							setIsPauseMenuOpen(true)
						}}
					>
						{isBangla ? 'বিরতি' : 'Pause'}
					</FlatButton>
				</div>

				{cameraView === 'panoramic' && (
					<div className="relative h-full w-full">
						<BattleArenaStage
							fullScreen
							mapId={DEFAULT_BATTLE_MAP_ID}
							p1Character={effectiveP1Char}
							p2Character={effectiveP2Char}
							p1Name={p1State.name}
							p2Name={p2State.name}
							p1Animation={
								p1State.currentHealth <= 0 || (gameState.status === 'finished' && gameState.winner === 1)
									? 'death'
									: p1Anim
							}
							p2Animation={
								p2State.currentHealth <= 0 || (gameState.status === 'finished' && gameState.winner === 0)
									? 'death'
									: p2Anim
							}
							activePlayerIndex={activeIdx}
							isPlaying={gameState.status === 'playing'}
							onP1AnimationComplete={() => {
								if (p1Anim === 'turnStart') {
									setP1Anim('idle')
								} else if (p1Anim === 'turnEnd') {
									setP1Anim('idle2')
								} else if (p1Anim === 'attack' || p1Anim === 'hurt') {
									setP1Anim(getRestingIdleState(effectiveP1Char, activeIdx === 0))
								}
							}}
							onP2AnimationComplete={() => {
								if (p2Anim === 'turnStart') {
									setP2Anim('idle')
								} else if (p2Anim === 'turnEnd') {
									setP2Anim('idle2')
								} else if (p2Anim === 'attack' || p2Anim === 'hurt') {
									setP2Anim(getRestingIdleState(effectiveP2Char, activeIdx === 1))
								}
							}}
						/>

						{/* Top-Left Corner (Inset): Player 1 Health, Mana, & Status Effects */}
						<div className="pointer-events-auto absolute top-6 left-6 z-30 flex w-56 flex-col gap-1.5 sm:top-7 sm:left-8 sm:w-64">
							<FlatWell variant="dark" className="w-full overflow-hidden space-y-1.5 px-3 py-2 shadow-lg">
								<div className="flex items-center gap-2">
									<div className="flex-1">
										<FlatBar
											value={p1State.currentHealth}
											max={p1State.maxHealth}
											shieldValue={p1State.block}
											fillTone={p1State.currentHealth <= 20 ? 'red' : 'green'}
											heightClass="h-4"
										/>
									</div>
								</div>
								<div className="flex items-center justify-between gap-1.5">
									<span className="shrink-0 font-pixel text-[9px] text-amber-300">MANA</span>
									<FlatManaPips
										currentMana={p1State.mana}
										maxMana={p1State.maxMana}
										reservedMana={myPlayerIndex === 0 ? selectedManaCost : 0}
									/>
									<span className="shrink-0 font-mono text-[11px] font-bold text-slate-100 tabular-nums">
										{p1State.mana}/{p1State.maxMana}
									</span>
								</div>
							</FlatWell>
							<StatusBadges powers={p1State.powers} phoenixUsed={p1State.phoenixUsed} />
						</div>

						{/* Top-Right Corner (Inset): Player 2 Health, Mana, & Status Effects */}
						<div className="pointer-events-auto absolute top-6 right-6 z-30 flex w-56 flex-col items-end gap-1.5 sm:top-7 sm:right-8 sm:w-64">
							<FlatWell variant="dark" className="w-full overflow-hidden space-y-1.5 px-3 py-2 shadow-lg">
								<div className="flex items-center gap-2">
									<div className="flex-1">
										<FlatBar
											value={p2State.currentHealth}
											max={p2State.maxHealth}
											shieldValue={p2State.block}
											fillTone={p2State.currentHealth <= 20 ? 'red' : 'green'}
											heightClass="h-4"
										/>
									</div>
								</div>
								<div className="flex items-center justify-between gap-1.5">
									<span className="shrink-0 font-pixel text-[9px] text-sky-300">MANA</span>
									<FlatManaPips
										currentMana={p2State.mana}
										maxMana={p2State.maxMana}
										reservedMana={myPlayerIndex === 1 ? selectedManaCost : 0}
									/>
									<span className="shrink-0 font-mono text-[11px] font-bold text-slate-100 tabular-nums">
										{p2State.mana}/{p2State.maxMana}
									</span>
								</div>
							</FlatWell>
							<StatusBadges powers={p2State.powers} phoenixUsed={p2State.phoenixUsed} align="right" />
						</div>

						{/* Bottom-Left Corner (Inset): Player's Own Draw, Discard, & Exhaust Buttons */}
						{!showPassCurtain && (
							<div className="pointer-events-auto absolute bottom-6 left-6 z-40 flex flex-wrap items-center gap-1.5 sm:bottom-7 sm:left-8">
								<FlatButton
									variant="dark"
									size="sm"
									onClick={() => {
										audioManager.playSfx('popup-open')
										setPileModal({playerIndex: myPlayerIndex, pile: 'draw'})
									}}
								>
									{isBangla ? `ড্র (${displayedHandPlayer.drawPile.length})` : `Draw (${displayedHandPlayer.drawPile.length})`}
								</FlatButton>
								<FlatButton
									variant="dark"
									size="sm"
									onClick={() => {
										audioManager.playSfx('popup-open')
										setPileModal({playerIndex: myPlayerIndex, pile: 'discard'})
									}}
								>
									{isBangla
										? `ডিসকার্ড (${displayedHandPlayer.discardPile.length})`
										: `Discard (${displayedHandPlayer.discardPile.length})`}
								</FlatButton>
								<FlatButton
									variant="dark"
									size="sm"
									onClick={() => {
										audioManager.playSfx('popup-open')
										setPileModal({playerIndex: myPlayerIndex, pile: 'exhaust'})
									}}
								>
									{isBangla
										? `এক্সহস্ট (${displayedHandPlayer.exhaustPile.length})`
										: `Exhaust (${displayedHandPlayer.exhaustPile.length})`}
								</FlatButton>
							</div>
						)}

						{/* Floating Fanned Hand at the Middle-Bottom of the Map */}
						<div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex flex-col items-center px-4 sm:bottom-6">
							{showPassCurtain ? (
								<div className="flat-frame-gold pointer-events-auto flex flex-col items-center justify-center bg-slate-950/95 px-6 py-4 text-center shadow-2xl">
									<FlatBanner variant="offset-bl">
										{isBangla
											? `ডিভাইসটি প্লেয়ার ${activeIdx + 1}-কে দিন (${activePlayer.name.toUpperCase()})`
											: `PASS DEVICE TO PLAYER ${activeIdx + 1} (${activePlayer.name.toUpperCase()})`}
									</FlatBanner>
									<FlatButton
										variant="cream"
										size="sm"
										icon="play"
										onClick={() => setCurtainDismissedForTurn(gameState.turn)}
										className="mt-3"
									>
										{isBangla ? `P${activeIdx + 1}-এর হাত দেখুন` : `Reveal P${activeIdx + 1} Hand`}
									</FlatButton>
								</div>
							) : (
								<>
									{statusMessage && (
										<FlatWell
											variant="gold-dark"
											className="pointer-events-auto mb-2 px-3 py-1 font-mono text-[11px] text-amber-200 shadow-lg"
										>
											{statusMessage}
										</FlatWell>
									)}

									{/* Slay the Spire / Slay the Web Fanned Floating Hand */}
									{displayedHandPlayer.hand.length > 0 && (
										<div className="pointer-events-auto flex items-end justify-center pb-1">
											{displayedHandPlayer.hand.map((card, idx) => {
												const selIdx = selectedInstanceIds.indexOf(card.instanceId)
												const isSelected = selIdx !== -1
												const remainingMana = displayedHandPlayer.mana - selectedManaCost
												const playableAlone = canPlay(gameState, card, myPlayerIndex)
												const canAddToSelection =
													isSelected || (isMyTurnToAct && playableAlone && card.cost <= remainingMana)
												const liveText = formatLiveCardText(card, gameState, myPlayerIndex)
												const totalCards = displayedHandPlayer.hand.length
												const mid = (totalCards - 1) / 2
												const offset = idx - mid
												const rotateDeg = isSelected ? 0 : offset * 4.5
												const arcDropPx = isSelected ? -12 : Math.round(Math.abs(offset) * Math.abs(offset) * 3)

												return (
													<div
														key={card.instanceId}
														style={{
															marginLeft: idx === 0 ? '0px' : '-16px',
															transform: `translateY(${arcDropPx}px) rotate(${rotateDeg}deg)`,
															transformOrigin: 'bottom center',
														}}
														className={`relative transition-all duration-150 hover:z-40 hover:!-translate-y-4 hover:!rotate-0 ${
															isSelected ? 'z-30' : 'z-10'
														}`}
													>
														<NineSliceCard
															id={card.id}
															name={card.name}
															subject={card.subject}
															rarity={card.rarity}
															cost={card.cost}
															text={liveText}
															upgraded={card.upgraded}
															exhaust={card.exhaust}
															power={card.power}
															integerScale={2}
															scaleMultiplier={0.9}
															selected={isSelected}
															selectionOrder={isSelected ? selIdx + 1 : undefined}
															disabled={!canAddToSelection && !isSelected}
															onClick={() => handleToggleCard(card)}
														/>
													</div>
												)
											})}
										</div>
									)}
								</>
							)}
						</div>

						{/* Bottom-Right Corner (Inset): Turn Action Controls (Throw, Skip / End Turn) */}
						{!showPassCurtain && (
							<div className="pointer-events-auto absolute right-6 bottom-6 z-40 flex flex-wrap items-center justify-end gap-2 sm:right-8 sm:bottom-7">
								{selectedInstanceIds.length > 0 && (
									<FlatButton
										variant="cream"
										size="sm"
										icon="play"
										onClick={handleThrowSelected}
										disabled={!isMyTurnToAct}
									>
										{isBangla
											? `ছুঁড়ুন (${selectedInstanceIds.length} · ${selectedManaCost}M)`
											: `Throw (${selectedInstanceIds.length} · ${selectedManaCost}M)`}
									</FlatButton>
								)}

								{!hasThrownThisTurn && gameState.throwsThisTurn === 0 ? (
									<FlatButton
										variant="blue"
										size="sm"
										icon="plus"
										onClick={handleSkipTurn}
										disabled={!isMyTurnToAct}
										title={
											isBangla
												? 'এই চালে কোনো কার্ড না ছুঁড়ে +1 বোনাস মানা (সর্বোচ্চ 5) পান এবং চাল শেষ করুন'
												: 'Throw nothing this turn to gain +1 bonus Mana (up to 5) and end turn'
										}
									>
										{isBangla ? 'চাল স্কিপ (+1 মানা)' : 'Skip Turn (+1 Mana)'}
									</FlatButton>
								) : (
									<FlatButton variant="gold" size="sm" icon="arrow" onClick={handleEndTurn} disabled={!isMyTurnToAct}>
										{isBangla ? 'চাল শেষ' : 'End Turn'}
									</FlatButton>
								)}
							</div>
						)}
					</div>
				)}

				{cameraView === 'split' && (
					<div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
						{/* Player 1 Split Stage */}
						<FlatPanel
							variant={activeIdx === 0 ? 'gold' : 'silver'}
							wellVariant={activeIdx === 0 ? 'gold-dark' : 'dark'}
							wellClassName="flex flex-col items-center justify-between p-4 space-y-2"
						>
							<div className="flex w-full items-start justify-between gap-2">
								<div className="w-52 space-y-1">
									<div className="flex items-center gap-1.5">
										<div className="flex-1">
											<FlatBar
												value={p1State.currentHealth}
												max={p1State.maxHealth}
												shieldValue={p1State.block}
												fillTone={p1State.currentHealth <= 20 ? 'red' : 'green'}
												heightClass="h-3.5"
											/>
										</div>
									</div>
									<div className="flex items-center justify-between gap-1.5">
										<span className="shrink-0 font-pixel text-[8px] text-amber-300">MANA</span>
										<FlatManaPips
											currentMana={p1State.mana}
											maxMana={p1State.maxMana}
											reservedMana={myPlayerIndex === 0 ? selectedManaCost : 0}
										/>
										<span className="shrink-0 font-mono text-[10px] font-bold text-slate-100 tabular-nums">
											{p1State.mana}/{p1State.maxMana}
										</span>
									</div>
									<StatusBadges powers={p1State.powers} phoenixUsed={p1State.phoenixUsed} />
								</div>

								<div className="flex flex-col items-end gap-1">
									{activeIdx === 0 && gameState.status === 'playing' && (
										<FlatBanner variant="offset-bl" className="px-2 py-0.5 text-[9px]">
											{isBangla ? 'সক্রিয় চাল' : 'ACTIVE TURN'}
										</FlatBanner>
									)}
									<span className="font-pixel text-sm text-amber-300">
										{getCharacterDisplay(effectiveP1Char, CHARACTERS[effectiveP1Char], lang).name}
									</span>
								</div>
							</div>

							<PlayerMapCropStage
								seat={1}
								mapId={DEFAULT_BATTLE_MAP_ID}
								characterId={effectiveP1Char}
								animation={
									p1State.currentHealth <= 0 || (gameState.status === 'finished' && gameState.winner === 1)
										? 'death'
										: p1Anim
								}
								facing="right"
								onAnimationComplete={() => {
									if (p1Anim === 'turnStart') {
										setP1Anim('idle')
									} else if (p1Anim === 'turnEnd') {
										setP1Anim('idle2')
									} else if (p1Anim === 'attack' || p1Anim === 'hurt') {
										setP1Anim(getRestingIdleState(effectiveP1Char, activeIdx === 0))
									}
								}}
							/>
						</FlatPanel>

						{/* Player 2 Split Stage */}
						<FlatPanel
							variant={activeIdx === 1 ? 'blue' : 'silver'}
							wellVariant={activeIdx === 1 ? 'blue-dark' : 'dark'}
							wellClassName="flex flex-col items-center justify-between p-4 space-y-2"
						>
							<div className="flex w-full items-start justify-between gap-2">
								<div className="flex flex-col items-start gap-1">
									{activeIdx === 1 && gameState.status === 'playing' && (
										<FlatBanner variant="offset-bl" className="px-2 py-0.5 text-[9px]">
											{isBangla ? 'সক্রিয় চাল' : 'ACTIVE TURN'}
										</FlatBanner>
									)}
									<span className="font-pixel text-sm text-sky-300">
										{getCharacterDisplay(effectiveP2Char, CHARACTERS[effectiveP2Char], lang).name}
									</span>
								</div>

								<div className="w-52 space-y-1">
									<div className="flex items-center gap-1.5">
										<div className="flex-1">
											<FlatBar
												value={p2State.currentHealth}
												max={p2State.maxHealth}
												shieldValue={p2State.block}
												fillTone={p2State.currentHealth <= 20 ? 'red' : 'green'}
												heightClass="h-3.5"
											/>
										</div>
									</div>
									<div className="flex items-center justify-between gap-1.5">
										<span className="shrink-0 font-pixel text-[8px] text-sky-300">MANA</span>
										<FlatManaPips
											currentMana={p2State.mana}
											maxMana={p2State.maxMana}
											reservedMana={myPlayerIndex === 1 ? selectedManaCost : 0}
										/>
										<span className="shrink-0 font-mono text-[10px] font-bold text-slate-100 tabular-nums">
											{p2State.mana}/{p2State.maxMana}
										</span>
									</div>
									<StatusBadges powers={p2State.powers} phoenixUsed={p2State.phoenixUsed} align="right" />
								</div>
							</div>

							<PlayerMapCropStage
								seat={2}
								mapId={DEFAULT_BATTLE_MAP_ID}
								characterId={effectiveP2Char}
								animation={
									p2State.currentHealth <= 0 || (gameState.status === 'finished' && gameState.winner === 0)
										? 'death'
										: p2Anim
								}
								facing="left"
								onAnimationComplete={() => {
									if (p2Anim === 'turnStart') {
										setP2Anim('idle')
									} else if (p2Anim === 'turnEnd') {
										setP2Anim('idle2')
									} else if (p2Anim === 'attack' || p2Anim === 'hurt') {
										setP2Anim(getRestingIdleState(effectiveP2Char, activeIdx === 1))
									}
								}}
							/>
						</FlatPanel>
					</div>
				)}
			</div>

			{/* Split Camera Fallback Floating Hand */}
			{cameraView === 'split' && (
				<div className="relative flex flex-col items-center pt-4 pb-2">
					{statusMessage && (
						<FlatWell
							variant="gold-dark"
							className="mb-2 px-3 py-1 font-mono text-[11px] text-amber-200 shadow-lg"
						>
							{statusMessage}
						</FlatWell>
					)}

					<div className="flex items-end justify-center pb-2">
						{displayedHandPlayer.hand.map((card, idx) => {
							const selIdx = selectedInstanceIds.indexOf(card.instanceId)
							const isSelected = selIdx !== -1
							const remainingMana = displayedHandPlayer.mana - selectedManaCost
							const playableAlone = canPlay(gameState, card, myPlayerIndex)
							const canAddToSelection = isSelected || (isMyTurnToAct && playableAlone && card.cost <= remainingMana)
							const liveText = formatLiveCardText(card, gameState, myPlayerIndex)
							const totalCards = displayedHandPlayer.hand.length
							const mid = (totalCards - 1) / 2
							const offset = idx - mid
							const rotateDeg = isSelected ? 0 : offset * 4.5
							const arcDropPx = isSelected ? -12 : Math.round(Math.abs(offset) * Math.abs(offset) * 3)

							return (
								<div
									key={card.instanceId}
									style={{
										marginLeft: idx === 0 ? '0px' : '-16px',
										transform: `translateY(${arcDropPx}px) rotate(${rotateDeg}deg)`,
										transformOrigin: 'bottom center',
									}}
									className={`relative transition-all duration-150 hover:z-40 hover:!-translate-y-4 hover:!rotate-0 ${
										isSelected ? 'z-30' : 'z-10'
									}`}
								>
									<NineSliceCard
										id={card.id}
										name={card.name}
										subject={card.subject}
										rarity={card.rarity}
										cost={card.cost}
										text={liveText}
										upgraded={card.upgraded}
										exhaust={card.exhaust}
										power={card.power}
										integerScale={2}
										scaleMultiplier={0.9}
										selected={isSelected}
										selectionOrder={isSelected ? selIdx + 1 : undefined}
										disabled={!canAddToSelection && !isSelected}
										onClick={() => handleToggleCard(card)}
									/>
								</div>
							)
						})}
					</div>

					{/* Bottom-Left Pile Controls (Local / Active Player Only) */}
					<div className="absolute bottom-2 left-2 z-40 flex flex-wrap items-center gap-1.5">
						<FlatButton
							variant="dark"
							size="sm"
							onClick={() => {
								audioManager.playSfx('popup-open')
								setPileModal({playerIndex: myPlayerIndex, pile: 'draw'})
							}}
						>
							{isBangla ? `ড্র (${displayedHandPlayer.drawPile.length})` : `Draw (${displayedHandPlayer.drawPile.length})`}
						</FlatButton>
						<FlatButton
							variant="dark"
							size="sm"
							onClick={() => {
								audioManager.playSfx('popup-open')
								setPileModal({playerIndex: myPlayerIndex, pile: 'discard'})
							}}
						>
							{isBangla
								? `ডিসকার্ড (${displayedHandPlayer.discardPile.length})`
								: `Discard (${displayedHandPlayer.discardPile.length})`}
						</FlatButton>
						<FlatButton
							variant="dark"
							size="sm"
							onClick={() => {
								audioManager.playSfx('popup-open')
								setPileModal({playerIndex: myPlayerIndex, pile: 'exhaust'})
							}}
						>
							{isBangla
								? `এক্সহস্ট (${displayedHandPlayer.exhaustPile.length})`
								: `Exhaust (${displayedHandPlayer.exhaustPile.length})`}
						</FlatButton>
					</div>

					<div className="absolute right-2 bottom-2 z-40 flex flex-wrap items-center justify-end gap-2">
						{selectedInstanceIds.length > 0 && (
							<FlatButton
								variant="cream"
								size="sm"
								icon="play"
								onClick={handleThrowSelected}
								disabled={!isMyTurnToAct}
							>
								{isBangla
									? `ছুঁড়ুন (${selectedInstanceIds.length} · ${selectedManaCost}M)`
									: `Throw (${selectedInstanceIds.length} · ${selectedManaCost}M)`}
							</FlatButton>
						)}

						{!hasThrownThisTurn && gameState.throwsThisTurn === 0 ? (
							<FlatButton
								variant="blue"
								size="sm"
								icon="plus"
								onClick={handleSkipTurn}
								disabled={!isMyTurnToAct}
							>
								{isBangla ? 'চাল স্কিপ (+1 মানা)' : 'Skip Turn (+1 Mana)'}
							</FlatButton>
						) : (
							<FlatButton variant="gold" size="sm" icon="arrow" onClick={handleEndTurn} disabled={!isMyTurnToAct}>
								{isBangla ? 'চাল শেষ' : 'End Turn'}
							</FlatButton>
						)}
					</div>
				</div>
			)}

			{/* Active Quiz Modal when status === 'quizzing' and it is this client's quiz to answer */}
			{currentQuizEntry && isMyQuizToAnswer && (
				<QuizCanvasModal
					entry={currentQuizEntry}
					queuePosition={1}
					queueTotal={gameState.pendingThrow.length}
					attackerCharacter={currentQuizEntry.casterIndex === 0 ? effectiveP1Char : effectiveP2Char}
					defenderCharacter={currentQuizEntry.defenderIndex === 0 ? effectiveP1Char : effectiveP2Char}
					formattedCardText={formatLiveCardText(currentQuizEntry.card, gameState, currentQuizEntry.casterIndex)}
					seed={gameState.seed}
					isBotDefender={!isOnlineMultiplayer && playMode === 'vs-bot' && currentQuizEntry.defenderIndex === 1}
					onResolve={handleResolveQuiz}
				/>
			)}

			{/* Pile Inspection Modal */}
			{pileModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
					<FlatPanel
						variant="silver"
						wellVariant="dark"
						className="max-h-[85vh] w-full max-w-[960px] overflow-y-auto"
						wellClassName="p-6 space-y-4"
					>
						<div className="flex items-center justify-between border-b border-slate-800 pb-3">
							<FlatBanner variant="offset-bl">
								P{pileModal.playerIndex + 1} ({gameState.players[pileModal.playerIndex].name}) ·{' '}
								{pileModal.pile === 'draw'
									? isBangla
										? 'ড্র পাইল (DRAW PILE)'
										: 'DRAW PILE'
									: pileModal.pile === 'discard'
										? isBangla
											? 'ডিসকার্ড পাইল (DISCARD PILE)'
											: 'DISCARD PILE'
										: isBangla
											? 'এক্সহস্ট পাইল (EXHAUST PILE)'
											: 'EXHAUST PILE'}
							</FlatBanner>
							<FlatButton
								variant="cream"
								size="sm"
								icon="cross"
								onClick={() => {
									audioManager.playSfx('popup-close')
									setPileModal(null)
								}}
							>
								{isBangla ? 'বন্ধ করুন' : 'Close'}
							</FlatButton>
						</div>

						{(() => {
							const p = gameState.players[pileModal.playerIndex]
							const list =
								pileModal.pile === 'draw'
									? [...p.drawPile].sort((a, b) => a.id.localeCompare(b.id))
									: pileModal.pile === 'discard'
										? p.discardPile
										: p.exhaustPile

							if (list.length === 0) {
								return (
									<div className="py-10 text-center font-pixel text-xs text-slate-400">
										{isBangla ? 'পাইলটি খালি।' : 'Pile is empty.'}
									</div>
								)
							}

							return (
								<div className="flex flex-wrap items-center justify-center gap-4 py-2">
									{list.map((c) => (
										<NineSliceCard
											key={c.instanceId}
											id={c.id}
											name={c.name}
											subject={c.subject}
											rarity={c.rarity}
											cost={c.cost}
											text={c.text}
											upgraded={c.upgraded}
											exhaust={c.exhaust}
											power={c.power}
											integerScale={2}
										/>
									))}
								</div>
							)
						})()}
					</FlatPanel>
				</div>
			)}

			{/* Finished Match / Forfeit Pop-Up Modal */}
			{gameState.status === 'finished' && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
					<FlatPanel
						variant="gold"
						wellVariant="gold-dark"
						className="max-h-[90vh] w-full max-w-[780px] overflow-y-auto"
						wellClassName="p-6 space-y-5 text-center"
					>
						<div className="flex justify-center">
							<FlatBanner variant="offset-bl">
								{gameState.forfeitedBy !== null
									? isBangla
										? 'ম্যাচ পরিত্যক্ত (FORFEITED)'
										: 'MATCH FORFEITED'
									: isBangla
										? 'ম্যাচ সম্পন্ন'
										: 'MATCH COMPLETE'}
							</FlatBanner>
						</div>

						<div className="space-y-2">
							<div className="font-pixel text-sm text-amber-300">
								{gameState.winner !== null
									? isBangla
										? `বিজয়! প্লেয়ার ${gameState.winner + 1} (${gameState.players[gameState.winner].name.toUpperCase()}) ডুয়েল জিতেছেন!`
										: `VICTORY! PLAYER ${gameState.winner + 1} (${gameState.players[gameState.winner].name.toUpperCase()}) WINS THE DUEL!`
									: isBangla
										? 'ড্র! ম্যাচটি 500-অ্যাকশন সীমায় পৌঁছেছে!'
										: 'DRAW! MATCH REACHED THE 500-ACTION CAP!'}
							</div>
							<p className="text-xs text-slate-200">
								{isBangla
									? `${gameState.round} রাউন্ডে (${gameState.turn} চালে) সম্পন্ন হয়েছে।${
											gameState.forfeitedBy !== null ? ` প্লেয়ার ${gameState.forfeitedBy + 1} হার মেনে নিয়েছেন।` : ''
										}`
									: `Completed in ${gameState.round} round(s) (${gameState.turn} turns).${
											gameState.forfeitedBy !== null ? ` Player ${gameState.forfeitedBy + 1} forfeited.` : ''
										}`}
							</p>
						</div>

						<FailedQuestionsReview
							quizHistory={gameState.quizHistory}
							seed={gameState.seed}
							localPlayerIndex={isOnlineMultiplayer ? (onlineSeat === 1 ? 0 : 1) : 0}
							isHotseat={!isOnlineMultiplayer && (playMode === 'hotseat-open' || playMode === 'hotseat-curtain')}
							p1Name={p1State.name}
							p2Name={p2State.name}
							compact
						/>

						<div className="flex flex-wrap items-center justify-center gap-3 pt-1">
							<FlatButton variant="silver" size="md" icon="play" onClick={handleRematchClick}>
								{isBangla ? 'তাৎক্ষণিক রিম্যাচ' : 'Instant Rematch'}
							</FlatButton>
							<FlatButton variant="cream" size="md" icon="arrow" onClick={handleProceedToResult}>
								{isBangla ? 'ম্যাচের সারাংশ দেখুন' : 'View Match Summary'}
							</FlatButton>
							{onBackToMenu && (
								<FlatButton
									variant="dark"
									size="md"
									icon="arrow"
									onClick={() => {
										audioManager.playSfx('click')
										onBackToMenu()
									}}
								>
									{isBangla ? 'প্রধান মেনু' : 'Main Menu'}
								</FlatButton>
							)}
						</div>
					</FlatPanel>
				</div>
			)}

			{/* Pause Menu Modal (Main Menu, Split Camera, Forfeit) */}
			{isPauseMenuOpen && (
				<div
					onClick={() => {
						audioManager.playSfx('popup-close')
						setIsPauseMenuOpen(false)
					}}
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
				>
					<div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px]">
						<FlatPanel variant="gold" wellVariant="dark" className="w-full" wellClassName="p-6 space-y-5">
							<div className="flex items-center justify-between border-b border-slate-800 pb-3">
								<FlatBanner variant="offset-bl">{isBangla ? 'বিরতি মেনু' : 'PAUSE MENU'}</FlatBanner>
								<FlatButton
									variant="dark"
									size="sm"
									icon="cross"
									onClick={() => {
										audioManager.playSfx('popup-close')
										setIsPauseMenuOpen(false)
									}}
								>
									{isBangla ? 'খেলায় ফিরুন' : 'Resume'}
								</FlatButton>
							</div>

							<div className="flex flex-col gap-3">
								<FlatButton
									variant="blue"
									size="lg"
									onClick={() => {
										audioManager.playSfx('click')
										setCameraView((prev) => (prev === 'panoramic' ? 'split' : 'panoramic'))
										setIsPauseMenuOpen(false)
									}}
									className="w-full justify-center"
								>
									{cameraView === 'panoramic'
										? isBangla
											? 'স্প্লিট ক্যামেরা (Split Camera)'
											: 'Split Camera'
										: isBangla
											? 'ফুল ম্যাপ ক্যামেরা (Full Map Camera)'
											: 'Full Map Camera'}
								</FlatButton>

								<FlatButton
									variant="orange"
									size="lg"
									icon="cross"
									disabled={gameState.status === 'finished'}
									onClick={() => {
										setIsPauseMenuOpen(false)
										handleForfeit(isOnlineMultiplayer ? myPlayerIndex : activeIdx)
									}}
									className="w-full justify-center"
								>
									{isBangla ? 'ম্যাচ ছেড়ে দিন (Forfeit)' : 'Forfeit Match'}
								</FlatButton>

								{onBackToMenu && (
									<FlatButton
										variant="cream"
										size="lg"
										icon="arrow"
										onClick={() => {
											audioManager.playSfx('click')
											setIsPauseMenuOpen(false)
											onBackToMenu()
										}}
										className="w-full justify-center"
									>
										{isBangla ? 'প্রধান মেনু' : 'Main Menu'}
									</FlatButton>
								)}
							</div>
						</FlatPanel>
					</div>
				</div>
			)}
		</div>
	)
}
