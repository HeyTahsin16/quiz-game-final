import type {User} from 'firebase/auth'
import {useCallback, useEffect, useState} from 'react'
import {audioManager} from './audio/audioManager'
import type {CharacterId} from './engine/config'
import {subscribeAuth} from './firebase/client'
import type {MultiplayerSeat, RoomDocument} from './firebase/multiplayer'
import {LanguageProvider, useLanguage} from './i18n/LanguageContext'
import {FlatBanner, FlatButton, FlatPanel, FlatWell} from './ui/components/FlatUi'
import {SettingsContent} from './ui/components/SettingsModal'
import {BattleScreen, type LocalPlayMode, type MatchSummary} from './ui/screens/BattleScreen'
import {CharacterSelectScreen} from './ui/screens/CharacterSelectScreen'
import {CollectionScreen} from './ui/screens/CollectionScreen'
import {CreditsScreen} from './ui/screens/CreditsScreen'
import {LobbyScreen} from './ui/screens/LobbyScreen'
import {ResultScreen} from './ui/screens/ResultScreen'
import {TitleScreen} from './ui/screens/TitleScreen'
import {preloadAllCardFrames} from './ui/utils/nineSliceCache'

export type ScreenRoute =
	| 'title'
	| 'select'
	| 'lobby'
	| 'battle'
	| 'result'
	| 'collection'
	| 'settings'
	| 'credits'

function parseHashRoute(): ScreenRoute {
	const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase()
	if (hash === 'select') return 'select'
	if (hash === 'lobby') return 'lobby'
	if (hash === 'battle') return 'battle'
	if (hash === 'result') return 'result'
	if (hash === 'collection') return 'collection'
	if (hash === 'settings') return 'settings'
	if (hash === 'credits') return 'credits'
	return 'title'
}

const ROUTE_BANNER_LABELS: Record<ScreenRoute, {en: string; bn: string}> = {
	title: {en: 'MAIN MENU', bn: 'প্রধান মেনু'},
	select: {en: 'PLAY · CHOOSE YOUR FIGHTER', bn: 'খেলুন · আপনার যোদ্ধা নির্বাচন করুন'},
	lobby: {en: 'PLAY · ROOM LOBBY', bn: 'খেলুন · রুম লবি'},
	battle: {en: 'BATTLE ARENA', bn: 'যুদ্ধের ময়দান'},
	result: {en: 'MATCH RESULT', bn: 'ম্যাচের ফলাফল'},
	collection: {en: 'COLLECTION · CARDS & DECKS', bn: 'সংগ্রহ · কার্ড ও ডেক'},
	settings: {en: 'SETTINGS · AUDIO & SOUND', bn: 'সেটিংস · অডিও ও সাউন্ড'},
	credits: {en: 'CREDITS & ATTRIBUTIONS', bn: 'কৃতজ্ঞতা ও স্বীকৃতি'},
}

function checkIsMobilePortrait(): boolean {
	if (typeof window === 'undefined') return false
	const w = window.innerWidth
	const h = window.innerHeight
	return w < 900 && h > w
}

/**
 * Attempts to lock the mobile screen to landscape using the Screen Orientation API
 * (and requests fullscreen first if required by the browser).
 */
async function attemptLandscapeLock(requestFullscreenFirst = false): Promise<boolean> {
	try {
		if (requestFullscreenFirst && typeof document !== 'undefined' && !document.fullscreenElement) {
			await document.documentElement.requestFullscreen?.()
		}
		const orientationApi = (
			window.screen as Screen & {
				orientation?: ScreenOrientation & {lock?: (mode: string) => Promise<void>}
			}
		)?.orientation
		if (orientationApi?.lock) {
			await orientationApi.lock('landscape')
			return true
		}
	} catch {
		// Browser or OS blocked programmatic orientation lock; user must rotate device physically
	}
	return false
}

