import {useEffect, useState} from 'react'
import {audioManager, BGM_TRACK_MAP, type BgmTrackId} from '../../audio/audioManager'
import {BGM_LABELS_BN, useLanguage} from '../../i18n/LanguageContext'
import {FlatBanner, FlatBar, FlatButton, FlatPanel, FlatWell} from './FlatUi'

export interface SettingsPanelProps {
	onClose?: () => void
	onBackToMenu?: () => void
	isModal?: boolean
}

interface VolumeSliderRowProps {
	label: string
	sublabel: string
	value: number
	fillTone: 'gold' | 'green' | 'teal' | 'red' | 'cream'
	disabled?: boolean
	onChange: (nextValue: number) => void
	onTest?: () => void
	testLabel?: string
}

function VolumeSliderRow({
	label,
	sublabel,
	value,
	fillTone,
	disabled = false,
	onChange,
	onTest,
	testLabel,
}: VolumeSliderRowProps) {
	const pct = Math.round(value * 100)

	const stepBy = (delta: number) => {
		const next = Math.max(0, Math.min(1, Math.round((value + delta) * 20) / 20))
		onChange(next)
	}

	return (
		<FlatWell variant="dark" className={`p-4 ${disabled ? 'opacity-50' : ''}`}>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<div className="font-pixel text-xs text-white">{label}</div>
					<div className="mt-0.5 text-xs text-slate-300">{sublabel}</div>
				</div>
				<div className="flex items-center gap-2">
					<span className="font-mono text-sm font-bold text-amber-300 tabular-nums">{pct}%</span>
					{onTest && testLabel && (
						<FlatButton variant="dark" size="sm" icon="play" onClick={onTest} disabled={disabled}>
							{testLabel}
						</FlatButton>
					)}
				</div>
			</div>

			<div className="mt-3 flex items-center gap-3">
				<FlatButton
					variant="silver"
					size="sm"
					icon="minus"
					onClick={() => stepBy(-0.05)}
					disabled={disabled || pct <= 0}
					title={`Decrease ${label}`}
				/>

				<div className="relative flex-1">
					<FlatBar value={pct} max={100} fillTone={fillTone} heightClass="h-6" />
					<input
						type="range"
						min={0}
						max={100}
						step={1}
						disabled={disabled}
						value={pct}
						aria-label={label}
						onChange={(e) => onChange(Number(e.target.value) / 100)}
						className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
					/>
				</div>

				<FlatButton
					variant="silver"
					size="sm"
					icon="plus"
					onClick={() => stepBy(0.05)}
					disabled={disabled || pct >= 100}
					title={`Increase ${label}`}
				/>
			</div>
		</FlatWell>
	)
}

