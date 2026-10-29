/**
 * Quiz Duel — Engine & Presentation Configuration
 * Derived in part from oskarrough/slaytheweb (AGPL-3.0-or-later)
 */

export type Subject = 'maths' | 'physics' | 'chemistry' | 'biology'
export type Rarity = 'normal' | 'uncommon' | 'epic' | 'legendary'
export type FrameType = 'A' | 'B'
export type GoldUiCardFrameKey = 'C' | 'D' | 'E' | 'F'
export type CharacterId = 'dark-ninja' | 'reaper' | 'samurai' | 'knight'
export type VoicePackId = 'voice-dark' | 'voice-heroic' | 'voice-stoic'
export type VoiceEvent = 'attack' | 'hurt' | 'death'
export type CoreSpriteAnimationState = 'idle' | 'attack' | 'hurt' | 'death'
export type SpriteAnimationState = CoreSpriteAnimationState | 'idle2' | 'turnStart' | 'turnEnd'

export interface SpriteAnimationConfig {
	frames?: string[]
	spriteSheet?: string
	frameWidth: number
	frameHeight: number
	frameCount: number
	fps: number
	loop: boolean
}

export interface CharacterConfig {
	id: CharacterId
	name: string
	title: string
	startingHp: number
	affinity: Subject
	weakness: Subject
	voicePack: VoicePackId | null
	muffleVoice: boolean
	spriteSheet: string
	frameWidth: number
	frameHeight: number
	frameCount: number
	fps: number
	fadeOnDeath?: boolean
	animations: Record<CoreSpriteAnimationState, SpriteAnimationConfig> &
		Partial<Record<SpriteAnimationState, SpriteAnimationConfig>>
	accentHex: string
	bio: string
}

// Section 1: Source repository link for AGPL-3.0 port-with-attribution compliance
export const SOURCE_REPO_URL = 'https://github.com/your-org/quiz-duel'

// Section 8: Core Battle Defaults
export const ENGINE_CONFIG = {
	startingHp: 80,
	startingMana: 5,
	maxMana: 5,
	turnStartManaGain: 1,
	skipTurnBonusMana: 1,
	handSize: 5,
	turnStartDraw: 1,
	maxHandSize: 7,
	reducedStrengthScale: 0.35,
	affinityMultiplier: {
		outgoingAffinity: 1.25,
		outgoingWeakness: 0.75,
		incomingAffinity: 0.75,
		incomingWeakness: 1.25,
	},
	stunImmunityRounds: 2,
	parasite: {
		initialTick: 1,
		growthPerRound: 1,
	},
	upgrade: {
		magnitudeMultiplier: 1.4,
		costReduction: 1,
	},
	phoenix: {
		fullReviveRatio: 0.3,
		reducedReviveRatio: 0.1,
	},
	fatigueStartRound: 25,
	fatigueMultiplier: 2,
	disconnectForfeitSeconds: 60,
	hideOnBlur: true,
	deckRecipe: {
		totalCards: 24,
		subjectCounts: {
			affinity: 10,
			weakness: 2,
			neutralA: 6,
			neutralB: 6,
		},
		rarityCounts: {
			normal: 10,
			uncommon: 8,
			epic: 4,
			legendary: 2,
		},
		maxCopies: {
			normal: 3,
			uncommon: 2,
			epic: 1,
			legendary: 1,
		},
	},
	quizTimersSeconds: {
		normal: 8,
		uncommon: 15,
		epic: 25,
		legendary: 40,
	} as Record<Rarity, number>,
} as const

// Section 3: Male dialogue voice pack mapping (3 Male voice actors from /assets/dialogue; Reaper has no voice)
export const VOICE_MAP: Record<
	CharacterId,
	{pack: VoicePackId | null; actor: string | null; muffle: boolean; clipsPerEvent: number}
