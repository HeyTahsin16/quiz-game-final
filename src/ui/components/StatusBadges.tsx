import {useEffect, useRef, useState} from 'react'
import type {PlayerPowers} from '../../engine/powers'
import {translateStatusTooltip} from '../../i18n/attributeTranslations'
import {useLanguage} from '../../i18n/LanguageContext'

export interface StatusBadgesProps {
	powers: PlayerPowers
	phoenixUsed?: boolean
	align?: 'left' | 'right'
}

interface BadgeDisplayItem {
	key: string
	label: string
	valueText: string
	category: 'buff' | 'debuff' | 'permanent'
	tooltip: string
}

export function collectActiveBadges(powers: PlayerPowers, phoenixUsed = false): BadgeDisplayItem[] {
	const items: BadgeDisplayItem[] = []

	const add = (
		key: string,
		label: string,
		valueText: string,
		category: 'buff' | 'debuff' | 'permanent',
		tooltip: string,
	) => {
		items.push({key, label, valueText, category, tooltip})
	}

	// Permanent / Turn-scaling powers
	if (powers.strength && powers.strength !== 0) {
		add(
			'strength',
			'STR',
			powers.strength > 0 ? `+${powers.strength}` : `${powers.strength}`,
			powers.strength > 0 ? 'buff' : 'debuff',
			`Strength: ${powers.strength > 0 ? '+' : ''}${powers.strength} damage on every hit.`,
		)
	}
	if (powers.tempStrength && powers.tempStrength > 0) {
		add(
			'tempStrength',
			'FLEX',
			`+${powers.tempStrength}`,
			'buff',
			`Temporary Strength: +${powers.tempStrength} damage this turn.`,
		)
	}
	if (powers.demonForm && powers.demonForm > 0) {
		add(
			'demonForm',
			'DEMON',
			`+${powers.demonForm}/t`,
			'permanent',
			`Demon Form (P): Gain +${powers.demonForm} Strength at the start of each turn.`,
		)
	}
	if (powers.metallicize && powers.metallicize > 0) {
		add(
			'metallicize',
			'METAL',
			`+${powers.metallicize}`,
			'permanent',
			`Metallicize (P): Gain ${powers.metallicize} Block at the end of each turn.`,
		)
	}
	if (powers.barricade && powers.barricade > 0) {
		add('barricade', 'BARRICADE', 'P', 'permanent', 'Barricade (P): Block is not removed at the start of your turn.')
	}
	if (powers.barricadeOneTurn && powers.barricadeOneTurn > 0) {
		add('barricadeOneTurn', 'BLUR', '1T', 'buff', 'Blur: Block is not removed at the start of your next turn.')
	}
	if (powers.juggernaut && powers.juggernaut > 0) {
		add(
			'juggernaut',
			'JUGG',
			`${powers.juggernaut}`,
			'permanent',
			`Juggernaut (P): Whenever you gain Block, deal ${powers.juggernaut} damage to the opponent.`,
		)
	}
	if (powers.noxiousFumes && powers.noxiousFumes > 0) {
		add(
			'noxiousFumes',
			'FUMES',
			`+${powers.noxiousFumes}/t`,
			'permanent',
			`Noxious Fumes (P): Apply ${powers.noxiousFumes} Poison to opponent at the start of your turn.`,
		)
	}
	if (powers.envenom && powers.envenom > 0) {
		add(
			'envenom',
			'ENVENOM',
			`+${powers.envenom}`,
			'permanent',
			`Envenom (P): Unblocked damage also applies ${powers.envenom} Poison.`,
		)
	}
	if (powers.envenomOnce && powers.envenomOnce > 0) {
		add(
			'envenomOnce',
			'COAT',
			`+${powers.envenomOnce}`,
			'buff',
			`Venomous Coat: Next unblocked hit applies ${powers.envenomOnce} Poison.`,
		)
	}
	if (powers.selfRepair && powers.selfRepair > 0) {
		add(
			'selfRepair',
			'REPAIR',
			`+${powers.selfRepair}/t`,
			'permanent',
			`Self-Repair (P): Heal ${powers.selfRepair} HP at the end of each of your turns.`,
		)
	}
	if (powers.phoenix && powers.phoenix > 0 && !phoenixUsed) {
		add(
			'phoenix',
			'PHOENIX',
			`${powers.phoenix}%`,
			'permanent',
			`Phoenix: Once this battle, if HP reaches 0, revive at ${powers.phoenix}% Max HP.`,
		)
	}

	// Buffs
	if (powers.ward && powers.ward > 0) {
		add('ward', 'WARD', `${powers.ward}`, 'buff', `Ward: Negates the next ${powers.ward} debuff(s) applied to you.`)
	}
	if (powers.reflect && powers.reflect > 0) {
		add(
			'reflect',
			'REFLECT',
			`${powers.reflect}%`,
			'buff',
			`Mirror Calculus: Reflects ${powers.reflect}% of damage taken back to the attacker until your next turn.`,
		)
	}
	if (powers.apparition && powers.apparition > 0) {
		add(
			'apparition',
			'APPARITION',
			'1 HP',
			'buff',
			'Apparition: Any single hit or HP loss taken until your next turn is reduced to 1.',
		)
	}
	if (powers.doubleTap && powers.doubleTap > 0) {
		add(
			'doubleTap',
			'2X TAP',
			`${powers.doubleTap}`,
			'buff',
			'Double Tap: Your next Maths attack card this turn plays twice.',
		)
	}
	if (powers.regenRounds && powers.regenRounds > 0 && powers.regenAmount) {
		add(
			'regen',
			'REGEN',
			`+${powers.regenAmount} (${powers.regenRounds}r)`,
			'buff',
			`Regen: Heal ${powers.regenAmount} HP at the start of your turn for ${powers.regenRounds} round(s).`,
		)
	}
	if (powers.nextTurnHeal && powers.nextTurnHeal > 0) {
		add(
			'nextTurnHeal',
			'HIBERNATE',
			`+${powers.nextTurnHeal}`,
			'buff',
			`Hibernate: Heal ${powers.nextTurnHeal} HP at the start of your next turn.`,
		)
	}
	if (powers.nextTurnExtraMana && powers.nextTurnExtraMana > 0) {
		add(
			'nextTurnExtraMana',
			'CHARGE',
			`+${powers.nextTurnExtraMana}M`,
			'buff',
			`Next Turn Mana: Gain +${powers.nextTurnExtraMana} Mana at the start of your next turn.`,
		)
	}
	if (powers.stunImmune && powers.stunImmune > 0) {
		add(
			'stunImmune',
			'STUN-IMM',
			`${powers.stunImmune}r`,
			'buff',
			`Stun Immune: Cannot be stunned for ${powers.stunImmune} round(s).`,
		)
	}

	// Debuffs
	if (powers.poison && powers.poison > 0) {
		add(
			'poison',
			'POISON',
			`${powers.poison}`,
			'debuff',
			`Poison: Lose ${powers.poison} HP at turn start, then Poison decreases by 1.`,
		)
	}
	if (powers.parasite && powers.parasite > 0) {
		add(
			'parasite',
			'PARASITE',
			`${powers.parasite}↑`,
			'debuff',
			`Parasite: Lose ${powers.parasite} HP at turn start, then Parasite increases by 1! Only a Cure removes it.`,
		)
	}
	if (powers.weak && powers.weak > 0) {
		add('weak', 'WEAK', `${powers.weak}r`, 'debuff', `Weak: Deal 25% less damage for ${powers.weak} round(s).`)
	}
	if (powers.vulnerable && powers.vulnerable > 0) {
		add(
			'vulnerable',
			'VULN',
			`${powers.vulnerable}r`,
			'debuff',
			`Vulnerable: Take 50% more damage for ${powers.vulnerable} round(s).`,
		)
	}
	if (powers.corrode && powers.corrode > 0) {
		add(
			'corrode',
			'CORRODE',
			`${powers.corrode}r`,
			'debuff',
			`Corrode: Gain 25% less Block for ${powers.corrode} round(s).`,
		)
	}
	if (powers.antiHeal && powers.antiHeal > 0) {
		add(
			'antiHeal',
			'ANTI-HEAL',
			`${powers.antiHeal}r`,
			'debuff',
			`Anti-heal: Heal 50% less for ${powers.antiHeal} round(s).`,
		)
	}
	if (powers.noLifeSteal && powers.noLifeSteal > 0) {
		add(
			'noLifeSteal',
			'NO-STEAL',
			`${powers.noLifeSteal}r`,
			'debuff',
			`Hemostasis: Life steal heals 0 HP for ${powers.noLifeSteal} round(s).`,
		)
	}
	if (powers.stun && powers.stun > 0) {
		add('stun', 'STUNNED', '1T', 'debuff', 'Stunned: Your next turn will be skipped!')
	}

	return items
}

