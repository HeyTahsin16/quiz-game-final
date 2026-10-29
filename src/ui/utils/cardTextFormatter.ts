import type {GameState, PlayerIndex} from '../../engine/actions'
import {type CardInstance, previewCardDamage} from '../../engine/cards'

/**
 * Formats a card's description text to display live matchup numbers (as Slay the Spire does),
 * taking into account attacker/defender subject affinities, Strength, Weak, Vulnerable,
 * Corrode (on Block), Anti-heal (on Heal), Rampage scaling, Genetic Algorithm scaling, and Body Slam block.
 */
export function formatLiveCardText(card: CardInstance, state: GameState, casterIndex: PlayerIndex): string {
	const defenderIndex: PlayerIndex = casterIndex === 0 ? 1 : 0
	const caster = state.players[casterIndex]
	const defender = state.players[defenderIndex]

	let text = card.text

	for (const effect of card.effects) {
		if (effect.type === 'damage') {
			const base = effect.amount
			const mult = effect.strengthMultiplier ?? 1
			const finalDmg = previewCardDamage(
				base,
				card.subject,
				caster.characterId,
				defender.characterId,
				caster.powers,
				defender.powers,
				mult,
				1,
			)
			if (finalDmg !== base) {
				text = text.replace(new RegExp(`Deal ${base}\\b`), `Deal ${finalDmg}* (${base})`)
			}
		} else if (effect.type === 'rampageDamage') {
			const plays = state.rampageCounts[card.instanceId] || 0
			const currentBase = effect.base + plays * effect.increment
			const finalDmg = previewCardDamage(
				currentBase,
				card.subject,
				caster.characterId,
				defender.characterId,
				caster.powers,
				defender.powers,
				1,
				1,
			)
			if (finalDmg !== effect.base) {
				text = text.replace(new RegExp(`Deal ${effect.base}\\b`), `Deal ${finalDmg}* (${effect.base})`)
			}
		} else if (effect.type === 'damageEqualToBlock') {
			const currentBlock = caster.block
			const finalDmg =
				currentBlock > 0
					? previewCardDamage(
							currentBlock,
							card.subject,
							caster.characterId,
							defender.characterId,
							caster.powers,
							defender.powers,
							1,
							1,
						)
					: 0
			text = `${text} (Deals ${finalDmg}*)`
		} else if (effect.type === 'block' || effect.type === 'conditionalNoBlock') {
			const baseBlock = effect.amount
			const finalBlock = (caster.powers.corrode || 0) > 0 ? Math.round(baseBlock * 0.75) : baseBlock
			if (finalBlock !== baseBlock) {
				text = text.replace(new RegExp(`Gain ${baseBlock} Block`), `Gain ${finalBlock}* (${baseBlock}) Block`)
			}
		} else if (effect.type === 'heal') {
			const baseHeal = effect.amount
			const finalHeal = (caster.powers.antiHeal || 0) > 0 ? Math.round(baseHeal * 0.5) : baseHeal
			if (finalHeal !== baseHeal) {
				text = text.replace(new RegExp(`Heal ${baseHeal}\\b`), `Heal ${finalHeal}* (${baseHeal})`)
			}
		} else if (effect.type === 'geneticHeal') {
			const plays = state.geneticCounts[card.instanceId] || 0
			const currentBase = effect.base + plays * effect.increment
			const finalHeal = (caster.powers.antiHeal || 0) > 0 ? Math.round(currentBase * 0.5) : currentBase
			if (finalHeal !== effect.base) {
				text = text.replace(new RegExp(`Heal ${effect.base}\\b`), `Heal ${finalHeal}* (${effect.base})`)
			}
		}
	}

	return text
}