> = {
	'dark-ninja': {pack: 'voice-dark', actor: 'Sean Lenhart', muffle: true, clipsPerEvent: 3},
	knight: {pack: 'voice-heroic', actor: 'Alex Brodie', muffle: false, clipsPerEvent: 3},
	samurai: {pack: 'voice-stoic', actor: 'Ian Lampert', muffle: false, clipsPerEvent: 3},
	reaper: {pack: null, actor: null, muffle: false, clipsPerEvent: 0},
}

// Section 3: Dark Ninja Web Audio muffle chain parameters
export const DARK_NINJA_AUDIO_CONFIG = {
	lowpassHz: 1200,
	lowpassQ: 1.2,
	playbackRate: 0.9,
	distortionAmount: 14,
	reverbMix: 0.22,
} as const

// Section 3: 9-Slice Card Frame configuration using /assets/goldui/20240707dragon9SlicesC/D/E.png + recolored F.png
export const NINE_SLICE_CONFIG = {
	frames: {
		A: '/assets/frames/20240707dragon9SlicesC.png',
		B: '/assets/frames/20240707dragon9SlicesD.png',
	} as Record<FrameType, string>,
	cardFrames: {
		C: '/assets/frames/20240707dragon9SlicesC.png',
		D: '/assets/frames/20240707dragon9SlicesD.png',
		E: '/assets/frames/20240707dragon9SlicesE.png',
		F: '/assets/frames/20240707dragon9SlicesF.png',
	} as Record<GoldUiCardFrameKey, string>,
	subjectFrames: {
		physics: '/assets/frames/20240707dragon9SlicesC.png',
		chemistry: '/assets/frames/20240707dragon9SlicesD.png',
		biology: '/assets/frames/20240707dragon9SlicesE.png',
		maths: '/assets/frames/20240707dragon9SlicesF.png',
	} as Record<Subject, string>,
	sourceWidth: 48,
	sourceHeight: 48,
	insets: {
		top: 16,
		right: 16,
		bottom: 16,
		left: 16,
	},
	// Logical pixel dimensions before integer scaling (2:3 card aspect ratio: 64x96 logical pixels)
	logicalCardWidth: 64,
	logicalCardHeight: 96,
	defaultIntegerScale: 3, // 192x288 rendered pixels
} as const

// Section 3: Rarity interior fills & badges
export const RARITY_FILL_PALETTE: Record<Rarity, {fill: string; fillAlt: string; label: string; badgeText: string}> = {
	normal: {
		fill: '#1e2430',
		fillAlt: '#262d3d',
		label: 'Normal',
		badgeText: '#cbd5e1',
	},
	uncommon: {
		fill: '#0f2e22',
		fillAlt: '#153c2d',
		label: 'Uncommon',
		badgeText: '#6ee7b7',
	},
	epic: {
		fill: '#2b1644',
		fillAlt: '#371c56',
		label: 'Epic',
		badgeText: '#d8b4fe',
	},
	legendary: {
		fill: '#43200d',
		fillAlt: '#542912',
		label: 'Legendary',
		badgeText: '#fdba74',
	},
}

// Section 3: Subject card frames & palettes (mapped 1:1 to goldui 9-slice C, D, E, and recolored F)
export const SUBJECT_BORDER_PALETTE: Record<
	Subject,
	{
		frameKey: GoldUiCardFrameKey
		framePath: string
		fill: string
		border: string
		highlight: string
		shadow: string
		label: string
		role: string
		shortCode: string
	}
