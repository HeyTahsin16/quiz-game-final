/**
 * 9-Slice Card Frame Pre-Renderer & Cache
 *
 * Uses the 4 colored 48x48 pixel-art card frames from /assets/goldui:
 * - 20240707dragon9SlicesC.png (Teal / Cyan -> Physics)
 * - 20240707dragon9SlicesD.png (Gold / Amber -> Chemistry)
 * - 20240707dragon9SlicesE.png (Rose / Pink -> Biology)
 * - 20240707dragon9SlicesF.png (Crimson / Coral Red -> Maths, recolored from C/D/E)
 *
 * Slices each 48x48 frame using 16x16 unstretched corners and 16px edges to the 64x96
 * logical card aspect ratio (2:3), then integer-scales (2x/3x/4x) with nearest-neighbor.
 */

import {
	FRAME_LIST,
	type FrameType,
	NINE_SLICE_CONFIG,
	RARITY_LIST,
	type Rarity,
	SUBJECT_LIST,
	type Subject,
} from '../../engine/config'

export interface CachedFrameStats {
	totalCached: number
	renderCalls: number
	cacheHits: number
	sliceInsets: {top: number; right: number; bottom: number; left: number}
	sourceDimensions: {width: number; height: number}
}

const frameCache = new Map<string, string>()
const loadedSubjectImages = new Map<Subject, HTMLImageElement>()
let renderCalls = 0
let cacheHits = 0
let initPromise: Promise<void> | null = null