function AppContent() {
	const {isBangla} = useLanguage()
	const [route, setRoute] = useState<ScreenRoute>(() => parseHashRoute())
	const [p1Character, setP1Character] = useState<CharacterId>('dark-ninja')
	const [p2Character, setP2Character] = useState<CharacterId>('knight')
	const [roomCode, setRoomCode] = useState<string>('QD7X9K')
	const [localPlayMode, setLocalPlayMode] = useState<LocalPlayMode>('vs-bot')
	const [isOnlineMultiplayer, setIsOnlineMultiplayer] = useState<boolean>(false)
	const [onlineSeat, setOnlineSeat] = useState<MultiplayerSeat>(1)
	const [activeOnlineRoom, setActiveOnlineRoom] = useState<RoomDocument | null>(null)
	const [authUser, setAuthUser] = useState<User | null>(null)
	const [winner, setWinner] = useState<0 | 1 | 2>(1)
	const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null)
	const [isMobilePortrait, setIsMobilePortrait] = useState<boolean>(() => checkIsMobilePortrait())
	const [portraitDismissed, setPortraitDismissed] = useState<boolean>(false)
	const [lockFeedback, setLockFeedback] = useState<string | null>(null)

	useEffect(() => {
		preloadAllCardFrames([2, 3, 4])
		audioManager.preloadAllVoiceClips()

		const unsubAuth = subscribeAuth((u) => {
			setAuthUser(u)
		})

		const onHashChange = () => {
			audioManager.playSfx('cursor')
			setRoute(parseHashRoute())
		}
		window.addEventListener('hashchange', onHashChange)

		const onViewportChange = () => {
			const portrait = checkIsMobilePortrait()
			setIsMobilePortrait(portrait)
			if (!portrait) {
				setLockFeedback(null)
			}
		}
		window.addEventListener('resize', onViewportChange)
		window.addEventListener('orientationchange', onViewportChange)

		// Unlock background music & attempt automatic landscape lock on first user gesture
		const onFirstGesture = () => {
			if (!audioManager.isMusicMuted() && !audioManager.isBgmPlaying()) {
				audioManager.playBgm(parseHashRoute() === 'battle' ? 'battle' : 'menu')
			}
			if (checkIsMobilePortrait()) {
				attemptLandscapeLock(false)
			}
		}
		window.addEventListener('pointerdown', onFirstGesture, {passive: true})
		window.addEventListener('keydown', onFirstGesture, {passive: true})

		return () => {
			unsubAuth()
			window.removeEventListener('hashchange', onHashChange)
			window.removeEventListener('resize', onViewportChange)
			window.removeEventListener('orientationchange', onViewportChange)
			window.removeEventListener('pointerdown', onFirstGesture)
			window.removeEventListener('keydown', onFirstGesture)
		}
	}, [])

	// Switch background music track automatically when navigating between Menu/Lobby and Battle Arena
	useEffect(() => {
		const targetTrack = route === 'battle' ? 'battle' : 'menu'
		audioManager.playBgm(targetTrack)
	}, [route])

	const navigate = useCallback((next: ScreenRoute) => {
		audioManager.playSfx('click')
		window.location.hash = next === 'title' ? '#/' : `#/${next}`
		setRoute(next)
	}, [])

	const handleForceLandscapeClick = async () => {
		audioManager.playSfx('select')
		const locked = await attemptLandscapeLock(true)
		if (!locked) {
			setLockFeedback(
				isBangla
					? 'আপনার ব্রাউজার বা ডিভাইসে ম্যানুয়াল রোটেশন প্রয়োজন। অনুগ্রহ করে অটো-রোটেট চালু করে ফোনটি আড়াআড়িভাবে ঘোরান।'
					: 'Your browser or device requires manual rotation. Please unlock auto-rotate and turn your phone horizontally.',
			)
		}
	}

	return (
		<div className="flex min-h-screen flex-col bg-[#141926] text-slate-100">
			{/* Forced Landscape / Rotate Device Prompt on Mobile Portrait */}
			{isMobilePortrait && !portraitDismissed && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0f1a]/95 p-5">
					<FlatPanel
						variant="gold"
						wellVariant="dark"
						className="w-full max-w-[420px]"
						wellClassName="flex flex-col items-center p-6 text-center space-y-5"
					>
						<FlatBanner variant="offset-bl">
							{isBangla ? 'ল্যান্ডস্কেপ মোড আবশ্যক' : 'LANDSCAPE MODE REQUIRED'}
						</FlatBanner>

						{/* Pixel-Art Phone Rotation Graphic */}
						<FlatWell variant="gold-dark" className="flex items-center justify-center gap-4 px-6 py-5">
							<div className="flex h-14 w-9 items-center justify-center border-2 border-slate-400 bg-slate-900 font-pixel text-[10px] text-slate-400">
								9:16
							</div>
							<span className="font-pixel text-lg text-amber-300">→</span>
							<div className="flex h-9 w-16 items-center justify-center border-2 border-amber-300 bg-amber-950/60 font-pixel text-[10px] text-amber-300">
								16:9
							</div>
						</FlatWell>

						<div className="space-y-2">
							<h2 className="font-pixel text-base text-white">
								{isBangla ? 'আপনার ডিভাইসটি ল্যান্ডস্কেপে ঘোরান' : 'Rotate Your Device to Landscape'}
							</h2>
							<p className="text-xs leading-relaxed text-slate-300">
								{isBangla
									? 'Quiz Duel আড়াআড়ি ওয়াইডস্ক্রিন খেলার জন্য তৈরি, যাতে উভয় চ্যাম্পিয়ন, 24-কার্ডের হাত এবং STEM কুইজ চ্যালেঞ্জ স্ক্রিনে সুন্দরভাবে ফিট হয়।'
									: 'Quiz Duel is designed for horizontal widescreen play so both champions, the 24-card hand, and the STEM quiz challenge fit cleanly on screen.'}
							</p>
						</div>

						{lockFeedback && (
							<FlatWell variant="blue-dark" className="w-full p-3 text-xs text-amber-200">
								{lockFeedback}
							</FlatWell>
						)}

						<div className="flex w-full flex-col gap-2.5 pt-1">
							<FlatButton
								variant="cream"
								size="lg"
								icon="play"
								onClick={handleForceLandscapeClick}
								className="w-full justify-center"
							>
								{isBangla ? 'ল্যান্ডস্কেপ মোড চালু করুন' : 'Force Landscape Mode'}
							</FlatButton>

							<FlatButton
								variant="dark"
								size="sm"
								onClick={() => {
									audioManager.playSfx('cancel')
									setPortraitDismissed(true)
								}}
								className="w-full justify-center"
							>
								{isBangla ? 'বর্তমান ভিউতে চালিয়ে যান' : 'Continue in Current View'}
							</FlatButton>
						</div>
					</FlatPanel>
				</div>
			)}

			{/* Single Uniform In-Game Top HUD Bar on Sub-Screens (Hidden on Title Main Menu, Settings, Collection, Character Select, Lobby, Credits, and Battle) */}
			{route !== 'title' &&
				route !== 'settings' &&
				route !== 'collection' &&
				route !== 'select' &&
				route !== 'lobby' &&
				route !== 'credits' &&
				route !== 'battle' && (
					<header className="flat-frame-silver bg-[#adb7c4] px-2 py-1">
						<div className="flat-slot-dark flex flex-wrap items-center justify-between gap-4 px-4 py-2">
							<FlatButton
								variant="cream"
								size="sm"
								icon="arrow"
								onClick={() => navigate('title')}
							>
								{isBangla ? 'প্রধান মেনু' : 'Main Menu'}
							</FlatButton>

							<FlatBanner variant="offset-bl" className="px-3 py-0.5 text-[11px]">
								{isBangla ? ROUTE_BANNER_LABELS[route].bn : ROUTE_BANNER_LABELS[route].en}
							</FlatBanner>

							<div className="flex min-w-[110px] items-center justify-end gap-2" />
						</div>
					</header>
				)}

			{/* Main Screen Content */}
			<main className="flex-1">
				{route === 'title' && (
					<TitleScreen
						onStartSelect={() => navigate('select')}
						onOpenCollection={() => navigate('collection')}
						onOpenSettings={() => navigate('settings')}
						onOpenCredits={() => navigate('credits')}
					/>
				)}

				{route === 'select' && (
					<CharacterSelectScreen
						p1Character={p1Character}
						p2Character={p2Character}
						onSelectP1={setP1Character}
						onSelectP2={setP2Character}
						onProceedToLobby={() => navigate('lobby')}
						onStartQuickBattle={(mode) => {
							setLocalPlayMode(mode)
							setIsOnlineMultiplayer(false)
							navigate('battle')
						}}
						onBackToMenu={() => navigate('title')}
					/>
				)}

				{route === 'collection' && <CollectionScreen onBackToMenu={() => navigate('title')} />}

				{route === 'settings' && (
					<div className="mx-auto flex max-w-[900px] flex-col items-center px-6 py-8">
						<SettingsContent onBackToMenu={() => navigate('title')} />
					</div>
				)}

				{route === 'credits' && <CreditsScreen onBackToMenu={() => navigate('title')} />}

				{route === 'lobby' && (
					<LobbyScreen
						p1Character={p1Character}
						p2Character={p2Character}
						authUser={authUser}
						onBackToFighters={() => navigate('select')}
						onStartOnlineBattle={(code, seat, roomDoc) => {
							setRoomCode(code)
							setOnlineSeat(seat)
							setIsOnlineMultiplayer(true)
							if (roomDoc) {
								setActiveOnlineRoom(roomDoc)
								setP1Character(roomDoc.hostCharacter)
								setP2Character(roomDoc.guestCharacter)
							}
							navigate('battle')
						}}
					/>
				)}

				{route === 'battle' && (
					<BattleScreen
						p1Character={p1Character}
						p2Character={p2Character}
						roomCode={roomCode}
						localPlayMode={localPlayMode}
						isOnlineMultiplayer={isOnlineMultiplayer}
						onlineSeat={onlineSeat}
						initialRoom={activeOnlineRoom}
						onBackToMenu={() => navigate('title')}
						onFinishBattle={(winSeat, summary) => {
							setWinner(winSeat)
							setMatchSummary(summary ?? null)
							navigate('result')
						}}
					/>
				)}

				{route === 'result' && (
					<ResultScreen
						winner={winner}
						p1Character={p1Character}
						p2Character={p2Character}
						summary={matchSummary}
						onRematch={() => navigate('battle')}
						onReturnSelect={() => navigate('select')}
					/>
				)}
			</main>
		</div>
	)
}

export function App() {
	return (
		<LanguageProvider>
			<AppContent />
		</LanguageProvider>
	)
}

