import type {ReactNode} from 'react'
import type {PlayerPowers} from '../../engine/powers'
import {
	BATTLE_MAPS,
	type BattleMapId,
	CHARACTERS,
	type CharacterId,
	DEFAULT_BATTLE_MAP_ID,
	getSpriteGroundAnchorTransform,
	type SpriteAnimationState,
} from '../../engine/config'
import {getCharacterDisplay, useLanguage} from '../../i18n/LanguageContext'
import {FlatBanner} from './FlatUi'
import {PixelSprite} from './PixelSprite'

export interface BattleArenaStageProps {
	mapId?: BattleMapId
	p1Character: CharacterId
	p2Character: CharacterId
	p1Name?: string
	p2Name?: string
	p1Animation: SpriteAnimationState
	p2Animation: SpriteAnimationState
	p1Hp?: number
	p1MaxHp?: number
	p1Block?: number
	p1Powers?: PlayerPowers
	p1PhoenixUsed?: boolean
	p2Hp?: number
	p2MaxHp?: number
	p2Block?: number
	p2Powers?: PlayerPowers
	p2PhoenixUsed?: boolean
	activePlayerIndex?: 0 | 1
	isPlaying?: boolean
	onP1AnimationComplete?: () => void
	onP2AnimationComplete?: () => void
	showGroundGuides?: boolean
	topRightAction?: ReactNode
	fullScreen?: boolean
}

export function BattleArenaStage({
	mapId = DEFAULT_BATTLE_MAP_ID,
	p1Character,
	p2Character,
	p1Name,
	p2Name,
	p1Animation,
	p2Animation,
	activePlayerIndex = 0,
	isPlaying = false,
	onP1AnimationComplete,
	onP2AnimationComplete,
	showGroundGuides = false,
	topRightAction,
	fullScreen = false,
}: BattleArenaStageProps) {
	const {lang, isBangla} = useLanguage()
	const map = BATTLE_MAPS[mapId]
	const p1Anchor = getSpriteGroundAnchorTransform(p1Character, p1Animation, 'right')
	const p2Anchor = getSpriteGroundAnchorTransform(p2Character, p2Animation, 'left')
	const spriteHeightPercent = ((map.spriteFrameHeight * map.spriteMapScale) / map.height) * 100
	const p1DefaultName = CHARACTERS[p1Character].name
	const p2DefaultName = CHARACTERS[p2Character].name
	const p1DisplayName =
		!p1Name || p1Name === p1DefaultName
			? getCharacterDisplay(p1Character, CHARACTERS[p1Character], lang).name
			: p1Name
	const p2DisplayName =
		!p2Name || p2Name === p2DefaultName
			? getCharacterDisplay(p2Character, CHARACTERS[p2Character], lang).name
			: p2Name

	return (
		<div className={fullScreen ? 'h-screen w-full' : 'w-full'}>
			<div
				style={fullScreen ? undefined : {aspectRatio: `${map.width} / ${map.height}`}}
				className={`relative w-full overflow-hidden bg-[#070a14] select-none ${fullScreen ? 'h-full' : ''}`}
			>
				{topRightAction && <div className="absolute top-2 right-2 z-30">{topRightAction}</div>}

				{/* Base Battle Map Image (moon.png: 3072x1664 at 4x pixel scale) */}
				<img
					src={map.imagePath}
					alt={`${map.name} battle arena`}
					draggable={false}
					className="pixelated pointer-events-none absolute inset-0 h-full w-full object-fill select-none"
				/>

				{/* Subtle vignette along top & bottom edges for HUD contrast */}
				<div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-slate-950/70 to-transparent" />
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/75 to-transparent" />

				{/* Optional Ground Baseline Calibration Guides (Debug Gallery only) */}
				{showGroundGuides && (
					<>
						<div className="pointer-events-none absolute top-2.5 left-3 z-20">
							<FlatBanner variant="offset-bl" className="px-2 py-0.5 text-[10px]">
								<span>{map.name}</span>
								<span aria-hidden="true">·</span>
								<span className="font-mono">
									{map.width}×{map.height}px
								</span>
							</FlatBanner>
						</div>
						<div
							style={{top: `${map.p1Spawn.groundYPercent}%`}}
							className="pointer-events-none absolute left-0 z-30 w-1/2 border-t-2 border-dashed border-amber-400/90"
						>
							<span className="bg-slate-950/90 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
								P1 Ground y={map.p1Spawn.groundY}px ({map.p1Spawn.groundYPercent}%) · Sprite foot y=
								{map.spriteFootBaselineY}/64
							</span>
						</div>
						<div
							style={{top: `${map.p2Spawn.groundYPercent}%`}}
							className="pointer-events-none absolute right-0 z-30 w-1/2 border-t-2 border-dashed border-sky-400/90 text-right"
						>
							<span className="bg-slate-950/90 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
								P2 Ground y={map.p2Spawn.groundY}px ({map.p2Spawn.groundYPercent}%) · Sprite foot y=
								{map.spriteFootBaselineY}/64
							</span>
						</div>
					</>
				)}

				{/* Player 1 Active Turn Indicator + Character Name Above Head */}
				<div
					style={{
						left: `${map.p1Spawn.xPercent}%`,
						top: `${map.p1Spawn.groundYPercent - spriteHeightPercent * 0.72}%`,
						transform: 'translate(-50%, -100%)',
					}}
					className="pointer-events-none absolute z-20 flex flex-col items-center gap-1 whitespace-nowrap"
				>
					{activePlayerIndex === 0 && isPlaying && (
						<FlatBanner variant="offset-bl" className="px-2 py-0.5 text-[8px] whitespace-nowrap shadow-md">
							{isBangla ? 'সক্রিয় চাল' : 'ACTIVE TURN'}
						</FlatBanner>
					)}
					<span
						style={{color: CHARACTERS[p1Character].accentHex}}
						className="rounded bg-slate-950/80 px-2 py-0.5 font-pixel text-xs shadow-md"
					>
						{p1DisplayName}
					</span>
				</div>

				{/* Player 1 Sprite Spawn (Left Lower Cobblestone Path: x=592, groundY=1336) */}
				<div
					style={{
						left: `${map.p1Spawn.xPercent}%`,
						top: `${map.p1Spawn.groundYPercent}%`,
						height: `${spriteHeightPercent}%`,
						transform: `translate(${p1Anchor.translateXPercent}%, ${p1Anchor.translateYPercent}%)`,
					}}
					className="pointer-events-none absolute z-10"
				>
					<PixelSprite
						characterId={p1Character}
						animation={p1Animation}
						integerScale={4}
						facing="right"
						responsiveMapSize
						onAnimationComplete={onP1AnimationComplete}
					/>
				</div>

				{/* Player 2 Active Turn Indicator + Character Name Above Head */}
				<div
					style={{
						left: `${map.p2Spawn.xPercent}%`,
						top: `${map.p2Spawn.groundYPercent - spriteHeightPercent * 0.72}%`,
						transform: 'translate(-50%, -100%)',
					}}
					className="pointer-events-none absolute z-20 flex flex-col items-center gap-1 whitespace-nowrap"
				>
					{activePlayerIndex === 1 && isPlaying && (
						<FlatBanner variant="offset-bl" className="px-2 py-0.5 text-[8px] whitespace-nowrap shadow-md">
							{isBangla ? 'সক্রিয় চাল' : 'ACTIVE TURN'}
						</FlatBanner>
					)}
					<span
						style={{color: CHARACTERS[p2Character].accentHex}}
						className="rounded bg-slate-950/80 px-2 py-0.5 font-pixel text-xs shadow-md"
					>
						{p2DisplayName}
					</span>
				</div>

				{/* Player 2 Sprite Spawn (Right Elevated Plateau: x=2208, groundY=1080) */}
				<div
					style={{
						left: `${map.p2Spawn.xPercent}%`,
						top: `${map.p2Spawn.groundYPercent}%`,
						height: `${spriteHeightPercent}%`,
						transform: `translate(${p2Anchor.translateXPercent}%, ${p2Anchor.translateYPercent}%)`,
					}}
					className="pointer-events-none absolute z-10"
				>
					<PixelSprite
						characterId={p2Character}
						animation={p2Animation}
						integerScale={4}
						facing="left"
						responsiveMapSize
						onAnimationComplete={onP2AnimationComplete}
					/>
				</div>
			</div>
		</div>
	)
}

