/**
 * Web Audio Manager with Male Dialogue Voice Pack Mapping, Dark Ninja Muffle Chain,
 * Real WAV SFX Pack (/assets/uisfx & /assets/sounds), and Looping Background Music (/assets/music)
 *
 * - Uses 3 distinct Male voice actors from /assets/dialogue (Sean Lenhart, Alex Brodie, Ian Lampert);
 *   no Female voices are used, and Reaper has no voice (null).
 * - Basic combat voice events: 'attack', 'hurt', 'death'.
 * - Dark Ninja's voice plays through a Web Audio chain at playback time:
 *   low-pass near 1.2 kHz, playback rate about 0.9, light reverb and saturation.
 * - Uses real WAV sound effects from /assets/uisfx and /assets/sounds (copied to /public/assets/sfx/).
 * - Streams looping background music tracks built from /assets/sounds/Musical Effects & Environment
 *   (/public/assets/music/bgm_menu_inn.wav, bgm_battle_duel.wav, bgm_quiz_tension.wav).
 */

import {
	type CharacterId,
	DARK_NINJA_AUDIO_CONFIG,
	VOICE_EVENT_LIST,
	VOICE_MAP,
	type VoiceEvent,
	type VoicePackId,
} from '../engine/config'

export type SfxEvent =
	| VoiceEvent
	| 'click'
	| 'select'
	| 'cursor'
	| 'cancel'
	| 'error'
	| 'popup-open'
	| 'popup-close'
	| 'swipe'
	| 'card-draw'
	| 'card-fan'
	| 'shield'
	| 'heal'
	| 'poison'
	| 'buff'
	| 'debuff'
	| 'quiz-correct'
	| 'quiz-wrong'
	| 'match-start'
	| 'victory'
	| 'tick'

export type BgmTrackId = 'menu' | 'battle' | 'quiz'

export const SFX_FILE_MAP: Record<SfxEvent, readonly string[]> = {
	click: ['/assets/sfx/ui_select_1.wav', '/assets/sfx/ui_select_2.wav'],
	select: ['/assets/sfx/ui_select_1.wav', '/assets/sfx/ui_select_2.wav'],
	cursor: ['/assets/sfx/ui_cursor_1.wav', '/assets/sfx/ui_cursor_2.wav'],
	cancel: ['/assets/sfx/ui_cancel_1.wav'],
	error: ['/assets/sfx/ui_error_1.wav'],
	'popup-open': ['/assets/sfx/ui_popup_open.wav'],
	'popup-close': ['/assets/sfx/ui_popup_close.wav'],
	swipe: ['/assets/sfx/ui_swipe_1.wav', '/assets/sfx/ui_swipe_2.wav'],
	'card-draw': ['/assets/sfx/card_draw_1.wav', '/assets/sfx/card_draw_2.wav', '/assets/sfx/card_draw_3.wav'],
	'card-fan': ['/assets/sfx/card_fan_1.wav', '/assets/sfx/card_fan_2.wav'],
	attack: ['/assets/sfx/attack_slice.wav', '/assets/sfx/attack_clash_1.wav', '/assets/sfx/attack_clash_2.wav'],
	hurt: ['/assets/sfx/hurt_thud.wav', '/assets/sfx/hurt_punch_1.wav', '/assets/sfx/hurt_punch_2.wav'],
	shield: ['/assets/sfx/shield_clang.wav', '/assets/sfx/shield_equip.wav'],
	heal: ['/assets/sfx/heal_heart.wav', '/assets/sfx/heal_gem.wav'],
	poison: ['/assets/sfx/poison_gurgle.wav'],
	buff: ['/assets/sfx/buff_powerup.wav'],
	debuff: ['/assets/sfx/debuff_powerdown.wav'],
	'quiz-correct': ['/assets/sfx/quiz_correct_1.wav', '/assets/sfx/quiz_correct_2.wav'],
	'quiz-wrong': ['/assets/sfx/quiz_wrong_1.wav', '/assets/sfx/quiz_wrong_2.wav'],
	death: ['/assets/sfx/death_defeated.wav', '/assets/sfx/death_bonesnap.wav'],
	'match-start': ['/assets/sfx/match_start.wav'],
	victory: ['/assets/sfx/match_victory_8bit.wav', '/assets/sfx/match_victory_piano.wav'],
	tick: ['/assets/sfx/clock_tick.wav', '/assets/sfx/clock_tock.wav'],
}

