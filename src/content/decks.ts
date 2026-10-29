/**
 * Quiz Duel — Fixed 24-Card Character Decks (Section 4)
 * Derived in structure from oskarrough/slaytheweb (src/content/decks.js)
 * License: AGPL-3.0-or-later (port-with-attribution)
 *
 * Recipe per character (Section 4 & 8):
 * - Total: 24 un-upgraded base cards
 * - Subject mix: 10 Affinity, 2 Weakness, 6 Neutral A, 6 Neutral B
 * - Rarity mix: 10 Normal (<=3 copies each), 8 Uncommon (<=2 copies each), 4 Epic (unique), 2 Legendary (unique)
 */

import {type CardInstance, createCard} from '../engine/cards'
import type {CharacterId} from '../engine/config'

export interface CharacterDeckRecipe {
	characterId: CharacterId
	name: string
	cardIds: string[]
}

export const CHARACTER_DECKS: Record<CharacterId, CharacterDeckRecipe> = {
	// Dark Ninja: Affinity Chemistry (10), Weakness Physics (2), Maths (6), Biology (6)
	// Rarities: 10 Normal, 8 Uncommon, 4 Epic, 2 Legendary
	'dark-ninja': {
		characterId: 'dark-ninja',
		name: 'Alchemical Shadow Deck',
		cardIds: [
			// Chemistry (10): 4 Normal, 3 Uncommon, 2 Epic, 1 Legendary
			'C1',
			'C2',
			'C3',
			'C8', // 4 Normal
			'C9',
			'C12',
			'C13', // 3 Uncommon
			'C15',
			'C17', // 2 Epic
			'C19', // 1 Legendary
			// Physics (2 - Weakness): 2 Normal
			'P1',
			'P2', // 2 Normal
			// Maths (6): 2 Normal, 3 Uncommon, 1 Epic
			'M1',
			'M3', // 2 Normal
			'M9',
			'M10',
			'M11', // 3 Uncommon
			'M17', // 1 Epic
			// Biology (6): 2 Normal, 2 Uncommon, 1 Epic, 1 Legendary
			'B3',
			'B5', // 2 Normal
			'B11',
			'B12', // 2 Uncommon
			'B16', // 1 Epic
			'B20', // 1 Legendary
		],
	},

	// Reaper: Affinity Biology (10), Weakness Maths (2), Physics (6), Chemistry (6)
	// Rarities: 10 Normal, 8 Uncommon, 4 Epic, 2 Legendary
	reaper: {
		characterId: 'reaper',
		name: 'Harvester of Vitality Deck',
		cardIds: [
			// Biology (10): 4 Normal, 3 Uncommon, 2 Epic, 1 Legendary
			'B1',
			'B3',
			'B5',
			'B8', // 4 Normal
			'B9',
			'B11',
			'B13', // 3 Uncommon
			'B15',
			'B16', // 2 Epic
			'B19', // 1 Legendary (Phoenix)
			// Maths (2 - Weakness): 2 Normal
			'M1',
			'M3', // 2 Normal
			// Physics (6): 2 Normal, 3 Uncommon, 1 Epic
			'P1',
			'P2', // 2 Normal
			'P9',
			'P11',
			'P14', // 3 Uncommon
			'P15', // 1 Epic
			// Chemistry (6): 2 Normal, 2 Uncommon, 1 Epic, 1 Legendary
			'C1',
			'C4', // 2 Normal
			'C9',
			'C14', // 2 Uncommon
			'C15', // 1 Epic
			'C20', // 1 Legendary (Plague)
		],
	},

	// Samurai: Affinity Maths (10), Weakness Biology (2), Physics (6), Chemistry (6)
	// Rarities: 10 Normal, 8 Uncommon, 4 Epic, 2 Legendary
	samurai: {
		characterId: 'samurai',
		name: 'Calculus Blade Deck',
		cardIds: [
			// Maths (10): 4 Normal, 3 Uncommon, 2 Epic, 1 Legendary
			'M1',
			'M2',
			'M3',
			'M4', // 4 Normal
			'M9',
			'M10',
			'M14', // 3 Uncommon
			'M15',
			'M18', // 2 Epic
			'M20', // 1 Legendary (Feed)
			// Biology (2 - Weakness): 2 Normal
			'B5',
			'B8', // 2 Normal (Antidote, Healthy Meal)
			// Physics (6): 2 Normal, 3 Uncommon, 1 Legendary
			'P2',
			'P3', // 2 Normal
			'P9',
			'P11',
			'P12', // 3 Uncommon
			'P20', // 1 Legendary (Hyperbeam)
			// Chemistry (6): 2 Normal, 2 Uncommon, 2 Epic
			'C3',
			'C4', // 2 Normal
			'C12',
			'C13', // 2 Uncommon
			'C15',
			'C16', // 2 Epic
		],
	},

	// Knight: Affinity Physics (10), Weakness Chemistry (2), Maths (6), Biology (6)
	// Rarities: 10 Normal, 8 Uncommon, 4 Epic, 2 Legendary
	knight: {
		characterId: 'knight',
		name: 'Kinetic Vanguard Deck',
		cardIds: [
			// Physics (10): 4 Normal, 3 Uncommon, 2 Epic, 1 Legendary
			'P2',
			'P3',
			'P3',
			'P5', // 4 Normal (Shrug It Off, Iron Wave x2, Body Slam)
			'P9',
			'P9',
			'P11', // 3 Uncommon (Melter x2, Metallicize)
			'P16',
			'P17', // 2 Epic (Barricade, Juggernaut)
			'P20', // 1 Legendary (Hyperbeam)
			// Chemistry (2 - Weakness): 2 Normal
			'C1',
			'C4', // 2 Normal (Deadly Poison, Sucker Punch)
			// Maths (6): 2 Normal, 3 Uncommon, 1 Legendary
			'M3',
			'M4', // 2 Normal (Pommel Strike, Heavy Blade)
			'M9',
			'M10',
			'M14', // 3 Uncommon (Carnage, Rampage, Inflame)
			'M20', // 1 Legendary (Feed)
			// Biology (6): 2 Normal, 2 Uncommon, 2 Epic
			'B5',
			'B5', // 2 Normal (Antidote x2)
			'B9',
			'B13', // 2 Uncommon (Self Repair, Transfusion)
			'B15',
			'B16', // 2 Epic (Apparition, Quarantine)
		],
	},
}

/**
 * Builds a fresh 24-card array of CardInstances for the specified character.
 */
export function buildCharacterDeck(characterId: CharacterId, seed = 1337): CardInstance[] {
	const recipe = CHARACTER_DECKS[characterId]
	return recipe.cardIds.map((cardId, idx) => createCard(cardId, false, seed, idx + 1))
}