> = {
	maths: {
		frameKey: 'F',
		framePath: '/assets/frames/20240707dragon9SlicesF.png',
		fill: '#d45050',
		border: '#ef4444',
		highlight: '#ff9e94',
		shadow: '#7d2430',
		label: 'Maths',
		role: 'Offence',
		shortCode: 'MTH',
	},
	physics: {
		frameKey: 'C',
		framePath: '/assets/frames/20240707dragon9SlicesC.png',
		fill: '#84bdc2',
		border: '#38bdf8',
		highlight: '#a8e3d0',
		shadow: '#6b699b',
		label: 'Physics',
		role: 'Defence & Offence',
		shortCode: 'PHY',
	},
	chemistry: {
		frameKey: 'D',
		framePath: '/assets/frames/20240707dragon9SlicesD.png',
		fill: '#f4a13a',
		border: '#facc15',
		highlight: '#f9d42f',
		shadow: '#bf5b56',
		label: 'Chemistry',
		role: 'Debuffs',
		shortCode: 'CHM',
	},
	biology: {
		frameKey: 'E',
		framePath: '/assets/frames/20240707dragon9SlicesE.png',
		fill: '#d791a9',
		border: '#f472b6',
		highlight: '#f2b8be',
		shadow: '#bf5b56',
		label: 'Biology',
		role: 'Sustain',
		shortCode: 'BIO',
	},
}