export const BGM_TRACK_MAP: Record<BgmTrackId, {url: string; label: string; volume: number}> = {
	menu: {
		url: '/assets/music/bgm_menu_inn.wav',
		label: 'Moonlit Tavern (Menu & Lobby)',
		volume: 0.38,
	},
	battle: {
		url: '/assets/music/bgm_battle_duel.wav',
		label: 'Moonlit Graveyard Duel (Battle)',
		volume: 0.42,
	},
	quiz: {
		url: '/assets/music/bgm_quiz_tension.wav',
		label: 'STEM Trial (Quiz Challenge)',
		volume: 0.4,
	},
}

const SFX_GAIN_MAP: Partial<Record<SfxEvent, number>> = {
	click: 0.55,
	select: 0.55,
	cursor: 0.35,
	cancel: 0.55,
	error: 0.65,
	'popup-open': 0.55,
	'popup-close': 0.55,
	swipe: 0.6,
	'card-draw': 0.65,
	'card-fan': 0.65,
	attack: 0.72,
	hurt: 0.75,
	shield: 0.7,
	heal: 0.7,
	poison: 0.6,
	buff: 0.6,
	debuff: 0.6,
	'quiz-correct': 0.75,
	'quiz-wrong': 0.7,
	death: 0.75,
	'match-start': 0.65,
	victory: 0.75,
	tick: 0.45,
}

export interface VoicePlaybackReport {
	characterId: CharacterId
	event: VoiceEvent
	voicePack: VoicePackId | null
	actor: string | null
	clipUrl: string | null
	muffleApplied: boolean
	lowpassHz: number | null
	playbackRate: number
	sfxPlayed: boolean
	timestamp: number
}

const AUDIO_SETTINGS_STORAGE_KEY = 'quiz-duel-audio-settings-v1'

export interface AudioVolumeSettings {
	masterVolume: number
	musicVolume: number
	sfxVolume: number
	voiceVolume: number
	muted: boolean
	musicMuted: boolean
}

class AudioManager {
	private ctx: AudioContext | null = null
	private bufferCache = new Map<string, AudioBuffer>()
	private variantCursor = new Map<string, number>()
	private lastSfxTimestamp = new Map<string, number>()
	private impulseBuffer: AudioBuffer | null = null
	private muted = false
	private musicMuted = false
	private masterVolume = 0.85
	private musicVolume = 0.8
	private sfxVolume = 0.85
	private voiceVolume = 0.9
	private currentBgmTrack: BgmTrackId = 'menu'
	private bgmSourceNode: AudioBufferSourceNode | null = null
	private bgmGainNode: GainNode | null = null
	private bgmPlayingTrack: BgmTrackId | null = null
	private darkNinjaMuffleOverride: boolean | null = null
	private lastReport: VoicePlaybackReport | null = null
	private listeners = new Set<(report: VoicePlaybackReport) => void>()
	private stateListeners = new Set<() => void>()

	constructor() {
		this.loadPersistedSettings()
	}

