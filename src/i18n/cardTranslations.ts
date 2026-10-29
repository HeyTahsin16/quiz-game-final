import {ensureEnglishDigits, type Language} from './types'

/**
 * Translates card middle description text (base, upgraded, live dynamic preview with *, and reducedText)
 * into Bangla while keeping all numbers in English (0-9) and preserving English technical terms where appropriate.
 */
const EXACT_CARD_TEXT_BN: Record<string, string> = {
	// Reduced texts (Epic & Legendary)
	'The replayed card deals 35% damage.': 'পুনরায় খেলা কার্ডটি 35% ড্যামেজ দেয়।',
	'Gain 1 Strength per turn.': 'প্রতি টার্নে 1 Strength পান।',
	'Block is kept for one turn only.': 'Block শুধুমাত্র 1 টার্নের জন্য বজায় থাকে।',
	'Upgrade only the cards in your hand.': 'শুধুমাত্র আপনার হাতের কার্ডগুলো আপগ্রেড করুন।',
	'Apply 1 Weak and 1 Vulnerable.': '1 Weak এবং 1 Vulnerable প্রয়োগ করুন।',
	'Applies Poison once only, on the next unblocked hit.': 'পরবর্তী আনব্লকড আঘাতে শুধুমাত্র একবার Poison প্রয়োগ করে।',
	'Steal 1 mana.': '1 মানা চুরি করুন।',
	'The opponent loses 2 mana instead of being stunned.': 'প্রতিপক্ষ Stun হওয়ার বদলে 2 মানা হারায়।',
	'Apply 2 Poison, no burst.': '2 Poison প্রয়োগ করুন, কোনো বার্স্ট নেই।',
	'Apply 2 Poison, 1 Parasite and 1 Anti-heal.': '2 Poison, 1 Parasite এবং 1 Anti-heal প্রয়োগ করুন।',
	'Damage you take is halved instead of reduced to 1.': 'আপনার নেওয়া ড্যামেজ 1-এ নামার বদলে অর্ধেক হয়।',
	'Cure your debuffs and gain 1 Ward.': 'আপনার সব ডিবফ নিরাময় করুন এবং 1 Ward পান।',
	'Lasts 1 round.': '1 রাউন্ড স্থায়ী হয়।',
	'Revive with 10% max HP.': '10% সর্বোচ্চ HP নিয়ে পুনরুজ্জীবিত হোন।',
	'Heal 10, no cure.': '10 HP হিল করুন, কোনো নিরাময় নেই।',

	// Signature preview special text
	'Deal 32 (40 with Samurai Maths Affinity!).': '32 ড্যামেজ দিন (Samurai Maths Affinity সহ 40!)।',
	'Once this battle, if your HP would reach 0, revive with 30% max HP.':
		'এই যুদ্ধে একবার, আপনার HP 0-তে পৌঁছালে 30% সর্বোচ্চ HP নিয়ে পুনরুজ্জীবিত হোন।',

	// Fixed non-numeric or special card texts
	'Deal damage equal to your Block.': 'আপনার Block-এর সমান ড্যামেজ দিন।',
	'Double your Block.': 'আপনার Block দ্বিগুণ করুন।',
	'Double your mana (max 5). Exhaust.': 'আপনার মানা দ্বিগুণ করুন (সর্বোচ্চ 5)। Exhaust.',
	'Your Block is no longer removed at the start of your turn. (P)':
		'আপনার টার্নের শুরুতে আপনার Block আর মুছে যাবে না। (P)',
	'Upgrade every card in your deck for the rest of the battle. Exhaust.':
		'বাকি যুদ্ধের জন্য আপনার ডেকের প্রতিটি কার্ড আপগ্রেড করুন। Exhaust.',
	'This turn, your next maths card is played twice.': 'এই টার্নে আপনার পরবর্তী গণিত কার্ডটি দুইবার খেলা হবে।',
	"Double the opponent's Poison. Exhaust.": 'প্রতিপক্ষের Poison দ্বিগুণ করুন। Exhaust.',
	'Whenever one of your cards deals unblocked damage, apply 1 Poison. (P)':
		'যখনই আপনার কোনো কার্ড আনব্লকড ড্যামেজ দেয়, 1 Poison প্রয়োগ করুন। (P)',
	'Stun the opponent. Exhaust.': 'প্রতিপক্ষকে Stun করুন। Exhaust.',
	'Cure your Poison and Parasite.': 'আপনার Poison এবং Parasite নিরাময় করুন।',
	'Cure your Poison, Parasite and Weak.': 'আপনার Poison, Parasite এবং Weak নিরাময় করুন।',
	'Cure your Weak, Vulnerable and Corrode.': 'আপনার Weak, Vulnerable এবং Corrode নিরাময় করুন।',
	'Until the start of your next turn, any single hit or HP loss you take is reduced to 1. Exhaust.':
		'আপনার পরবর্তী টার্নের শুরু পর্যন্ত, যেকোনো একক আঘাত বা HP ক্ষতি কমে 1 হবে। Exhaust.',
	'Once this battle, if your HP would reach 0, revive with 30% max HP. It stays active until used. Exhaust.':
		'এই যুদ্ধে একবার, আপনার HP 0 হলে 30% সর্বোচ্চ HP নিয়ে পুনরুজ্জীবিত হোন। ব্যবহার না হওয়া পর্যন্ত সক্রিয় থাকে। Exhaust.',
}