// Section 4: Character roster
export const CHARACTERS: Record<CharacterId, CharacterConfig> = {
	'dark-ninja': {
		id: 'dark-ninja',
		name: 'Dark Ninja',
		title: 'Alchemical Shadow',
		startingHp: 88,
		affinity: 'chemistry',
		weakness: 'physics',
		voicePack: VOICE_MAP['dark-ninja'].pack,
		muffleVoice: VOICE_MAP['dark-ninja'].muffle,
		spriteSheet: '/assets/characters/dark-ninja/idle/01.png',
		frameWidth: 64,
		frameHeight: 64,
		frameCount: 8,
		fps: 8,
		animations: {
			idle: {
				frames: [
					'/assets/characters/dark-ninja/idle/01.png',
					'/assets/characters/dark-ninja/idle/02.png',
					'/assets/characters/dark-ninja/idle/03.png',
					'/assets/characters/dark-ninja/idle/04.png',
					'/assets/characters/dark-ninja/idle/05.png',
					'/assets/characters/dark-ninja/idle/06.png',
					'/assets/characters/dark-ninja/idle/07.png',
					'/assets/characters/dark-ninja/idle/08.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 8,
				fps: 8,
				loop: true,
			},
			attack: {
				frames: [
					'/assets/characters/dark-ninja/attack/01.png',
					'/assets/characters/dark-ninja/attack/02.png',
					'/assets/characters/dark-ninja/attack/03.png',
					'/assets/characters/dark-ninja/attack/04.png',
					'/assets/characters/dark-ninja/attack/05.png',
					'/assets/characters/dark-ninja/attack/06.png',
				],
				frameWidth: 96,
				frameHeight: 64,
				frameCount: 6,
				fps: 10,
				loop: false,
			},
			hurt: {
				frames: [
					'/assets/characters/dark-ninja/hurt/01.png',
					'/assets/characters/dark-ninja/hurt/02.png',
					'/assets/characters/dark-ninja/hurt/03.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 3,
				fps: 8,
				loop: false,
			},
			death: {
				frames: [
					'/assets/characters/dark-ninja/death/01.png',
					'/assets/characters/dark-ninja/death/02.png',
					'/assets/characters/dark-ninja/death/03.png',
					'/assets/characters/dark-ninja/death/04.png',
					'/assets/characters/dark-ninja/death/05.png',
					'/assets/characters/dark-ninja/death/06.png',
					'/assets/characters/dark-ninja/death/07.png',
					'/assets/characters/dark-ninja/death/08.png',
					'/assets/characters/dark-ninja/death/09.png',
					'/assets/characters/dark-ninja/death/10.png',
					'/assets/characters/dark-ninja/death/11.png',
					'/assets/characters/dark-ninja/death/12.png',
					'/assets/characters/dark-ninja/death/13.png',
					'/assets/characters/dark-ninja/death/14.png',
					'/assets/characters/dark-ninja/death/15.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 15,
				fps: 10,
				loop: false,
			},
		},
		accentHex: '#facc15',
		bio: 'Brewing lethal toxins and corrosive clouds. Excels at stacking Poison and Parasite while stealing opponent mana.',
	},
	reaper: {
		id: 'reaper',
		name: 'Reaper',
		title: 'Harvester of Vitality',
		startingHp: 101,
		affinity: 'biology',
		weakness: 'maths',
		voicePack: VOICE_MAP.reaper.pack,
		muffleVoice: VOICE_MAP.reaper.muffle,
		spriteSheet: '/assets/characters/reaper/idle/01.png',
		frameWidth: 64,
		frameHeight: 64,
		frameCount: 5,
		fps: 8,
		fadeOnDeath: true,
		animations: {
			idle: {
				frames: [
					'/assets/characters/reaper/idle/01.png',
					'/assets/characters/reaper/idle/02.png',
					'/assets/characters/reaper/idle/03.png',
					'/assets/characters/reaper/idle/04.png',
					'/assets/characters/reaper/idle/05.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 5,
				fps: 8,
				loop: true,
			},
			idle2: {
				frames: [
					'/assets/characters/reaper/idle2/01.png',
					'/assets/characters/reaper/idle2/02.png',
					'/assets/characters/reaper/idle2/03.png',
					'/assets/characters/reaper/idle2/04.png',
					'/assets/characters/reaper/idle2/05.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 5,
				fps: 8,
				loop: true,
			},
			turnStart: {
				frames: [
					'/assets/characters/reaper/turn-start/01.png',
					'/assets/characters/reaper/turn-start/02.png',
					'/assets/characters/reaper/turn-start/03.png',
					'/assets/characters/reaper/turn-start/04.png',
					'/assets/characters/reaper/turn-start/05.png',
					'/assets/characters/reaper/turn-start/06.png',
					'/assets/characters/reaper/turn-start/07.png',
					'/assets/characters/reaper/turn-start/08.png',
					'/assets/characters/reaper/turn-start/09.png',
					'/assets/characters/reaper/turn-start/10.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 10,
				fps: 10,
				loop: false,
			},
			turnEnd: {
				frames: [
					'/assets/characters/reaper/turn-end/01.png',
					'/assets/characters/reaper/turn-end/02.png',
					'/assets/characters/reaper/turn-end/03.png',
					'/assets/characters/reaper/turn-end/04.png',
					'/assets/characters/reaper/turn-end/05.png',
					'/assets/characters/reaper/turn-end/06.png',
					'/assets/characters/reaper/turn-end/07.png',
					'/assets/characters/reaper/turn-end/08.png',
					'/assets/characters/reaper/turn-end/09.png',
					'/assets/characters/reaper/turn-end/10.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 10,
				fps: 10,
				loop: false,
			},
			attack: {
				frames: [
					'/assets/characters/reaper/attack/01.png',
					'/assets/characters/reaper/attack/02.png',
					'/assets/characters/reaper/attack/03.png',
					'/assets/characters/reaper/attack/04.png',
					'/assets/characters/reaper/attack/05.png',
					'/assets/characters/reaper/attack/06.png',
					'/assets/characters/reaper/attack/07.png',
					'/assets/characters/reaper/attack/08.png',
					'/assets/characters/reaper/attack/09.png',
					'/assets/characters/reaper/attack/10.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 10,
				fps: 12,
				loop: false,
			},
			hurt: {
				frames: [
					'/assets/characters/reaper/hurt/01.png',
					'/assets/characters/reaper/hurt/02.png',
					'/assets/characters/reaper/hurt/03.png',
					'/assets/characters/reaper/hurt/04.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 4,
				fps: 8,
				loop: false,
			},
			death: {
				frames: [
					'/assets/characters/reaper/idle2/01.png',
					'/assets/characters/reaper/idle2/02.png',
					'/assets/characters/reaper/idle2/03.png',
					'/assets/characters/reaper/idle2/04.png',
					'/assets/characters/reaper/idle2/05.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 5,
				fps: 8,
				loop: false,
			},
		},
		accentHex: '#f472b6',
		bio: 'Silent and undying. Sustains through cellular regeneration, debuff wards, and the legendary Phoenix revival.',
	},
	samurai: {
		id: 'samurai',
		name: 'Samurai',
		title: 'Calculus Blade',
		startingHp: 80,
		affinity: 'maths',
		weakness: 'biology',
		voicePack: VOICE_MAP.samurai.pack,
		muffleVoice: VOICE_MAP.samurai.muffle,
		spriteSheet: '/assets/characters/samurai/idle/01.png',
		frameWidth: 64,
		frameHeight: 64,
		frameCount: 10,
		fps: 8,
		animations: {
			idle: {
				frames: [
					'/assets/characters/samurai/idle/01.png',
					'/assets/characters/samurai/idle/02.png',
					'/assets/characters/samurai/idle/03.png',
					'/assets/characters/samurai/idle/04.png',
					'/assets/characters/samurai/idle/05.png',
					'/assets/characters/samurai/idle/06.png',
					'/assets/characters/samurai/idle/07.png',
					'/assets/characters/samurai/idle/08.png',
					'/assets/characters/samurai/idle/09.png',
					'/assets/characters/samurai/idle/10.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 10,
				fps: 8,
				loop: true,
			},
			attack: {
				frames: [
					'/assets/characters/samurai/attack/01.png',
					'/assets/characters/samurai/attack/02.png',
					'/assets/characters/samurai/attack/03.png',
					'/assets/characters/samurai/attack/04.png',
					'/assets/characters/samurai/attack/05.png',
					'/assets/characters/samurai/attack/06.png',
					'/assets/characters/samurai/attack/07.png',
				],
				frameWidth: 96,
				frameHeight: 64,
				frameCount: 7,
				fps: 10,
				loop: false,
			},
			hurt: {
				frames: [
					'/assets/characters/samurai/hurt/01.png',
					'/assets/characters/samurai/hurt/02.png',
					'/assets/characters/samurai/hurt/03.png',
					'/assets/characters/samurai/hurt/04.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 4,
				fps: 8,
				loop: false,
			},
			death: {
				frames: [
					'/assets/characters/samurai/hurt/04.png',
					'/assets/characters/samurai/hurt/03.png',
					'/assets/characters/samurai/hurt/02.png',
					'/assets/characters/samurai/hurt/01.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 4,
				fps: 8,
				loop: false,
			},
		},
		accentHex: '#ef4444',
		bio: 'Master of relentless offensive precision. Multiplies Strength and unleashes multi-hit strikes.',
	},
	knight: {
		id: 'knight',
		name: 'Knight',
		title: 'Kinetic Vanguard',
		startingHp: 88,
		affinity: 'physics',
		weakness: 'chemistry',
		voicePack: VOICE_MAP.knight.pack,
		muffleVoice: VOICE_MAP.knight.muffle,
		spriteSheet: '/assets/characters/knight/idle/01.png',
		frameWidth: 64,
		frameHeight: 64,
		frameCount: 14,
		fps: 10,
		animations: {
			idle: {
				frames: [
					'/assets/characters/knight/idle/01.png',
					'/assets/characters/knight/idle/02.png',
					'/assets/characters/knight/idle/03.png',
					'/assets/characters/knight/idle/04.png',
					'/assets/characters/knight/idle/05.png',
					'/assets/characters/knight/idle/06.png',
					'/assets/characters/knight/idle/07.png',
					'/assets/characters/knight/idle/08.png',
					'/assets/characters/knight/idle/09.png',
					'/assets/characters/knight/idle/10.png',
					'/assets/characters/knight/idle/11.png',
					'/assets/characters/knight/idle/12.png',
					'/assets/characters/knight/idle/13.png',
					'/assets/characters/knight/idle/14.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 14,
				fps: 10,
				loop: true,
			},
			attack: {
				frames: [
					'/assets/characters/knight/attack/01.png',
					'/assets/characters/knight/attack/02.png',
					'/assets/characters/knight/attack/03.png',
					'/assets/characters/knight/attack/04.png',
					'/assets/characters/knight/attack/05.png',
					'/assets/characters/knight/attack/06.png',
					'/assets/characters/knight/attack/07.png',
					'/assets/characters/knight/attack/08.png',
				],
				frameWidth: 96,
				frameHeight: 64,
				frameCount: 8,
				fps: 12,
				loop: false,
			},
			hurt: {
				frames: [
					'/assets/characters/knight/hurt/01.png',
					'/assets/characters/knight/hurt/02.png',
					'/assets/characters/knight/hurt/03.png',
					'/assets/characters/knight/hurt/04.png',
					'/assets/characters/knight/hurt/05.png',
					'/assets/characters/knight/hurt/06.png',
					'/assets/characters/knight/hurt/07.png',
					'/assets/characters/knight/hurt/08.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 8,
				fps: 10,
				loop: false,
			},
			death: {
				frames: [
					'/assets/characters/knight/death/01.png',
					'/assets/characters/knight/death/02.png',
					'/assets/characters/knight/death/03.png',
					'/assets/characters/knight/death/04.png',
					'/assets/characters/knight/death/05.png',
					'/assets/characters/knight/death/06.png',
					'/assets/characters/knight/death/07.png',
					'/assets/characters/knight/death/08.png',
					'/assets/characters/knight/death/09.png',
					'/assets/characters/knight/death/10.png',
					'/assets/characters/knight/death/11.png',
					'/assets/characters/knight/death/12.png',
					'/assets/characters/knight/death/13.png',
					'/assets/characters/knight/death/14.png',
					'/assets/characters/knight/death/15.png',
				],
				frameWidth: 64,
				frameHeight: 64,
				frameCount: 15,
				fps: 10,
				loop: false,
			},
		},
		accentHex: '#38bdf8',
		bio: 'Immovable bastion of kinetic force. Stacks permanent Barricade armor and converts Block into crushing Body Slams.',
	},
}

// Section 4B: Character Sprite Foot Baseline & Battle Arena Maps
// All 4 character sprites (64x64 and 96x64 frames) have their boots/feet resting at row y = 55 (0-indexed from top),
// leaving 8 transparent pixel rows (y = 56..63) at the bottom of the 64px frame.
// Anchoring at (55 + 1) / 64 = 56 / 64 = 87.5% from the top of the sprite frame aligns the character's boots
// directly onto the map's ground surface with zero floating.
export const SPRITE_FRAME_HEIGHT = 64
export const SPRITE_FOOT_BASELINE_Y = 55
export const SPRITE_BOTTOM_TRANSPARENT_ROWS = SPRITE_FRAME_HEIGHT - 1 - SPRITE_FOOT_BASELINE_Y // 8 rows
export const SPRITE_FOOT_ANCHOR_RATIO = (SPRITE_FOOT_BASELINE_Y + 1) / SPRITE_FRAME_HEIGHT // 56 / 64 = 0.875 (87.5%)

export type BattleMapId = 'moon'

export interface MapSpawnPoint {
	/** X coordinate in source map pixels (0..width) */
	x: number
	/** Y coordinate of the solid walkable ground surface in source map pixels (0..height) */
	groundY: number
	/** Percentage X (0..100) derived from x / width */
	xPercent: number
	/** Percentage Y (0..100) derived from groundY / height */
	groundYPercent: number
	/** Description of the terrain feature at this spawn point */
	terrainLabel: string
}

export interface BattleMapConfig {
	id: BattleMapId
	name: string
	imagePath: string
	width: number
	height: number
	/** Logical tile size in source image pixels (16px * 4 = 64px) */
	tileSize: number
	/** Scale factor of character sprite relative to source map pixels so fighters match map architecture */
	spriteMapScale: number
	spriteFootBaselineY: number
	spriteFrameHeight: number
	p1Spawn: MapSpawnPoint
	p2Spawn: MapSpawnPoint
	/** Additional map-grave assets preserved for future map layers / stages */
	layers: {
		background0: string
		background1: string
		grassBackground1: string
		grassBackground2: string
		tiles: string
		brush: string
		salt: string
		test1: string
		test2: string
	}
}

export const DEFAULT_BATTLE_MAP_ID: BattleMapId = 'moon'

export const BATTLE_MAPS: Record<BattleMapId, BattleMapConfig> = {
	moon: {
		id: 'moon',
		name: 'Moonlit Graveyard',
		imagePath: '/assets/maps/moon.png',
		width: 3072,
		height: 1664,
		tileSize: 64,
		spriteMapScale: 5.25,
		spriteFootBaselineY: SPRITE_FOOT_BASELINE_Y,
		spriteFrameHeight: SPRITE_FRAME_HEIGHT,
		// Left ground clearing between the two left archway stone pillars (x = 592, y = 1336 solid cobblestone/dirt path)
		p1Spawn: {
			x: 592,
			groundY: 1336,
			xPercent: Number(((592 / 3072) * 100).toFixed(4)),
			groundYPercent: Number(((1336 / 1664) * 100).toFixed(4)),
			terrainLabel: 'Lower Cobblestone Path (y=1336px)',
		},
		// Right elevated plateau between the right stone pillars (x = 2208, y = 1080 solid cobblestone/dirt plateau, 4 tiles higher)
		p2Spawn: {
			x: 2208,
			groundY: 1080,
			xPercent: Number(((2208 / 3072) * 100).toFixed(4)),
			groundYPercent: Number(((1080 / 1664) * 100).toFixed(4)),
			terrainLabel: 'Upper Stone Plateau (y=1080px)',
		},
		layers: {
			background0: '/assets/maps/map-grave/Background_0.png',
			background1: '/assets/maps/map-grave/Background_1.png',
			grassBackground1: '/assets/maps/map-grave/Grass_background_1.png',
			grassBackground2: '/assets/maps/map-grave/Grass_background_2.png',
			tiles: '/assets/maps/map-grave/Tiles.png',
			brush: '/assets/maps/map-grave/brush.png',
			salt: '/assets/maps/map-grave/Salt.png',
			test1: '/assets/maps/map-grave/maptest/test_1.png',
			test2: '/assets/maps/map-grave/maptest/test_2.png',
		},
	},
}

/**
 * Computes the exact CSS percentage translation so that a character sprite's boots (row y = 55 of 64)
 * sit directly on the map spawn coordinate (xPercent, groundYPercent) without floating or sliding.
 */
export function getSpriteGroundAnchorTransform(
	characterId: CharacterId,
	animation: SpriteAnimationState,
	facing: 'left' | 'right',
): {translateXPercent: number; translateYPercent: number} {
	const translateYPercent = -(SPRITE_FOOT_ANCHOR_RATIO * 100) // -87.5%

	// Dark Ninja's 96x64 attack frame extends 32px in front of the character while the feet remain at x=24 from the back edge
	if (characterId === 'dark-ninja' && animation === 'attack') {
		return {
			translateXPercent: facing === 'right' ? -33.3333 : -66.6667,
			translateYPercent,
		}
	}

	return {
		translateXPercent: -50,
		translateYPercent,
	}
}

export const CHARACTER_LIST: CharacterConfig[] = [
	CHARACTERS['dark-ninja'],
	CHARACTERS.reaper,
	CHARACTERS.samurai,
	CHARACTERS.knight,
]

export const SUBJECT_LIST: Subject[] = ['maths', 'physics', 'chemistry', 'biology']
export const RARITY_LIST: Rarity[] = ['normal', 'uncommon', 'epic', 'legendary']
export const FRAME_LIST: FrameType[] = ['A', 'B']
export const VOICE_EVENT_LIST: VoiceEvent[] = ['attack', 'hurt', 'death']

export const CHARACTER_IDS: CharacterId[] = ['dark-ninja', 'reaper', 'samurai', 'knight']
export const SUBJECTS: Subject[] = SUBJECT_LIST
export const RARITIES: Rarity[] = RARITY_LIST