	private loadPersistedSettings(): void {
		try {
			if (typeof window === 'undefined' || !window.localStorage) return
			const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY)
			if (!raw) return
			const parsed = JSON.parse(raw) as Partial<AudioVolumeSettings>
			if (typeof parsed.masterVolume === 'number') this.masterVolume = Math.max(0, Math.min(1, parsed.masterVolume))
			if (typeof parsed.musicVolume === 'number') this.musicVolume = Math.max(0, Math.min(1, parsed.musicVolume))
			if (typeof parsed.sfxVolume === 'number') this.sfxVolume = Math.max(0, Math.min(1, parsed.sfxVolume))
			if (typeof parsed.voiceVolume === 'number') this.voiceVolume = Math.max(0, Math.min(1, parsed.voiceVolume))
			if (typeof parsed.muted === 'boolean') this.muted = parsed.muted
			if (typeof parsed.musicMuted === 'boolean') this.musicMuted = parsed.musicMuted
		} catch {
			// Ignore storage errors
		}
	}

	private savePersistedSettings(): void {
		try {
			if (typeof window === 'undefined' || !window.localStorage) return
			const payload: AudioVolumeSettings = {
				masterVolume: this.masterVolume,
				musicVolume: this.musicVolume,
				sfxVolume: this.sfxVolume,
				voiceVolume: this.voiceVolume,
				muted: this.muted,
				musicMuted: this.musicMuted,
			}
			window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(payload))
		} catch {
			// Ignore storage errors
		}
	}

	private getContext(): AudioContext {
		if (!this.ctx) {
			const AudioCtx =
				window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext
			this.ctx = new AudioCtx()
		}
		if (this.ctx.state === 'suspended') {
			this.ctx.resume().catch(() => {})
		}
		return this.ctx
	}

	private notifyStateListeners(): void {
		this.savePersistedSettings()
		this.stateListeners.forEach((fn) => {
			fn()
		})
	}

	private getEffectiveBgmGain(track: BgmTrackId): number {
		if (this.musicMuted || this.masterVolume <= 0 || this.musicVolume <= 0) return 0
		return BGM_TRACK_MAP[track].volume * this.masterVolume * this.musicVolume
	}

	private syncActiveBgmGain(): void {
		if (!this.bgmGainNode || !this.bgmPlayingTrack) return
		try {
			const ctx = this.getContext()
			const targetGain = this.getEffectiveBgmGain(this.bgmPlayingTrack)
			this.bgmGainNode.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.04)
		} catch {
			// Ignore
		}
	}

	/**
	 * Creates a short dark-chamber impulse response for Dark Ninja's Web Audio convolver reverb.
	 */
	private getReverbImpulse(ctx: AudioContext): AudioBuffer {
		if (this.impulseBuffer) return this.impulseBuffer
		const duration = 0.28
		const length = Math.floor(ctx.sampleRate * duration)
		const impulse = ctx.createBuffer(1, length, ctx.sampleRate)
		const channel = impulse.getChannelData(0)
		for (let i = 0; i < length; i++) {
			const decay = (1 - i / length) ** 2.6
			const pseudoRand = Math.sin(i * 12.9898) * 43758.5453
			const noise = (pseudoRand - Math.floor(pseudoRand)) * 2 - 1
			channel[i] = noise * decay * 0.45
		}
		this.impulseBuffer = impulse
		return impulse
	}

	/**
	 * Creates a soft saturation curve for Dark Ninja's mask distortion node.
	 */
	private makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
		const nSamples = 256
		const curve = new Float32Array(nSamples)
		const deg = Math.PI / 180
		for (let i = 0; i < nSamples; i++) {
			const x = (i * 2) / nSamples - 1
			curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
		}
		return curve
	}

	private async loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
		const cached = this.bufferCache.get(url)
		if (cached) return cached
		try {
			const ctx = this.getContext()
			const res = await fetch(url)
			if (!res.ok) return null
			const arr = await res.arrayBuffer()
			const decoded = await ctx.decodeAudioData(arr)
			this.bufferCache.set(url, decoded)
			return decoded
		} catch {
			return null
		}
	}

	public async preloadAllVoiceClips(): Promise<void> {
		if (typeof window === 'undefined') return
		const packs: VoicePackId[] = ['voice-dark', 'voice-heroic', 'voice-stoic']
		const tasks: Promise<unknown>[] = []

		for (const pack of packs) {
			for (const ev of VOICE_EVENT_LIST) {
				const urls = [
					`/assets/voices/${pack}/${ev}.wav`,
					`/assets/voices/${pack}/${ev}_1.wav`,
					`/assets/voices/${pack}/${ev}_2.wav`,
					`/assets/voices/${pack}/${ev}_3.wav`,
				]
				for (const url of urls) {
					tasks.push(this.loadAudioBuffer(url))
				}
			}
		}

		// Preload all real WAV SFX files from /public/assets/sfx/
		const allSfxUrls = new Set<string>()
		for (const urls of Object.values(SFX_FILE_MAP)) {
			for (const u of urls) {
				allSfxUrls.add(u)
			}
		}
		for (const url of allSfxUrls) {
			tasks.push(this.loadAudioBuffer(url))
		}

		await Promise.all(tasks)
	}

	private async getVoiceBuffer(
		pack: VoicePackId,
		event: VoiceEvent,
	): Promise<{buffer: AudioBuffer | null; url: string}> {
		const key = `${pack}:${event}`
		const idx = (this.variantCursor.get(key) ?? 0) % 3
		this.variantCursor.set(key, idx + 1)

		const candidateUrls = [`/assets/voices/${pack}/${event}_${idx + 1}.wav`, `/assets/voices/${pack}/${event}.wav`]

		for (const url of candidateUrls) {
			const buf = await this.loadAudioBuffer(url)
			if (buf) return {buffer: buf, url}
		}

		return {buffer: null, url: candidateUrls[1]}
	}

	/**
	 * Synthesized fallback in case an audio buffer is still loading on very first click.
	 */
	private playFallbackSynthSfx(event: SfxEvent): void {
		try {
			const ctx = this.getContext()
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			const now = ctx.currentTime

			if (event === 'click' || event === 'select' || event === 'cursor') {
				osc.type = 'triangle'
				osc.frequency.setValueAtTime(520, now)
				osc.frequency.exponentialRampToValueAtTime(780, now + 0.06)
				gain.gain.setValueAtTime(0.08, now)
				gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
				osc.connect(gain)
				gain.connect(ctx.destination)
				osc.start(now)
				osc.stop(now + 0.07)
			} else if (event === 'attack' || event === 'swipe') {
				osc.type = 'sawtooth'
				osc.frequency.setValueAtTime(340, now)
				osc.frequency.exponentialRampToValueAtTime(140, now + 0.12)
				gain.gain.setValueAtTime(0.1, now)
				gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13)
				osc.connect(gain)
				gain.connect(ctx.destination)
				osc.start(now)
				osc.stop(now + 0.13)
			} else if (event === 'hurt' || event === 'quiz-wrong' || event === 'error') {
				osc.type = 'square'
				osc.frequency.setValueAtTime(160, now)
				osc.frequency.exponentialRampToValueAtTime(65, now + 0.16)
				gain.gain.setValueAtTime(0.1, now)
				gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17)
				osc.connect(gain)
				gain.connect(ctx.destination)
				osc.start(now)
				osc.stop(now + 0.17)
			} else {
				osc.type = 'triangle'
				osc.frequency.setValueAtTime(440, now)
				osc.frequency.exponentialRampToValueAtTime(660, now + 0.1)
				gain.gain.setValueAtTime(0.08, now)
				gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11)
				osc.connect(gain)
				gain.connect(ctx.destination)
				osc.start(now)
				osc.stop(now + 0.11)
			}
		} catch {
			// Ignore audio context restrictions
		}
	}

	/**
	 * Plays a real WAV sound effect from `/public/assets/sfx/` (copied from `/assets/uisfx` and `/assets/sounds`).
	 * Automatically cycles through variants (e.g., card_draw_1..3, attack_slice/clash_1..2, ui_select_1..2).
	 */
	public playSfx(event: SfxEvent): void {
		if (this.muted || this.masterVolume <= 0 || this.sfxVolume <= 0 || typeof window === 'undefined') return

		const nowMs = Date.now()
		const prevMs = this.lastSfxTimestamp.get(event) ?? 0
		if (nowMs - prevMs < 35) return
		this.lastSfxTimestamp.set(event, nowMs)

		const urls = SFX_FILE_MAP[event] ?? SFX_FILE_MAP.click
		const cursorKey = `sfx:${event}`
		const idx = (this.variantCursor.get(cursorKey) ?? 0) % urls.length
		this.variantCursor.set(cursorKey, idx + 1)
		const targetUrl = urls[idx]
		const volume = (SFX_GAIN_MAP[event] ?? 0.6) * this.masterVolume * this.sfxVolume

		const playBuffer = (buffer: AudioBuffer) => {
			try {
				const ctx = this.getContext()
				const src = ctx.createBufferSource()
				src.buffer = buffer
				const gain = ctx.createGain()
				gain.gain.value = volume
				src.connect(gain)
				gain.connect(ctx.destination)
				src.start(0)
			} catch {
				// Ignore autoplay restriction errors
			}
		}

		const cached = this.bufferCache.get(targetUrl)
		if (cached) {
			playBuffer(cached)
		} else {
			this.playFallbackSynthSfx(event)
			this.loadAudioBuffer(targetUrl).then((buf) => {
				if (buf) playBuffer(buf)
			})
		}
	}

	/**
	 * Starts or switches the looping background music track (`menu` | `battle` | `quiz`).
	 */
	public async playBgm(track?: BgmTrackId): Promise<void> {
		if (typeof window === 'undefined') return
		const targetTrack = track ?? this.currentBgmTrack
		this.currentBgmTrack = targetTrack
		this.notifyStateListeners()

		if (this.musicMuted || this.masterVolume <= 0 || this.musicVolume <= 0) {
			this.stopBgmNode()
			return
		}

		const effectiveGain = this.getEffectiveBgmGain(targetTrack)

		if (this.bgmPlayingTrack === targetTrack && this.bgmSourceNode) {
			try {
				const ctx = this.getContext()
				if (this.bgmGainNode) {
					this.bgmGainNode.gain.setTargetAtTime(effectiveGain, ctx.currentTime, 0.08)
				}
			} catch {
				// Ignore
			}
			return
		}

		const trackInfo = BGM_TRACK_MAP[targetTrack]
		const loadTask = this.loadAudioBuffer(trackInfo.url).then((buffer) => {
			if (!buffer || this.musicMuted || this.currentBgmTrack !== targetTrack) return
			this.stopBgmNode()
			try {
				const ctx = this.getContext()
				const source = ctx.createBufferSource()
				source.buffer = buffer
				source.loop = true

				const gain = ctx.createGain()
				gain.gain.setValueAtTime(0.001, ctx.currentTime)
				gain.gain.linearRampToValueAtTime(this.getEffectiveBgmGain(targetTrack), ctx.currentTime + 0.35)

				source.connect(gain)
				gain.connect(ctx.destination)
				source.start(0)

				this.bgmSourceNode = source
				this.bgmGainNode = gain
				this.bgmPlayingTrack = targetTrack
				this.notifyStateListeners()
			} catch {
				// Autoplay still locked until user gesture
			}
		})

		await loadTask
	}

	private stopBgmNode(): void {
		if (this.bgmSourceNode) {
			try {
				this.bgmSourceNode.stop()
				this.bgmSourceNode.disconnect()
			} catch {
				// Ignore
			}
			this.bgmSourceNode = null
		}
		if (this.bgmGainNode) {
			try {
				this.bgmGainNode.disconnect()
			} catch {
				// Ignore
			}
			this.bgmGainNode = null
		}
		this.bgmPlayingTrack = null
	}

	public stopBgm(): void {
		this.stopBgmNode()
		this.notifyStateListeners()
	}

	public setMusicMuted(muted: boolean): void {
		this.musicMuted = muted
		if (muted) {
			this.stopBgmNode()
		} else {
			this.playBgm(this.currentBgmTrack)
		}
		this.notifyStateListeners()
	}

	public isMusicMuted(): boolean {
		return this.musicMuted
	}

	public getCurrentBgmTrack(): BgmTrackId {
		return this.currentBgmTrack
	}

	public isBgmPlaying(): boolean {
		return this.bgmPlayingTrack !== null && !this.musicMuted
	}

	public getMasterVolume(): number {
		return this.masterVolume
	}

	public setMasterVolume(volume: number): void {
		this.masterVolume = Math.max(0, Math.min(1, volume))
		this.syncActiveBgmGain()
		this.notifyStateListeners()
	}

	public getMusicVolume(): number {
		return this.musicVolume
	}

	public setMusicVolume(volume: number): void {
		this.musicVolume = Math.max(0, Math.min(1, volume))
		if (this.musicVolume <= 0) {
			this.stopBgmNode()
		} else if (!this.musicMuted && !this.bgmSourceNode) {
			this.playBgm(this.currentBgmTrack)
		} else {
			this.syncActiveBgmGain()
		}
		this.notifyStateListeners()
	}

	public getSfxVolume(): number {
		return this.sfxVolume
	}

	public setSfxVolume(volume: number): void {
		this.sfxVolume = Math.max(0, Math.min(1, volume))
		this.notifyStateListeners()
	}

	public getVoiceVolume(): number {
		return this.voiceVolume
	}

	public setVoiceVolume(volume: number): void {
		this.voiceVolume = Math.max(0, Math.min(1, volume))
		this.notifyStateListeners()
	}

	public getVolumeSettings(): AudioVolumeSettings {
		return {
			masterVolume: this.masterVolume,
			musicVolume: this.musicVolume,
			sfxVolume: this.sfxVolume,
			voiceVolume: this.voiceVolume,
			muted: this.muted,
			musicMuted: this.musicMuted,
		}
	}

	/**
	 * Plays the mapped male dialogue voice clip for `characterId` and `event` ('attack' | 'hurt' | 'death').
	 * - Applies the Web Audio muffle chain (1.2 kHz low-pass + 0.9x playbackRate + light distortion/reverb)
	 *   when configured (Dark Ninja).
	 * - If the character has no voice pack (Reaper), only the sound effect plays.
	 */
	public async playCharacterVoice(
		characterId: CharacterId,
		event: VoiceEvent,
		options?: {forceMuffle?: boolean},
	): Promise<VoicePlaybackReport> {
		const mapping = VOICE_MAP[characterId]
		const useMuffle =
			typeof options?.forceMuffle === 'boolean'
				? options.forceMuffle
				: this.darkNinjaMuffleOverride !== null && characterId === 'dark-ninja'
					? this.darkNinjaMuffleOverride
					: mapping.muffle

		let playedClipUrl: string | null = null
		this.playSfx(event)

		if (!this.muted && this.masterVolume > 0 && this.voiceVolume > 0 && mapping.pack) {
			const {buffer, url} = await this.getVoiceBuffer(mapping.pack, event)
			playedClipUrl = url
			if (buffer) {
				const ctx = this.getContext()
				const source = ctx.createBufferSource()
				source.buffer = buffer

				const masterGain = ctx.createGain()
				masterGain.gain.value = 0.9 * this.masterVolume * this.voiceVolume

				if (useMuffle) {
					source.playbackRate.value = DARK_NINJA_AUDIO_CONFIG.playbackRate

					const shaper = ctx.createWaveShaper()
					shaper.curve = this.makeDistortionCurve(DARK_NINJA_AUDIO_CONFIG.distortionAmount)
					shaper.oversample = '2x'

					const lowpass = ctx.createBiquadFilter()
					lowpass.type = 'lowpass'
					lowpass.frequency.value = DARK_NINJA_AUDIO_CONFIG.lowpassHz
					lowpass.Q.value = DARK_NINJA_AUDIO_CONFIG.lowpassQ

					const dryGain = ctx.createGain()
					dryGain.gain.value = 1 - DARK_NINJA_AUDIO_CONFIG.reverbMix

					const wetGain = ctx.createGain()
					wetGain.gain.value = DARK_NINJA_AUDIO_CONFIG.reverbMix

					const convolver = ctx.createConvolver()
					convolver.buffer = this.getReverbImpulse(ctx)

					source.connect(shaper)
					shaper.connect(lowpass)

					lowpass.connect(dryGain)
					dryGain.connect(masterGain)

					lowpass.connect(convolver)
					convolver.connect(wetGain)
					wetGain.connect(masterGain)

					masterGain.connect(ctx.destination)
				} else {
					source.playbackRate.value = 1.0
					source.connect(masterGain)
					masterGain.connect(ctx.destination)
				}

				source.start(0)
			}
		}

		const report: VoicePlaybackReport = {
			characterId,
			event,
			voicePack: mapping.pack,
			actor: mapping.actor,
			clipUrl: playedClipUrl,
			muffleApplied: Boolean(mapping.pack && useMuffle),
			lowpassHz: mapping.pack && useMuffle ? DARK_NINJA_AUDIO_CONFIG.lowpassHz : null,
			playbackRate: mapping.pack && useMuffle ? DARK_NINJA_AUDIO_CONFIG.playbackRate : 1.0,
			sfxPlayed: true,
			timestamp: Date.now(),
		}

		this.lastReport = report
		this.listeners.forEach((fn) => {
			fn(report)
		})
		return report
	}

	public setDarkNinjaMuffleOverride(override: boolean | null): void {
		this.darkNinjaMuffleOverride = override
	}

	public getDarkNinjaMuffleOverride(): boolean | null {
		return this.darkNinjaMuffleOverride
	}

	public setMuted(muted: boolean): void {
		this.muted = muted
		this.notifyStateListeners()
	}

	public isMuted(): boolean {
		return this.muted
	}

	public getLastReport(): VoicePlaybackReport | null {
		return this.lastReport
	}

	public subscribe(listener: (report: VoicePlaybackReport) => void): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	public subscribeState(listener: () => void): () => void {
		this.stateListeners.add(listener)
		return () => this.stateListeners.delete(listener)
	}
}

export const audioManager = new AudioManager()