export interface PlayerMapCropStageProps {
	seat: 1 | 2
	mapId?: BattleMapId
	characterId: CharacterId
	animation: SpriteAnimationState
	facing: 'left' | 'right'
	onAnimationComplete?: () => void
}

/**
 * Close-up single-player stage crop of moon.png centered around the seat's exact ground clearing,
 * keeping the character's foot baseline (y=55/64) locked onto the map's ground surface.
 */
export function PlayerMapCropStage({
	seat,
	mapId = DEFAULT_BATTLE_MAP_ID,
	characterId,
	animation,
	facing,
	onAnimationComplete,
}: PlayerMapCropStageProps) {
	const map = BATTLE_MAPS[mapId]
	const spawn = seat === 1 ? map.p1Spawn : map.p2Spawn
	const anchor = getSpriteGroundAnchorTransform(characterId, animation, facing)

	// Zoom 2.2x into the player's side of moon.png while keeping aspect ratio 24:13
	const zoom = 2.2
	const cropCenterXPercent = spawn.xPercent
	const cropGroundYInViewportPercent = 78
	const translateImgXPercent = 50 / zoom - cropCenterXPercent
	const translateImgYPercent = cropGroundYInViewportPercent / zoom - spawn.groundYPercent
	const spriteHeightPercent = ((map.spriteFrameHeight * map.spriteMapScale * zoom) / map.height) * 100

	return (
		<div
			style={{aspectRatio: '16 / 9'}}
			className="flat-slot-dark relative mx-auto my-1.5 w-full max-w-[200px] overflow-hidden bg-[#070a14] select-none"
		>
			<div
				style={{
					width: `${zoom * 100}%`,
					aspectRatio: `${map.width} / ${map.height}`,
					transform: `translate(${translateImgXPercent}%, ${translateImgYPercent}%)`,
				}}
				className="pointer-events-none absolute top-0 left-0"
			>
				<img
					src={map.imagePath}
					alt={`${map.name} P${seat} stage`}
					draggable={false}
					className="pixelated h-full w-full object-fill select-none"
				/>
				<div
					style={{
						left: `${spawn.xPercent}%`,
						top: `${spawn.groundYPercent}%`,
						height: `${((map.spriteFrameHeight * map.spriteMapScale) / map.height) * 100}%`,
						transform: `translate(${anchor.translateXPercent}%, ${anchor.translateYPercent}%)`,
					}}
					className="absolute z-10"
				>
					<PixelSprite
						characterId={characterId}
						animation={animation}
						integerScale={4}
						facing={facing}
						responsiveMapSize
						onAnimationComplete={onAnimationComplete}
					/>
				</div>
			</div>
			<div className="pointer-events-none absolute right-2 bottom-1.5 z-20 bg-slate-950/85 px-2 py-0.5 font-mono text-[10px] text-slate-300">
				{spawn.terrainLabel} · {spriteHeightPercent.toFixed(0)}%H
			</div>
		</div>
	)
}
