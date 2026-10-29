import type {ButtonHTMLAttributes, ReactNode} from 'react'

export type FlatFrameVariant = 'silver' | 'blue' | 'gold'
export type FlatWellVariant =
	| 'dark'
	| 'blue-dark'
	| 'gold-dark'
	| 'silver'
	| 'silver-inset'
	| 'blue'
	| 'gold'
	| 'orange'
export type FlatBannerVariant = 'ribbon-up' | 'ribbon-down' | 'offset-bl' | 'offset-tl'
export type FlatButtonVariant = 'cream' | 'round' | 'gold' | 'orange' | 'blue' | 'silver' | 'dark'
export type FlatIconName =
	| 'play'
	| 'check'
	| 'cross'
	| 'arrow'
	| 'point'
	| 'stripe'
	| 'line'
	| 'dropdown'
	| 'plus'
	| 'minus'

const ICON_PATHS: Record<FlatIconName, string> = {
	play: '/assets/flatui/UI_Flat_IconPlay01b.png',
	check: '/assets/flatui/UI_Flat_IconCheck01a.png',
	cross: '/assets/flatui/UI_Flat_IconCross01b.png',
	arrow: '/assets/flatui/UI_Flat_IconArrow01b.png',
	point: '/assets/flatui/UI_Flat_IconPoint01a.png',
	stripe: '/assets/flatui/UI_Flat_IconStripe01a.png',
	line: '/assets/flatui/UI_Flat_IconLine01a.png',
	dropdown: '/assets/flatui/UI_Flat_IconDropdown01a.png',
	plus: '/assets/flatui/UI_Flat_ButtonPlus01a.png',
	minus: '/assets/flatui/UI_Flat_ButtonMinus01a.png',
}

export function FlatIcon({name, className = 'h-3.5 w-auto'}: {name: FlatIconName; className?: string}) {
	return (
		<img
			src={ICON_PATHS[name]}
			alt=""
			aria-hidden="true"
			draggable={false}
			referrerPolicy="no-referrer"
			className={`pixelated pointer-events-none inline-block shrink-0 select-none ${className}`}
		/>
	)
}

export interface FlatBannerProps {
	variant?: FlatBannerVariant
	children: ReactNode
	className?: string
}

export function FlatBanner({children, className = ''}: FlatBannerProps) {
	return (
		<div
			className={`flat-banner-offset-bl inline-flex items-center gap-2 font-pixel text-xs text-[#141824] ${className}`}
		>
			{children}
		</div>
	)
}

export interface FlatPanelProps {
	variant?: FlatFrameVariant
	wellVariant?: FlatWellVariant | 'none'
	children: ReactNode
	className?: string
	wellClassName?: string
}

/**
 * Renders a 9-sliced pixel-art outer frame (`UI_Flat_Frame01a` silver, `02a` blue, or `03a` gold)
 * housing a recessed dark `UI_Flat_FrameSlot01c..03c` interior well so light text, sprites, and cards
 * remain high-contrast and crisp inside the authentic FlatUI frame.
 */
export function FlatPanel({
	variant = 'silver',
	wellVariant = 'dark',
	children,
	className = '',
	wellClassName = 'p-5',
}: FlatPanelProps) {
	const frameClass =
		variant === 'blue' ? 'flat-frame-blue' : variant === 'gold' ? 'flat-frame-gold' : 'flat-frame-silver'

	if (wellVariant === 'none') {
		return <div className={`${frameClass} ${className}`}>{children}</div>
	}

	const wellClass =
		wellVariant === 'blue-dark'
			? 'flat-slot-blue-dark'
			: wellVariant === 'gold-dark'
				? 'flat-slot-gold-dark'
				: wellVariant === 'silver'
					? 'flat-slot-silver text-[#141824]'
					: wellVariant === 'silver-inset'
						? 'flat-slot-silver-inset text-[#141824]'
						: wellVariant === 'blue'
							? 'flat-slot-blue text-white'
							: wellVariant === 'gold'
								? 'flat-slot-gold text-[#141824]'
								: wellVariant === 'orange'
									? 'flat-slot-orange text-white'
									: 'flat-slot-dark text-slate-100'

	return (
		<div className={`${frameClass} p-1 ${className}`}>
			<div className={`${wellClass} h-full w-full ${wellClassName}`}>{children}</div>
		</div>
	)
}

export interface FlatWellProps {
	variant?: FlatWellVariant
	children: ReactNode
	className?: string
}

export function FlatWell({variant = 'dark', children, className = ''}: FlatWellProps) {
	const wellClass =
		variant === 'blue-dark'
			? 'flat-slot-blue-dark text-slate-100'
			: variant === 'gold-dark'
				? 'flat-slot-gold-dark text-slate-100'
				: variant === 'silver'
					? 'flat-slot-silver text-[#141824]'
					: variant === 'silver-inset'
						? 'flat-slot-silver-inset text-[#141824]'
						: variant === 'blue'
							? 'flat-slot-blue text-white'
							: variant === 'gold'
								? 'flat-slot-gold text-[#141824]'
								: variant === 'orange'
									? 'flat-slot-orange text-white'
									: 'flat-slot-dark text-slate-100'

	return <div className={`${wellClass} ${className}`}>{children}</div>
}

export interface FlatButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: FlatButtonVariant
	icon?: FlatIconName
	size?: 'sm' | 'md' | 'lg'
}

