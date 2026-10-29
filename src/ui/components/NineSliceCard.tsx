import {useEffect, useState} from 'react'
import {
	type FrameType,
	NINE_SLICE_CONFIG,
	RARITY_FILL_PALETTE,
	type Rarity,
	SUBJECT_BORDER_PALETTE,
	type Subject,
} from '../../engine/config'
import {translateCardText} from '../../i18n/cardTranslations'
import {useLanguage} from '../../i18n/LanguageContext'
import {getCachedCardFrame, preloadAllCardFrames} from '../utils/nineSliceCache'

export interface NineSliceCardProps {
	id: string
	name: string
	subject: Subject
	rarity: Rarity
	cost: number
	text: string
	upgraded?: boolean
	exhaust?: boolean
	power?: boolean
	integerScale?: 2 | 3 | 4
	scaleMultiplier?: number
	selected?: boolean
	selectionOrder?: number
	disabled?: boolean
	showSliceGuides?: boolean
	onClick?: () => void
}

export function NineSliceCard({
	id,
	name,
	subject,
	rarity,
	cost,
	text,
	upgraded = false,
	exhaust = false,
	power = false,
	integerScale = 3,
	scaleMultiplier = 1,
	selected = false,
	selectionOrder,
	disabled = false,
	showSliceGuides = false,
	onClick,
}: NineSliceCardProps) {
	const {lang} = useLanguage()
	const frameType: FrameType = upgraded ? 'B' : 'A'
	const [bgDataUrl, setBgDataUrl] = useState<string>(() => getCachedCardFrame(frameType, rarity, subject, integerScale))

	useEffect(() => {
		const cached = getCachedCardFrame(frameType, rarity, subject, integerScale)
		if (cached) {
			setBgDataUrl(cached)
		} else {
			preloadAllCardFrames([integerScale]).then(() => {
				setBgDataUrl(getCachedCardFrame(frameType, rarity, subject, integerScale))
			})
		}
	}, [frameType, rarity, subject, integerScale])

	const widthPx = NINE_SLICE_CONFIG.logicalCardWidth * integerScale
	const heightPx = NINE_SLICE_CONFIG.logicalCardHeight * integerScale
	const scaledWidthPx = Math.round(widthPx * scaleMultiplier)
	const scaledHeightPx = Math.round(heightPx * scaleMultiplier)
	const insetPx = NINE_SLICE_CONFIG.insets.left * integerScale

	const subjectMeta = SUBJECT_BORDER_PALETTE[subject]
	const rarityMeta = RARITY_FILL_PALETTE[rarity]
	const displayName = upgraded && !name.endsWith('+') ? `${name}+` : name

	return (
		<div
			style={{
				width: `${scaledWidthPx}px`,
				height: `${scaledHeightPx}px`,
			}}
			className={`relative select-none transition-transform duration-150 ${
				onClick && !disabled ? 'hover:-translate-y-1.5' : ''
			} ${selected ? '-translate-y-2 ring-1 ring-amber-300/90 shadow-[0_0_8px_rgba(251,191,36,0.35)]' : ''} ${disabled ? 'opacity-60' : ''}`}
		>
			<div
				style={{
					width: `${widthPx}px`,
					height: `${heightPx}px`,
					transform: scaleMultiplier !== 1 ? `scale(${scaleMultiplier})` : undefined,
					transformOrigin: 'top left',
				}}
				className="relative"
			>
				{onClick && !disabled && (
					<button
						type="button"
						aria-label={`Select card ${displayName}`}
						onClick={onClick}
						className="absolute inset-0 z-15 cursor-pointer bg-transparent"
					/>
				)}
			{/* Cached 9-slice pixel-art frame */}
			{bgDataUrl && (
				<img
					src={bgDataUrl}
					alt={`${displayName} (${rarityMeta.label} ${subjectMeta.label} Frame ${frameType})`}
					referrerPolicy="no-referrer"
					draggable={false}
					className="pixelated pointer-events-none absolute inset-0 h-full w-full"
				/>
			)}

			{/* Optional 9-slice inset inspection overlay in #/debug */}
			{showSliceGuides && (
				<div className="pointer-events-none absolute inset-0 z-20">
					<div style={{top: `${insetPx}px`}} className="absolute inset-x-0 border-t border-dashed border-cyan-300/80" />
					<div
						style={{bottom: `${insetPx}px`}}
						className="absolute inset-x-0 border-t border-dashed border-cyan-300/80"
					/>
					<div
						style={{left: `${insetPx}px`}}
						className="absolute inset-y-0 border-l border-dashed border-cyan-300/80"
					/>
					<div
						style={{right: `${insetPx}px`}}
						className="absolute inset-y-0 border-l border-dashed border-cyan-300/80"
					/>
				</div>
			)}

			{/* Card Interior Layout — padded strictly inside the 9-slice inner border & corner notches */}
			<div
				style={{
					paddingTop: `${9 * integerScale}px`,
					paddingBottom: `${10 * integerScale}px`,
					paddingLeft: `${6 * integerScale}px`,
					paddingRight: `${7 * integerScale}px`,
				}}
				className="relative z-10 flex h-full w-full flex-col justify-between overflow-hidden text-left"
			>
				{/* Top Row: Mana Cost + Subject Code & Card ID */}
				<div className="flex w-full items-center justify-between gap-1 overflow-hidden">
					<div
						style={{
							borderColor: subjectMeta.highlight,
							backgroundColor: '#131549',
						}}
						className={`flex shrink-0 items-center justify-center border font-pixel font-bold text-amber-300 shadow-sm ${
							integerScale === 2 ? 'h-4 w-4 text-[9px]' : integerScale === 3 ? 'h-6 w-6 text-xs' : 'h-7 w-7 text-sm'
						}`}
					>
						{cost}
					</div>

					<div
						className={`flex min-w-0 items-center gap-0.5 truncate border border-white/15 bg-[#131549]/85 font-pixel tracking-tight text-slate-100 ${
							integerScale === 2
								? 'px-1 py-0.5 text-[8px]'
								: integerScale === 3
									? 'px-1.5 py-0.5 text-[10px]'
									: 'px-2 py-0.5 text-xs'
						}`}
					>
						{selectionOrder !== undefined && (
							<span className="bg-amber-400 px-1 py-0.5 text-[8px] text-slate-950">#{selectionOrder}</span>
						)}
						<span style={{color: subjectMeta.highlight}} className="truncate">
							{subjectMeta.shortCode}
						</span>
						<span aria-hidden="true">·</span>
						<span className="truncate text-slate-200">{id}</span>
					</div>
				</div>

				{/* Card Title Banner */}
				<div
					className={`w-full overflow-hidden border-y border-white/20 bg-[#131549]/85 text-center ${
						integerScale === 2 ? 'my-0.5 px-1 py-0.5' : integerScale === 3 ? 'my-1 px-1.5 py-0.5' : 'my-1 px-2 py-1'
					}`}
				>
					<div
						style={{color: upgraded ? '#fde047' : '#f8fafc'}}
						className={`truncate font-pixel font-bold leading-tight ${
							integerScale === 2 ? 'text-[9px]' : integerScale === 3 ? 'text-[11px]' : 'text-xs'
						}`}
					>
						{displayName}
					</div>
				</div>

				{/* Effect Text Body */}
				<div
					className={`flex min-h-0 flex-1 flex-col justify-center overflow-hidden border border-white/15 bg-[#131549]/75 ${
						integerScale === 2 ? 'px-1.5 py-1' : integerScale === 3 ? 'px-2 py-1' : 'px-2.5 py-1.5'
					}`}
				>
					<p
						className={`font-pixel-body text-slate-100 ${
							integerScale === 2
								? 'text-[9px] leading-tight'
								: integerScale === 3
									? 'text-[11px] leading-snug'
									: 'text-xs leading-snug'
						}`}
					>
						{translateCardText(text, lang)}
					</p>
					{(exhaust || power) && (
						<div
							className={`mt-0.5 truncate font-pixel text-amber-300/90 ${
								integerScale === 2 ? 'text-[8px]' : 'text-[9px]'
							}`}
						>
							{power ? 'Power (P)' : ''}
							{power && exhaust ? ' · ' : ''}
							{exhaust ? 'Exhaust' : ''}
						</div>
					)}
				</div>

				{/* Bottom Metadata Row: Rarity · Frame C/D/E/F + Subject */}
				<div
					className={` flex w-full items-center justify-between gap-1 overflow-hidden border border-white/15 bg-[#131549]/85 font-pixel ${
						integerScale === 2
							? 'mt-0.5 px-1 py-0.5 text-[8px]'
							: integerScale === 3
								? 'mt-1 px-1.5 py-0.5 text-[9px]'
								: 'mt-1 px-2 py-0.5 text-[11px]'
					}`}
				>
					<span style={{color: rarityMeta.badgeText}} className="min-w-0 truncate">
						{rarityMeta.label} · {subjectMeta.frameKey}
					</span>

					<span style={{color: subjectMeta.highlight}} className="shrink-0 truncate">
						{subjectMeta.label}
					</span>
				</div>
			</div>
			</div>
		</div>
	)
}
