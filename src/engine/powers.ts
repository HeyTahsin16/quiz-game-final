/**
 * Quiz Duel — Powers & Status Effects Registry
 * Derived from oskarrough/slaytheweb (src/game/powers.js)
 * License: AGPL-3.0-or-later (port-with-attribution)
 */

export type PowerCategory = 'buff' | 'debuff' | 'permanent'

export interface PowerDefinition {
	key: keyof PlayerPowers
	name: string
	type: PowerCategory
	description: string
	decaysEachRound: boolean
	canBeNegative?: boolean
}

export interface PlayerPowers {
	// Permanent powers (P) — last for the rest of the battle
	strength?: number
	demonForm?: number
	metallicize?: number
	barricade?: number
	juggernaut?: number
	envenom?: number
	noxiousFumes?: number
	selfRepair?: number
	phoenix?: number

	// Round-decaying debuffs (cured by Biology Cure effects)
	weak?: number
	vulnerable?: number
	corrode?: number
	antiHeal?: number
	poison?: number
	parasite?: number
	noLifeSteal?: number
	tempStrengthLoss?: number

	// Round/Turn-bound buffs & special states
	tempStrength?: number
	nextTurnStrengthLoss?: number
	nextTurnExtraMana?: number
	nextTurnHeal?: number
	regenAmount?: number
	regenRounds?: number
	ward?: number
	reflect?: number
	apparition?: number
	doubleTap?: number
	envenomOnce?: number
	barricadeOneTurn?: number
	stun?: number
	stunImmune?: number
}

export const DEBUFF_KEYS: Array<keyof PlayerPowers> = [
	'weak',
	'vulnerable',
	'corrode',
	'antiHeal',
	'poison',
	'parasite',
	'noLifeSteal',
	'tempStrengthLoss',
	'nextTurnStrengthLoss',
	'stun',
]

export const POWER_DEFINITIONS: Record<string, PowerDefinition> = {
	strength: {
		key: 'strength',
		name: 'Strength',
		type: 'buff',
		description: '+N on every damage hit the owner deals, for the rest of the battle. Can be negative.',
		decaysEachRound: false,
		canBeNegative: true,
	},
	weak: {
		key: 'weak',
		name: 'Weak',
		type: 'debuff',
		description: 'Deals 25% less damage for N rounds.',
		decaysEachRound: true,
	},
	vulnerable: {
		key: 'vulnerable',
		name: 'Vulnerable',
		type: 'debuff',
		description: 'Takes 50% more damage for N rounds.',
		decaysEachRound: true,
	},
	poison: {
		key: 'poison',
		name: 'Poison',
		type: 'debuff',
		description: 'At the start of turn loses N HP, then Poison drops by 1.',
		decaysEachRound: false, // ticks and decrements at start of turn
	},
	parasite: {
		key: 'parasite',
		name: 'Parasite',
		type: 'debuff',
		description: 'At the start of turn loses N HP, then Parasite rises by 1. Only a cure removes it.',
		decaysEachRound: false,
	},
	corrode: {
		key: 'corrode',
		name: 'Corrode',
		type: 'debuff',
		description: 'Gains 25% less Block for N rounds.',
		decaysEachRound: true,
	},
	antiHeal: {
		key: 'antiHeal',
		name: 'Anti-heal',
		type: 'debuff',
		description: 'Heals 50% less for N rounds.',
		decaysEachRound: true,
	},
	noLifeSteal: {
		key: 'noLifeSteal',
		name: 'Hemostasis',
		type: 'debuff',
		description: 'Life steal heals nothing for N rounds.',
		decaysEachRound: true,
	},
	stun: {
		key: 'stun',
		name: 'Stun',
		type: 'debuff',
		description: 'Next turn is skipped; then immune to Stun for 2 rounds.',
		decaysEachRound: false,
	},
	stunImmune: {
		key: 'stunImmune',
		name: 'Stun Immune',
		type: 'buff',
		description: 'Immune to Stun for N rounds.',
		decaysEachRound: true,
	},
	regen: {
		key: 'regenRounds',
		name: 'Regen',
		type: 'buff',
		description: 'Heal N at the start of each of your turns for R rounds.',
		decaysEachRound: false,
	},
	ward: {
		key: 'ward',
		name: 'Ward',
		type: 'buff',
		description: 'The next N debuffs applied to you are negated.',
		decaysEachRound: false,
	},
	reflect: {
		key: 'reflect',
		name: 'Reflect',
		type: 'buff',
		description: 'Until your next turn, P% of the damage you take is dealt back to the attacker.',
		decaysEachRound: false,
	},
	apparition: {
		key: 'apparition',
		name: 'Apparition',
		type: 'buff',
		description: 'Until the start of your next turn, any single hit or HP loss you take is reduced to 1.',
		decaysEachRound: false,
	},
	phoenix: {
		key: 'phoenix',
		name: 'Phoenix',
		type: 'permanent',
		description: 'Once this battle, if your HP would reach 0, revive with 30% max HP.',
		decaysEachRound: false,
	},
}

export const powers = {
	regen: {
		...POWER_DEFINITIONS.regen,
		use: (stacks: number) => stacks,
	},
	poison: {
		...POWER_DEFINITIONS.poison,
		use: (stacks: number) => stacks,
	},
	vulnerable: {
		...POWER_DEFINITIONS.vulnerable,
		use: (dmg: number) => Math.round(dmg * 1.5),
	},
	weak: {
		...POWER_DEFINITIONS.weak,
		use: (dmg: number) => Math.round(dmg * 0.75),
	},
	strength: {
		...POWER_DEFINITIONS.strength,
		use: (stacks: number) => stacks,
	},
}

export default powers