export function FlatButton({
	variant = 'cream',
	icon,
	size = 'md',
	className = '',
	children,
	disabled,
	...rest
}: FlatButtonProps) {
	const sizeClass =
		size === 'sm'
			? 'h-8 px-2.5 py-1 text-[10px] leading-none'
			: size === 'lg'
				? 'h-11 px-5 py-2 text-xs leading-none'
				: 'h-9 px-3.5 py-1.5 text-xs leading-none'

	const variantClass =
		variant === 'round'
			? 'flat-btn-round font-pixel text-[#141824] hover:brightness-105'
			: variant === 'gold'
				? 'flat-slot-gold font-pixel text-[#141824] hover:brightness-110 active:translate-y-px disabled:opacity-45'
				: variant === 'orange'
					? 'flat-slot-orange font-pixel text-white hover:brightness-110 active:translate-y-px disabled:opacity-45'
					: variant === 'blue'
						? 'flat-slot-blue font-pixel text-white hover:brightness-110 active:translate-y-px disabled:opacity-45'
						: variant === 'silver'
							? 'flat-slot-silver font-pixel text-[#141824] hover:brightness-105 active:translate-y-px disabled:opacity-45'
							: variant === 'dark'
								? 'flat-slot-dark font-pixel text-slate-200 hover:text-amber-300 active:translate-y-px disabled:opacity-45'
								: 'flat-btn-bevel font-pixel text-[#141824]'

	return (
		<button
			type="button"
			disabled={disabled}
			className={`inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap shrink-0 select-none align-middle disabled:cursor-not-allowed ${variantClass} ${sizeClass} ${className}`}
			{...rest}
		>
			{icon && <FlatIcon name={icon} />}
			{children}
		</button>
	)
}

export interface FlatBarProps {
	value: number
	max: number
	shieldValue?: number
	fillTone?: 'green' | 'red' | 'gold' | 'cream' | 'teal'
	heightClass?: string
	label?: string
	valueText?: string
}

const BAR_FILL_PATHS: Record<NonNullable<FlatBarProps['fillTone']>, string> = {
	green: '/assets/flatui/UI_Flat_BarFill01a.png',
	teal: '/assets/flatui/UI_Flat_BarFill01b.png',
	red: '/assets/flatui/UI_Flat_BarFill01c.png',
	gold: '/assets/flatui/UI_Flat_BarFill01e.png',
	cream: '/assets/flatui/UI_Flat_BarFill01f.png',
}

/**
 * Renders a pixel-art progress bar using `UI_Flat_Bar06a.png` for the recessed frame track
 * and `UI_Flat_BarFill01a..f.png` for the interior fill bar, with an optional blue shield bar
 * rendered directly on top covering the health bar when `shieldValue > 0`.
 */
export function FlatBar({value, max, shieldValue = 0, fillTone = 'green', heightClass = 'h-5'}: FlatBarProps) {
	const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
	const shieldPct = max > 0 && shieldValue > 0 ? Math.max(0, Math.min(100, (shieldValue / max) * 100)) : 0
	const fillSrc = BAR_FILL_PATHS[fillTone]

	return (
		<div className={`flat-bar-track relative w-full overflow-hidden ${heightClass}`}>
			<div
				style={{
					width: `${pct}%`,
					backgroundImage: `url("${fillSrc}")`,
					backgroundSize: '100% 100%',
				}}
				className="pixelated h-full transition-all duration-150"
			/>
			{shieldPct > 0 && (
				<div
					style={{
						width: `${shieldPct}%`,
						backgroundImage: `url("${BAR_FILL_PATHS.teal}")`,
						backgroundSize: '100% 100%',
					}}
					className="pixelated absolute inset-y-0 left-0 z-10 h-full bg-sky-500/35 transition-all duration-150"
				/>
			)}
		</div>
	)
}

export interface FlatManaPipsProps {
	currentMana: number
	maxMana: number
	reservedMana?: number
}

/**
 * Renders the 5 Mana slots using `UI_Flat_FrameSlot02a.png` (available blue mana),
 * `UI_Flat_FrameSlot03a.png` (reserved amber mana for selected cards), and
 * `UI_Flat_FrameSlot01c.png` (empty slot), with `UI_Flat_ToggleOn01a` / `Off01a` pips.
 */
export function FlatManaPips({currentMana, maxMana, reservedMana = 0}: FlatManaPipsProps) {
	const slots = Array.from({length: maxMana}, (_, idx) => idx)
	return (
		<div className="flex shrink-0 items-center gap-1">
			{slots.map((slotIdx) => {
				const isAvailable = slotIdx < currentMana
				const isReserved = reservedMana > 0 && slotIdx >= currentMana - reservedMana && slotIdx < currentMana
				const slotSrc = isReserved
					? '/assets/flatui/UI_Flat_FrameSlot03a.png'
					: isAvailable
						? '/assets/flatui/UI_Flat_FrameSlot02a.png'
						: '/assets/flatui/UI_Flat_FrameSlot01c.png'
				const pipSrc = isReserved
					? '/assets/flatui/UI_Flat_ToggleOn01a.png'
					: isAvailable
						? '/assets/flatui/UI_Flat_ToggleOn02a.png'
						: '/assets/flatui/UI_Flat_ToggleOff01a.png'

				return (
					<span
						key={slotIdx}
						style={{
							backgroundImage: `url("${slotSrc}")`,
							backgroundSize: '100% 100%',
						}}
						className="pixelated inline-flex h-5 w-5 items-center justify-center bg-[#101522]"
					>
						<img
							src={pipSrc}
							alt=""
							aria-hidden="true"
							draggable={false}
							referrerPolicy="no-referrer"
							className="pixelated h-2.5 w-2.5 select-none"
						/>
					</span>
				)
			})}
		</div>
	)
}