function getCacheKey(frame: FrameType, rarity: Rarity, subject: Subject, integerScale: number): string {
	return `${frame}:${rarity}:${subject}:scale${integerScale}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => resolve(img)
		img.onerror = (err) => reject(err)
		img.src = src
	})
}

/**
 * Inspects a 9-slice source image to verify or detect its corner slice insets.
 */
export function inspectSliceInsets(img: HTMLImageElement): {
	top: number
	right: number
	bottom: number
	left: number
} {
	const w = img.naturalWidth || NINE_SLICE_CONFIG.sourceWidth
	const h = img.naturalHeight || NINE_SLICE_CONFIG.sourceHeight
	// Standard 1/3 split for 48x48 dragon 9-slice frames -> 16px corners
	if (w === 48 && h === 48) {
		return {...NINE_SLICE_CONFIG.insets}
	}
	const thirdX = Math.floor(w / 3)
	const thirdY = Math.floor(h / 3)
	return {top: thirdY, right: thirdX, bottom: thirdY, left: thirdX}
}

/**
 * Renders a single 9-slice card background from its 48x48 goldui source image (C, D, E, or F)
 * at 1x logical card resolution (64x96), then scales up by integer `integerScale`
 * using nearest-neighbor (`imageSmoothingEnabled = false`) so corners are never stretched.
 */
function renderSingleCardFrame(
	sourceImg: HTMLImageElement,
	frame: FrameType,
	_rarity: Rarity,
	_subject: Subject,
	integerScale: number,
): string {
	renderCalls++

	const srcW = sourceImg.naturalWidth || NINE_SLICE_CONFIG.sourceWidth
	const srcH = sourceImg.naturalHeight || NINE_SLICE_CONFIG.sourceHeight
	const insets = inspectSliceInsets(sourceImg)

	// Step 1: Draw the authentic 48x48 goldui source image (C, D, E, or F)
	const srcCanvas = document.createElement('canvas')
	srcCanvas.width = srcW
	srcCanvas.height = srcH
	const srcCtx = srcCanvas.getContext('2d')
	if (!srcCtx) return ''
	srcCtx.imageSmoothingEnabled = false
	srcCtx.drawImage(sourceImg, 0, 0)

	// For upgraded cards (Frame B), highlight the inner frame accent line in bright gold
	if (frame === 'B') {
		const imgData = srcCtx.getImageData(0, 0, srcW, srcH)
		const data = imgData.data
		for (let i = 0; i < data.length; i += 4) {
			if (data[i + 3] === 0) continue
			const r = data[i]
			const g = data[i + 1]
			const b = data[i + 2]
			const isInnerLine =
				(r === 0x6b && g === 0x69 && b === 0x9b) ||
				(r === 0xbf && g === 0x5b && b === 0x56) ||
				(r === 0x7d && g === 0x24 && b === 0x30)
			if (isInnerLine) {
				data[i] = 0xfd
				data[i + 1] = 0xe0
				data[i + 2] = 0x47
			}
		}
		srcCtx.putImageData(imgData, 0, 0)
	}

	// Step 2: Assemble 9-slice at 1x logical card resolution (64x96) without stretching corners
	const logW = NINE_SLICE_CONFIG.logicalCardWidth
	const logH = NINE_SLICE_CONFIG.logicalCardHeight
	const {top, right, bottom, left} = insets
	const srcCenterW = srcW - left - right
	const srcCenterH = srcH - top - bottom
	const dstCenterW = logW - left - right
	const dstCenterH = logH - top - bottom

	const logicalCanvas = document.createElement('canvas')
	logicalCanvas.width = logW
	logicalCanvas.height = logH
	const logCtx = logicalCanvas.getContext('2d')
	if (!logCtx) return ''
	logCtx.imageSmoothingEnabled = false

	// 4 Corners (16x16, 1:1 unstretched)
	logCtx.drawImage(srcCanvas, 0, 0, left, top, 0, 0, left, top)
	logCtx.drawImage(srcCanvas, srcW - right, 0, right, top, logW - right, 0, right, top)
	logCtx.drawImage(srcCanvas, 0, srcH - bottom, left, bottom, 0, logH - bottom, left, bottom)
	logCtx.drawImage(srcCanvas, srcW - right, srcH - bottom, right, bottom, logW - right, logH - bottom, right, bottom)

	// 4 Edges (tiled/stretched along single axis only)
	logCtx.drawImage(srcCanvas, left, 0, srcCenterW, top, left, 0, dstCenterW, top)
	logCtx.drawImage(srcCanvas, left, srcH - bottom, srcCenterW, bottom, left, logH - bottom, dstCenterW, bottom)
	logCtx.drawImage(srcCanvas, 0, top, left, srcCenterH, 0, top, left, dstCenterH)
	logCtx.drawImage(srcCanvas, srcW - right, top, right, srcCenterH, logW - right, top, right, dstCenterH)

	// Center slice (interior fill)
	logCtx.drawImage(srcCanvas, left, top, srcCenterW, srcCenterH, left, top, dstCenterW, dstCenterH)

	// Step 3: Scale by integer factor with nearest-neighbor (imageSmoothingEnabled = false)
	const outCanvas = document.createElement('canvas')
	outCanvas.width = logW * integerScale
	outCanvas.height = logH * integerScale
	const outCtx = outCanvas.getContext('2d')
	if (!outCtx) return ''
	outCtx.imageSmoothingEnabled = false
	outCtx.drawImage(logicalCanvas, 0, 0, logW, logH, 0, 0, outCanvas.width, outCanvas.height)

	return outCanvas.toDataURL('image/png')
}

/**
 * Pre-renders all card frame combinations from the 4 goldui 9-slice sprites (C, D, E, F) at the requested integer scales.
 */
export async function preloadAllCardFrames(scales: number[] = [2, 3, 4]): Promise<CachedFrameStats> {
	if (!initPromise) {
		initPromise = (async () => {
			await Promise.all(
				SUBJECT_LIST.map(async (subject) => {
					const img = await loadImage(NINE_SLICE_CONFIG.subjectFrames[subject])
					loadedSubjectImages.set(subject, img)
				}),
			)
		})()
	}
	await initPromise

	for (const scale of scales) {
		for (const frame of FRAME_LIST) {
			for (const rarity of RARITY_LIST) {
				for (const subject of SUBJECT_LIST) {
					const srcImg = loadedSubjectImages.get(subject)
					if (!srcImg) continue
					const key = getCacheKey(frame, rarity, subject, scale)
					if (!frameCache.has(key)) {
						const dataUrl = renderSingleCardFrame(srcImg, frame, rarity, subject, scale)
						frameCache.set(key, dataUrl)
					}
				}
			}
		}
	}

	return getFrameCacheStats()
}

/**
 * Retrieves a pre-rendered card frame from the cache (or renders & caches on first request).
 */
export function getCachedCardFrame(
	frame: FrameType,
	rarity: Rarity,
	subject: Subject,
	integerScale: number = NINE_SLICE_CONFIG.defaultIntegerScale,
): string {
	const key = getCacheKey(frame, rarity, subject, integerScale)
	const existing = frameCache.get(key)
	if (existing) {
		cacheHits++
		return existing
	}

	const srcImg = loadedSubjectImages.get(subject)
	if (!srcImg) {
		return ''
	}
	const rendered = renderSingleCardFrame(srcImg, frame, rarity, subject, integerScale)
	frameCache.set(key, rendered)
	return rendered
}

/**
 * Replaces a subject's 9-slice source image at runtime and rebuilds the cache.
 */
export async function replaceFrameSourceAndRebuild(
	frameOrSubject: FrameType | Subject,
	dataUrl: string,
	scales: number[] = [2, 3, 4],
): Promise<CachedFrameStats> {
	const img = await loadImage(dataUrl)
	if (frameOrSubject === 'A' || frameOrSubject === 'B') {
		for (const s of SUBJECT_LIST) {
			loadedSubjectImages.set(s, img)
		}
		frameCache.clear()
	} else {
		loadedSubjectImages.set(frameOrSubject, img)
		for (const key of Array.from(frameCache.keys())) {
			if (key.includes(`:${frameOrSubject}:`)) {
				frameCache.delete(key)
			}
		}
	}
	return preloadAllCardFrames(scales)
}

export function getFrameCacheStats(): CachedFrameStats {
	const firstImg = loadedSubjectImages.get('physics')
	return {
		totalCached: frameCache.size,
		renderCalls,
		cacheHits,
		sliceInsets: firstImg ? inspectSliceInsets(firstImg) : {...NINE_SLICE_CONFIG.insets},
		sourceDimensions: {
			width: firstImg?.naturalWidth || NINE_SLICE_CONFIG.sourceWidth,
			height: firstImg?.naturalHeight || NINE_SLICE_CONFIG.sourceHeight,
		},
	}
}