export function SettingsContent({onClose, onBackToMenu, isModal = false}: SettingsPanelProps) {
	const {isBangla} = useLanguage()
	const [settings, setSettings] = useState(() => audioManager.getVolumeSettings())
	const [activeTrack, setActiveTrack] = useState<BgmTrackId>(() => audioManager.getCurrentBgmTrack())

	useEffect(() => {
		return audioManager.subscribeState(() => {
			setSettings(audioManager.getVolumeSettings())
			setActiveTrack(audioManager.getCurrentBgmTrack())
		})
	}, [])

	const handleResetDefaults = () => {
		audioManager.setMuted(false)
		audioManager.setMusicMuted(false)
		audioManager.setMasterVolume(0.85)
		audioManager.setMusicVolume(0.8)
		audioManager.setSfxVolume(0.85)
		audioManager.setVoiceVolume(0.9)
		audioManager.playSfx('select')
	}

	return (
		<FlatPanel variant="gold" wellVariant="dark" className="w-full max-w-[760px]" wellClassName="p-6 space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
				<div>
					<FlatBanner variant="offset-bl">
						{isBangla ? 'গেম সেটিংস ও অডিও মিক্সার' : 'GAME SETTINGS & AUDIO MIXER'}
					</FlatBanner>
					<p className="mt-2 text-xs text-slate-300">
						{isBangla
							? 'মাস্টার, ব্যাকগ্রাউন্ড মিউজিক, সাউন্ড ইফেক্টস এবং চরিত্রের কণ্ঠস্বরের মাত্রা রিয়েল টাইমে সামঞ্জস্য করুন।'
							: 'Adjust Master, Background Music, Sound Effects, and Character Voice levels in real time.'}
					</p>
				</div>

				<div className="flex items-center gap-2">
					<FlatButton variant="dark" size="sm" onClick={handleResetDefaults}>
						{isBangla ? 'ডিফল্ট রিসেট করুন' : 'Reset Defaults'}
					</FlatButton>
					{!isModal && onBackToMenu && (
						<FlatButton variant="cream" size="sm" icon="arrow" onClick={onBackToMenu}>
							{isBangla ? 'প্রধান মেনু' : 'Main Menu'}
						</FlatButton>
					)}
					{isModal && onClose && (
						<FlatButton
							variant="cream"
							size="sm"
							icon="cross"
							onClick={() => {
								audioManager.playSfx('popup-close')
								onClose()
							}}
						>
							{isBangla ? 'বন্ধ করুন' : 'Close'}
						</FlatButton>
					)}
				</div>
			</div>

			{/* Quick Mute Switches */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<FlatWell variant="blue-dark" className="flex items-center justify-between p-3.5">
					<div>
						<div className="font-pixel text-xs text-sky-300">
							{isBangla ? 'ব্যাকগ্রাউন্ড মিউজিক' : 'BACKGROUND MUSIC'}
						</div>
						<div className="mt-0.5 text-xs text-slate-300">
							{settings.musicMuted ? (isBangla ? 'মিউট করা' : 'Muted') : isBangla ? 'সক্রিয়' : 'Active'}
						</div>
					</div>
					<FlatButton
						variant={settings.musicMuted ? 'dark' : 'gold'}
						size="sm"
						icon={settings.musicMuted ? 'cross' : 'play'}
						onClick={() => {
							const next = !settings.musicMuted
							audioManager.setMusicMuted(next)
							if (!next) audioManager.playSfx('click')
						}}
					>
						{settings.musicMuted
							? isBangla
								? 'মিউজিক আনমিউট করুন'
								: 'Unmute Music'
							: isBangla
								? 'মিউজিক মিউট করুন'
								: 'Mute Music'}
					</FlatButton>
				</FlatWell>

				<FlatWell variant="gold-dark" className="flex items-center justify-between p-3.5">
					<div>
						<div className="font-pixel text-xs text-amber-300">
							{isBangla ? 'SFX ও চরিত্রের কণ্ঠস্বর' : 'SFX & CHARACTER VOICES'}
						</div>
						<div className="mt-0.5 text-xs text-slate-300">
							{settings.muted ? (isBangla ? 'মিউট করা' : 'Muted') : isBangla ? 'সক্রিয়' : 'Active'}
						</div>
					</div>
					<FlatButton
						variant={settings.muted ? 'dark' : 'blue'}
						size="sm"
						icon={settings.muted ? 'cross' : 'check'}
						onClick={() => {
							const next = !settings.muted
							audioManager.setMuted(next)
							if (!next) audioManager.playSfx('click')
						}}
					>
						{settings.muted
							? isBangla
								? 'SFX আনমিউট করুন'
								: 'Unmute SFX'
							: isBangla
								? 'SFX মিউট করুন'
								: 'Mute SFX'}
					</FlatButton>
				</FlatWell>
			</div>

			{/* 4 Sound Sliders */}
			<div className="space-y-3">
				<VolumeSliderRow
					label={isBangla ? 'মাস্টার ভলিউম (Master Volume)' : 'Master Volume'}
					sublabel={
						isBangla
							? 'সমস্ত গেম অডিও আউটপুট নিয়ন্ত্রণ করে (মিউজিক, কমব্যাট SFX এবং কণ্ঠস্বর)'
							: 'Scales all game audio output (music, combat SFX, and voices)'
					}
					value={settings.masterVolume}
					fillTone="gold"
					onChange={(v) => audioManager.setMasterVolume(v)}
				/>

				<VolumeSliderRow
					label={isBangla ? 'মিউজিক (BGM) ভলিউম' : 'Music (BGM) Volume'}
					sublabel={
						isBangla
							? 'মেনু এবং যুদ্ধের সময় চলমান ব্যাকগ্রাউন্ড সাউন্ডট্র্যাকের মাত্রা'
							: 'Looping background soundtrack level across menus and battles'
					}
					value={settings.musicVolume}
					fillTone="teal"
					disabled={settings.musicMuted}
					onChange={(v) => audioManager.setMusicVolume(v)}
				/>

				<VolumeSliderRow
					label={isBangla ? 'সাউন্ড ইফেক্টস (SFX) ভলিউম' : 'Sound Effects (SFX) Volume'}
					sublabel={
						isBangla
							? 'UI ক্লিক, কার্ড তোলা, তলোয়ারের আঘাত, শিল্ড এবং কুইজের শব্দ'
							: 'UI clicks, card draws, sword clashes, shields, and quiz chimes'
					}
					value={settings.sfxVolume}
					fillTone="green"
					disabled={settings.muted}
					onChange={(v) => audioManager.setSfxVolume(v)}
					onTest={() => audioManager.playSfx('attack')}
					testLabel={isBangla ? 'SFX পরীক্ষা' : 'Test SFX'}
				/>

				<VolumeSliderRow
					label={isBangla ? 'চরিত্রের কণ্ঠস্বরের ভলিউম' : 'Character Voices Volume'}
					sublabel={
						isBangla
							? 'যুদ্ধের ভয়েস লাইন (Dark Ninja-এর 1.2 kHz মাফল্ড ফিল্টারসহ)'
							: "Combat voice lines (including Dark Ninja's 1.2 kHz muffled filter)"
					}
					value={settings.voiceVolume}
					fillTone="red"
					disabled={settings.muted}
					onChange={(v) => audioManager.setVoiceVolume(v)}
					onTest={() => audioManager.playCharacterVoice('dark-ninja', 'attack')}
					testLabel={isBangla ? 'ভয়েস পরীক্ষা' : 'Test Voice'}
				/>
			</div>

			{/* BGM Track Preview Selector */}
			<FlatWell variant="dark" className="space-y-3 p-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<span className="font-pixel text-xs text-amber-300">
						{isBangla ? 'সাউন্ডট্র্যাক প্রিভিউ' : 'SOUNDTRACK PREVIEW'}
					</span>
					<span className="font-mono text-xs text-slate-300">
						{isBangla ? BGM_LABELS_BN[activeTrack] : BGM_TRACK_MAP[activeTrack].label}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{(['menu', 'battle', 'quiz'] as const).map((trackId) => (
						<FlatButton
							key={trackId}
							variant={activeTrack === trackId && !settings.musicMuted ? 'gold' : 'dark'}
							size="sm"
							icon="play"
							onClick={() => {
								audioManager.setMusicMuted(false)
								audioManager.playBgm(trackId)
							}}
						>
							{trackId === 'menu'
								? isBangla
									? 'মেনু থিম'
									: 'Menu Theme'
								: trackId === 'battle'
									? isBangla
										? 'ব্যাটল থিম'
										: 'Battle Theme'
									: isBangla
										? 'কুইজ টেনশন'
										: 'Quiz Tension'}
						</FlatButton>
					))}
				</div>
			</FlatWell>
		</FlatPanel>
	)
}

export function SettingsModal({onClose}: {onClose: () => void}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
			<SettingsContent onClose={onClose} isModal />
		</div>
	)
}