export function StatusBadges({powers, phoenixUsed = false, align = 'left'}: StatusBadgesProps) {
	const {lang, isBangla} = useLanguage()
	const badges = collectActiveBadges(powers, phoenixUsed)
	const [hoveredKey, setHoveredKey] = useState<string | null>(null)
	const [pinnedKey, setPinnedKey] = useState<string | null>(null)
	const containerRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		if (!pinnedKey) return
		const handlePointerDown = (e: PointerEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setPinnedKey(null)
			}
		}
		window.addEventListener('pointerdown', handlePointerDown)
		return () => window.removeEventListener('pointerdown', handlePointerDown)
	}, [pinnedKey])

	if (badges.length === 0) {
		return (
			<div className="min-h-[26px] font-mono text-[11px] text-slate-400">
				{isBangla ? 'কোনো সক্রিয় স্ট্যাটাস ইফেক্ট নেই' : 'No active status effects'}
			</div>
		)
	}

	const activeTooltipKey = pinnedKey ?? hoveredKey

	return (
		<div
			ref={containerRef}
			className={`flex min-h-[26px] flex-wrap items-center gap-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
		>
			{badges.map((b) => {
				const slotClass =
					b.category === 'debuff'
						? 'flat-slot-orange text-white'
						: b.category === 'permanent'
							? 'flat-slot-gold text-[#141824]'
							: 'flat-slot-blue text-white'

				const isTooltipOpen = activeTooltipKey === b.key
				const categoryBadgeClass =
					b.category === 'debuff'
						? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
						: b.category === 'permanent'
							? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
							: 'bg-sky-500/20 text-sky-300 border-sky-500/40'

				return (
					<div
						key={b.key}
						className="relative inline-flex"
						onMouseEnter={() => setHoveredKey(b.key)}
						onMouseLeave={() => setHoveredKey((prev) => (prev === b.key ? null : prev))}
					>
						<button
							type="button"
							onClick={() => setPinnedKey((prev) => (prev === b.key ? null : b.key))}
							aria-expanded={isTooltipOpen}
							className={`inline-flex cursor-pointer items-center gap-1 px-1.5 py-0.5 font-pixel text-[10px] select-none transition-transform hover:brightness-110 active:translate-y-px ${slotClass}`}
						>
							<span>{b.label}</span>
							<span className="font-mono text-[10px] font-bold">{b.valueText}</span>
						</button>

						{isTooltipOpen && (
							<div
								role="tooltip"
								className={`pointer-events-none absolute top-full z-50 mt-1.5 w-56 rounded border border-slate-600 bg-slate-950/95 p-2.5 text-left shadow-2xl ${
									align === 'right' ? 'right-0' : 'left-0'
								}`}
							>
								<div className="mb-1 flex items-center justify-between gap-2">
									<span className="font-pixel text-[10px] text-white">
										{b.label} ({b.valueText})
									</span>
									<span
										className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${categoryBadgeClass}`}
									>
										{b.category}
									</span>
								</div>
								<p className="font-sans text-[11px] leading-snug text-slate-200">
									{translateStatusTooltip(b.key, powers, b.tooltip, lang)}
								</p>
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}
