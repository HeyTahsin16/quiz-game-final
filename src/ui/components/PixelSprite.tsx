import {useEffect, useRef, useState} from 'react'
import {
	CHARACTERS,
	type CharacterId,
	SPRITE_BOTTOM_TRANSPARENT_ROWS,
	type SpriteAnimationState,
} from '../../engine/config'

export interface PixelSpriteProps {
	characterId: CharacterId
	animation?: SpriteAnimationState
	integerScale?: 1 | 2 | 3 | 4 | 5
	facing?: 'left' | 'right'
	animate?: boolean
	loopOverride?: boolean
	forcedFrame?: number
	/** Compensates for the 8 transparent rows below y=55 in 64px sprite frames when aligned to a floor line */
	groundAlign?: boolean
	/** Scales canvas CSS height to 100% of a percentage-sized map wrapper while preserving crisp integer internal buffers */
	responsiveMapSize?: boolean
	onAnimationComplete?: () => void
	className?: string
}

const imageElementCache = new Map<string, HTMLImageElement>()

function loadCachedImage(src: string): Promise<HTMLImageElement> {
	const existing = imageElementCache.get(src)
	if (existing?.complete && existing.naturalWidth > 0) {
		return Promise.resolve(existing)
	}
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => {
			imageElementCache.set(src, img)
			resolve(img)
		}
		img.onerror = reject
		img.src = src
	})
}

export function PixelSprite({
	characterId,
	animation = 'idle',
	integerScale = 3,
	facing = 'right',
	animate = true,
	loopOverride,
	forcedFrame,
	groundAlign = false,
	responsiveMapSize = false,
	onAnimationComplete,
	className = '',
}: PixelSpriteProps) {
	const char = CHARACTERS[characterId]
	const animConfig = char.animations[animation] ?? char.animations.idle
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const [frameImages, setFrameImages] = useState<HTMLImageElement[]>([])
	const [sheetImage, setSheetImage] = useState<HTMLImageElement | null>(null)
	const [frameIndex, setFrameIndex] = useState(0)
	const [loaded, setLoaded] = useState(false)
	const onCompleteRef = useRef(onAnimationComplete)
	onCompleteRef.current = onAnimationComplete

	// Reset frame index when character or animation state changes
	useEffect(() => {
		if (characterId && animation) {
			setFrameIndex(0)
		}
	}, [characterId, animation])

	// Preload all animations for this character + load active animation images
	useEffect(() => {
		let active = true

		// Preload all animation frames in background for instant state transitions
		for (const cfg of Object.values(char.animations)) {
			if (cfg?.frames) {
				for (const src of cfg.frames) {
					loadCachedImage(src).catch(() => {})
				}
			} else if (cfg?.spriteSheet) {
				loadCachedImage(cfg.spriteSheet).catch(() => {})
			}
		}

		if (animConfig.frames && animConfig.frames.length > 0) {
			Promise.all(animConfig.frames.map((src) => loadCachedImage(src)))
				.then((imgs) => {
					if (!active) return
					setFrameImages(imgs)
					setSheetImage(null)
					setLoaded(true)
				})
				.catch(() => {})
		} else if (animConfig.spriteSheet) {
			loadCachedImage(animConfig.spriteSheet)
				.then((img) => {
					if (!active) return
					setSheetImage(img)
					setFrameImages([])
					setLoaded(true)
				})
				.catch(() => {})
		}

		return () => {
			active = false
		}
	}, [char, animConfig])

	const shouldLoop = loopOverride !== undefined ? loopOverride : animConfig.loop

	useEffect(() => {
		if (!animate || typeof forcedFrame === 'number') return
		const intervalMs = Math.round(1000 / animConfig.fps)
		const id = window.setInterval(() => {
			setFrameIndex((prev) => {
				if (prev + 1 < animConfig.frameCount) {
					return prev + 1
				}
				if (shouldLoop) {
					return 0
				}
				if (onCompleteRef.current) {
					window.setTimeout(() => onCompleteRef.current?.(), 0)
				}
				return prev
			})
		}, intervalMs)
		return () => window.clearInterval(id)
	}, [animate, forcedFrame, animConfig.fps, animConfig.frameCount, shouldLoop])

	const currentFrame =
		typeof forcedFrame === 'number'
			? Math.max(0, forcedFrame) % animConfig.frameCount
			: Math.min(frameIndex, animConfig.frameCount - 1)
	const outW = animConfig.frameWidth * integerScale
	const outH = animConfig.frameHeight * integerScale
	const bottomTrimPx = groundAlign ? -(SPRITE_BOTTOM_TRANSPARENT_ROWS * integerScale) : 0

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas || !loaded) return

		const ctx = canvas.getContext('2d')
		if (!ctx) return

		ctx.clearRect(0, 0, outW, outH)
		ctx.imageSmoothingEnabled = false

		ctx.save()
		if (char.fadeOnDeath && animation === 'death') {
			const progress = animConfig.frameCount > 1 ? currentFrame / (animConfig.frameCount - 1) : 1
			ctx.globalAlpha = Math.max(0.22, Number((0.85 - progress * 0.63).toFixed(2)))
		}
		if (facing === 'left') {
			ctx.translate(outW, 0)
			ctx.scale(-1, 1)
		}

		if (frameImages.length > 0) {
			const frameImg = frameImages[currentFrame] ?? frameImages[0]
			if (frameImg) {
				ctx.drawImage(frameImg, 0, 0, animConfig.frameWidth, animConfig.frameHeight, 0, 0, outW, outH)
			}
		} else if (sheetImage) {
			const sx = currentFrame * animConfig.frameWidth
			ctx.drawImage(sheetImage, sx, 0, animConfig.frameWidth, animConfig.frameHeight, 0, 0, outW, outH)
		}

		ctx.restore()
	}, [
		loaded,
		currentFrame,
		facing,
		outW,
		outH,
		animConfig.frameWidth,
		animConfig.frameHeight,
		animConfig.frameCount,
		frameImages,
		sheetImage,
		char.fadeOnDeath,
		animation,
	])

	return (
		<canvas
			ref={canvasRef}
			width={outW}
			height={outH}
			style={
				responsiveMapSize
					? {
							height: '100%',
							width: 'auto',
							aspectRatio: `${animConfig.frameWidth} / ${animConfig.frameHeight}`,
						}
					: {
							width: `${outW}px`,
							height: `${outH}px`,
							marginBottom: bottomTrimPx !== 0 ? `${bottomTrimPx}px` : undefined,
						}
			}
			aria-label={`${char.name} ${animation} sprite (${facing}, ${integerScale}x scale)`}
			className={`pixelated block select-none ${className}`}
		/>
	)
}