const PATTERN_RULES: Array<[RegExp, (...args: string[]) => string]> = [
	// Body Slam live preview suffix: "Deal damage equal to your Block. (Deals 12*)"
	[
		/^Deal damage equal to your Block\. \(Deals ([^)]+)\)$/,
		(_m, dmg) => `আপনার Block-এর সমান ড্যামেজ দিন। (${dmg} ড্যামেজ দেয়)`,
	],
	// Strike / Cleave / Carnage / Bludgeon: "Deal 6." or "Deal 8* (6)."
	[/^Deal ([0-9*() ]+)\.$/, (_m, dmg) => `${dmg} ড্যামেজ দিন।`],
	// Twin Strike: "Deal 5 twice." or "Deal 7* (5) twice."
	[/^Deal ([0-9*() ]+) twice\.$/, (_m, dmg) => `${dmg} ড্যামেজ দুইবার দিন।`],
	// Sword Boomerang: "Deal 3 three times."
	[/^Deal ([0-9*() ]+) three times\.$/, (_m, dmg) => `${dmg} ড্যামেজ তিনবার দিন।`],
	// Pummel: "Deal 2 four times. Exhaust."
	[/^Deal ([0-9*() ]+) four times\. Exhaust\.$/, (_m, dmg) => `${dmg} ড্যামেজ চারবার দিন। Exhaust.`],
	// Pommel Strike: "Deal 9. Draw 1."
	[/^Deal ([0-9*() ]+)\. Draw (\d+)\.$/, (_m, dmg, draw) => `${dmg} ড্যামেজ দিন। ${draw}টি কার্ড তুলুন।`],
	// Heavy Blade: "Deal 14. Strength counts 3 times."
	[
		/^Deal ([0-9*() ]+)\. Strength counts (\d+) times\.$/,
		(_m, dmg, mult) => `${dmg} ড্যামেজ দিন। Strength ${mult} গুণ হিসেবে গণনা হয়।`,
	],
	// Anger: "Deal 6. Add a copy of this card to your discard pile."
	[
		/^Deal ([0-9*() ]+)\. Add a copy of this card to your discard pile\.$/,
		(_m, dmg) => `${dmg} ড্যামেজ দিন। এই কার্ডের 1টি কপি আপনার ডিসকার্ড পাইলে যোগ করুন।`,
	],
	// Clash: "Playable only if every card in your hand is a maths card. Deal 14."
	[
		/^Playable only if every card in your hand is a maths card\. Deal ([0-9*() ]+)\.$/,
		(_m, dmg) => `হাতের প্রতিটি কার্ড গণিত কার্ড হলেই কেবল খেলা যাবে। ${dmg} ড্যামেজ দিন।`,
	],
	// Rampage: "Deal 8. This card deals 5 more each time it is played this battle."
	[
		/^Deal ([0-9*() ]+)\. This card deals (\d+) more each time it is played this battle\.$/,
		(_m, dmg, inc) => `${dmg} ড্যামেজ দিন। এই যুদ্ধে যতবার এটি খেলা হবে ততবার ${inc} বেশি ড্যামেজ দেবে।`,
	],
	// Sever Soul: "Exhaust every non-maths card in your hand. Deal 16."
	[
		/^Exhaust every non-maths card in your hand\. Deal ([0-9*() ]+)\.$/,
		(_m, dmg) => `আপনার হাতের সব অ-গণিত কার্ড Exhaust করুন। ${dmg} ড্যামেজ দিন।`,
	],
	// Hemokinesis: "Lose 2 HP. Deal 15."
	[/^Lose (\d+) HP\. Deal ([0-9*() ]+)\.$/, (_m, hp, dmg) => `${hp} HP হারান। ${dmg} ড্যামেজ দিন।`],
	// Inflame: "Gain 2 Strength. (P)"
	[/^Gain (\d+) Strength\. \(P\)$/, (_m, amt) => `${amt} Strength পান। (P)`],
	// Demon Form: "At the start of each of your turns gain 2 Strength. (P)"
	[
		/^At the start of each of your turns gain (\d+) Strength\. \(P\)$/,
		(_m, amt) => `আপনার প্রতিটি টার্নের শুরুতে ${amt} Strength পান। (P)`,
	],
	// Reaper: "Deal 10. Life steal 100%. Exhaust."
	[
		/^Deal ([0-9*() ]+)\. Life steal (\d+)%\. Exhaust\.$/,
		(_m, dmg, pct) => `${dmg} ড্যামেজ দিন। ${pct}% Life steal। Exhaust.`,
	],
	// Flame Barrier: "Until your next turn, reflect 60% of the damage you take."
	[
		/^Until your next turn, reflect (\d+)% of the damage you take\.$/,
		(_m, pct) => `আপনার পরবর্তী টার্ন পর্যন্ত আপনার নেওয়া ড্যামেজের ${pct}% প্রতিফলিত করুন।`,
	],
	// Feed: "Deal 14. Life steal 50%. Raise your max HP by 4. Exhaust."
	[
		/^Deal ([0-9*() ]+)\. Life steal (\d+)%\. Raise your max HP by (\d+)\. Exhaust\.$/,
		(_m, dmg, pct, hp) => `${dmg} ড্যামেজ দিন। ${pct}% Life steal। আপনার সর্বোচ্চ HP ${hp} বাড়ান। Exhaust.`,
	],
	// Defend: "Gain 5 Block." or "Gain 4* (5) Block."
	[/^Gain ([0-9*() ]+) Block\.$/, (_m, blk) => `${blk} Block পান।`],
	// Impervious: "Gain 30 Block. Exhaust."
	[/^Gain ([0-9*() ]+) Block\. Exhaust\.$/, (_m, blk) => `${blk} Block পান। Exhaust.`],
	// Shrug It Off: "Gain 8 Block. Draw 1."
	[/^Gain ([0-9*() ]+) Block\. Draw (\d+)\.$/, (_m, blk, draw) => `${blk} Block পান। ${draw}টি কার্ড তুলুন।`],
	// Iron Wave: "Gain 5 Block. Deal 5."
	[/^Gain ([0-9*() ]+) Block\. Deal ([0-9*() ]+)\.$/, (_m, blk, dmg) => `${blk} Block পান। ${dmg} ড্যামেজ দিন।`],
	// Armaments: "Gain 5 Block. Upgrade one card in your hand for the rest of the battle."
	[
		/^Gain ([0-9*() ]+) Block\. Upgrade one card in your hand for the rest of the battle\.$/,
		(_m, blk) => `${blk} Block পান। বাকি যুদ্ধের জন্য আপনার হাতের 1টি কার্ড আপগ্রেড করুন।`,
	],
	// Charge Battery: "Gain 7 Block. Next turn gain 1 extra mana."
	[
		/^Gain ([0-9*() ]+) Block\. Next turn gain (\d+) extra mana\.$/,
		(_m, blk, mana) => `${blk} Block পান। পরের টার্নে ${mana} অতিরিক্ত মানা পান।`,
	],
	// True Grit: "Gain 7 Block. Exhaust 1 random card from your hand."
	[
		/^Gain ([0-9*() ]+) Block\. Exhaust (\d+) random card from your hand\.$/,
		(_m, blk, cnt) => `${blk} Block পান। আপনার হাত থেকে র‍্যান্ডম ${cnt}টি কার্ড Exhaust করুন।`,
	],
	// Flex: "Gain 2 Strength until the end of this turn."
	[
		/^Gain (\d+) Strength until the end of this turn\.$/,
		(_m, str) => `এই টার্নের শেষ পর্যন্ত ${str} Strength পান।`,
	],
	// Melter / Hyperbeam: "Remove all of the opponent's Block. Deal 10."
	[
		/^Remove all of the opponent's Block\. Deal ([0-9*() ]+)\.$/,
		(_m, dmg) => `প্রতিপক্ষের সমস্ত Block সরিয়ে দিন। ${dmg} ড্যামেজ দিন।`,
	],
	// Metallicize: "At the end of each of your turns gain 3 Block. (P)"
	[
		/^At the end of each of your turns gain (\d+) Block\. \(P\)$/,
		(_m, blk) => `আপনার প্রতিটি টার্নের শেষে ${blk} Block পান। (P)`,
	],
	// Seeing Red: "Gain 2 mana. Exhaust."
	[/^Gain (\d+) mana\. Exhaust\.$/, (_m, mana) => `${mana} মানা পান। Exhaust.`],
	// Auto-Shields: "If you have no Block, gain 11 Block."
	[
		/^If you have no Block, gain ([0-9*() ]+) Block\.$/,
		(_m, blk) => `আপনার কোনো Block না থাকলে ${blk} Block পান।`,
	],
	// Juggernaut: "Whenever you gain Block, deal 5 to the opponent. (P)"
	[
		/^Whenever you gain Block, deal (\d+) to the opponent\. \(P\)$/,
		(_m, dmg) => `যখনই আপনি Block পাবেন, প্রতিপক্ষকে ${dmg} ড্যামেজ দিন। (P)`,
	],
	// Offering: "Lose 6 HP. Gain 2 mana. Draw 3. Exhaust."
	[
		/^Lose (\d+) HP\. Gain (\d+) mana\. Draw (\d+)\. Exhaust\.$/,
		(_m, hp, mana, draw) => `${hp} HP হারান। ${mana} মানা পান। ${draw}টি কার্ড তুলুন। Exhaust.`,
	],
	// Deadly Poison: "Apply 5 Poison."
	[/^Apply (\d+) Poison\.$/, (_m, p) => `${p} Poison প্রয়োগ করুন।`],
	// Poisoned Stab: "Apply 3 Poison and 1 Weak."
	[/^Apply (\d+) Poison and (\d+) Weak\.$/, (_m, p, w) => `${p} Poison এবং ${w} Weak প্রয়োগ করুন।`],
	// Crippling Cloud: "Apply 4 Poison and 2 Weak. Exhaust."
	[/^Apply (\d+) Poison and (\d+) Weak\. Exhaust\.$/, (_m, p, w) => `${p} Poison এবং ${w} Weak প্রয়োগ করুন। Exhaust.`],
	// Neutralize: "Apply 2 Weak."
	[/^Apply (\d+) Weak\.$/, (_m, w) => `${w} Weak প্রয়োগ করুন।`],
	// Sucker Punch: "Apply 1 Weak and 1 Vulnerable."
	[/^Apply (\d+) Weak and (\d+) Vulnerable\.$/, (_m, w, v) => `${w} Weak এবং ${v} Vulnerable প্রয়োগ করুন।`],
	// Shockwave: "Apply 3 Weak and 3 Vulnerable. Exhaust."
	[
		/^Apply (\d+) Weak and (\d+) Vulnerable\. Exhaust\.$/,
		(_m, w, v) => `${w} Weak এবং ${v} Vulnerable প্রয়োগ করুন। Exhaust.`,
	],
	// Piercing Wail: "The opponent gets -3 Strength until the end of its next turn. Exhaust."
	[
		/^The opponent gets -(\d+) Strength until the end of its next turn\. Exhaust\.$/,
		(_m, s) => `প্রতিপক্ষ তার পরবর্তী টার্নের শেষ পর্যন্ত -${s} Strength পায়। Exhaust.`,
	],
	// Bane: "Apply 3 Poison; apply 7 instead if the opponent already has Poison."
	[
		/^Apply (\d+) Poison; apply (\d+) instead if the opponent already has Poison\.$/,
		(_m, b, p) => `${b} Poison প্রয়োগ করুন; প্রতিপক্ষের আগে থেকেই Poison থাকলে তার বদলে ${p} প্রয়োগ করুন।`,
	],
	// Acid Splash: "Apply 2 Corrode and 2 Poison."
	[/^Apply (\d+) Corrode and (\d+) Poison\.$/, (_m, c, p) => `${c} Corrode এবং ${p} Poison প্রয়োগ করুন।`],
	// Siphon / Osmosis: "Steal 1 mana." / "Steal 2 mana. Exhaust."
	[/^Steal (\d+) mana\.$/, (_m, m) => `${m} মানা চুরি করুন।`],
	[/^Steal (\d+) mana\. Exhaust\.$/, (_m, m) => `${m} মানা চুরি করুন। Exhaust.`],
	// Noxious Fumes: "At the start of each of your turns apply 2 Poison. (P)"
	[
		/^At the start of each of your turns apply (\d+) Poison\. \(P\)$/,
		(_m, p) => `আপনার প্রতিটি টার্নের শুরুতে ${p} Poison প্রয়োগ করুন। (P)`,
	],
	// Bouncing Flask: "Apply 3 Poison three times."
	[/^Apply (\d+) Poison three times\.$/, (_m, p) => `${p} Poison তিনবার প্রয়োগ করুন।`],
	// Tapeworm: "Apply 2 Parasite."
	[/^Apply (\d+) Parasite\.$/, (_m, p) => `${p} Parasite প্রয়োগ করুন।`],
	// Necrotoxin: "Apply 3 Poison and 3 Anti-heal."
	[/^Apply (\d+) Poison and (\d+) Anti-heal\.$/, (_m, p, a) => `${p} Poison এবং ${a} Anti-heal প্রয়োগ করুন।`],
	// Corpse Explosion: "Apply 6 Poison, then Poison burst. Exhaust."
	[
		/^Apply (\d+) Poison, then Poison burst\. Exhaust\.$/,
		(_m, p) => `${p} Poison প্রয়োগ করুন, তারপর Poison বার্স্ট করুন। Exhaust.`,
	],
	// Plague: "Apply 5 Poison, 3 Parasite and 3 Anti-heal. Exhaust."
	[
		/^Apply (\d+) Poison, (\d+) Parasite and (\d+) Anti-heal\. Exhaust\.$/,
		(_m, p, par, a) => `${p} Poison, ${par} Parasite এবং ${a} Anti-heal প্রয়োগ করুন। Exhaust.`,
	],
	// Bandage Up: "Heal 4. Exhaust."
	[/^Heal ([0-9*() ]+)\. Exhaust\.$/, (_m, h) => `${h} HP হিল করুন। Exhaust.`],
	// Panacea: "Gain 1 Ward. Exhaust."
	[/^Gain (\d+) Ward\. Exhaust\.$/, (_m, w) => `${w} Ward পান। Exhaust.`],
	// Photosynthesis / Healthy Meal / Transfusion: "Heal 5."
	[/^Heal ([0-9*() ]+)\.$/, (_m, h) => `${h} HP হিল করুন।`],
	// Mitosis: "Heal 3. Add a copy of this card to your discard pile."
	[
		/^Heal ([0-9*() ]+)\. Add a copy of this card to your discard pile\.$/,
		(_m, h) => `${h} HP হিল করুন। এই কার্ডের 1টি কপি আপনার ডিসকার্ড পাইলে যোগ করুন।`,
	],
	// Scab: "Heal 3 now and 3 at the start of your next turn."
	[
		/^Heal ([0-9*() ]+) now and (\d+) at the start of your next turn\.$/,
		(_m, h1, h2) => `এখন ${h1} HP এবং আপনার পরবর্তী টার্নের শুরুতে ${h2} HP হিল করুন।`,
	],
	// Self Repair: "At the start of each of your turns heal 3. (P)"
	[
		/^At the start of each of your turns heal (\d+)\. \(P\)$/,
		(_m, h) => `আপনার প্রতিটি টার্নের শুরুতে ${h} HP হিল করুন। (P)`,
	],
	// Genetic Algorithm: "Heal 2. This card heals 2 more each time it is played this battle."
	[
		/^Heal ([0-9*() ]+)\. This card heals (\d+) more each time it is played this battle\.$/,
		(_m, h, inc) => `${h} HP হিল করুন। এই যুদ্ধে যতবার এটি খেলা হবে ততবার ${inc} বেশি হিল করবে।`,
	],
	// Regeneration: "Regen 3 for 4 rounds."
	[/^Regen (\d+) for (\d+) rounds\.$/, (_m, amt, r) => `${r} রাউন্ডের জন্য প্রতি টার্নে ${amt} Regen পান।`],
	// Metabolism: "Heal 4. Draw 1."
	[/^Heal ([0-9*() ]+)\. Draw (\d+)\.$/, (_m, h, d) => `${h} HP হিল করুন। ${d}টি কার্ড তুলুন।`],
	// Growth Spurt: "Heal 6. Raise your max HP by 4."
	[
		/^Heal ([0-9*() ]+)\. Raise your max HP by (\d+)\.$/,
		(_m, h, m) => `${h} HP হিল করুন। আপনার সর্বোচ্চ HP ${m} বাড়ান।`,
	],
	// Quarantine: "Cure all your debuffs and gain 3 Ward. Exhaust."
	[
		/^Cure all your debuffs and gain (\d+) Ward\. Exhaust\.$/,
		(_m, w) => `আপনার সমস্ত ডিবফ নিরাময় করুন এবং ${w} Ward পান। Exhaust.`,
	],
	// Anticoagulant: "Apply 4 Anti-heal."
	[/^Apply (\d+) Anti-heal\.$/, (_m, a) => `${a} Anti-heal প্রয়োগ করুন।`],
	// Hemostasis: "For 3 rounds the opponent's life steal heals nothing."
	[
		/^For (\d+) rounds the opponent's life steal heals nothing\.$/,
		(_m, r) => `${r} রাউন্ডের জন্য প্রতিপক্ষের Life steal কোনো হিল করবে না।`,
	],
	// Elixir of Life: "Heal 30. Cure all your debuffs. Exhaust."
	[
		/^Heal ([0-9*() ]+)\. Cure all your debuffs\. Exhaust\.$/,
		(_m, h) => `${h} HP হিল করুন। আপনার সমস্ত ডিবফ নিরাময় করুন। Exhaust.`,
	],
]

export function translateCardText(text: string, lang: Language): string {
	if (lang === 'en' || !text) return text

	const trimmed = text.trim()
	const exact = EXACT_CARD_TEXT_BN[trimmed]
	if (exact) {
		return ensureEnglishDigits(exact)
	}

	for (const [regex, replacer] of PATTERN_RULES) {
		if (regex.test(trimmed)) {
			return ensureEnglishDigits(trimmed.replace(regex, replacer))
		}
	}

	return ensureEnglishDigits(text)
}
