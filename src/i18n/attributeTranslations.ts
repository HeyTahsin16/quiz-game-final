import type {PlayerPowers} from '../engine/powers'
import {ensureEnglishDigits, type Language} from './types'

export const ATTRIBUTE_SUMMARY_BN: Record<string, string> = {
	// Core Card Mechanics & Keywords
	BLOCK:
		'HP হারানোর আগে আগত আক্রমণের ড্যামেজ শোষণ করে। Barricade বা Blur দ্বারা সংরক্ষিত না হলে আপনার পরবর্তী টার্নের শুরুতে এটি 0-তে রিসেট হয়।',
	DRAW:
		'আপনার Draw Pile থেকে হাতে কার্ড তোলে (হাতে সর্বোচ্চ 10টি কার্ড)। Draw Pile খালি হলে আপনার Discard Pile স্বয়ংক্রিয়ভাবে শাফল হয়ে নতুন Draw Pile তৈরি করে।',
	EXHAUST:
		'কার্ডটি কার্যকর হওয়ার পর Discard Pile-এ যাওয়ার পরিবর্তে বাকি যুদ্ধের জন্য Exhaust Pile-এ চলে যায়।',
	'POWER (P)':
		'বাকি দ্বন্দ্বযুদ্ধের জন্য একটি স্থায়ী প্যাসিভ ক্ষমতা প্রদান করে। Power কার্ডগুলো খেলার পর কার্যকর হয় এবং স্বয়ংক্রিয়ভাবে Exhaust হয়ে যায়।',
	'UPGRADE (+)':
		'কার্ডের উন্নত Frame B সংস্করণ। প্রতিটি 4টি সঠিক STEM কুইজ উত্তরের জন্য আপনার ডেকের একটি র‍্যান্ডম কার্ড আপগ্রেড হয় (+ড্যামেজ, +Block, +স্ট্যাক, অথবা কম মানা খরচ)।',
	MANA:
		'কার্ড ছোড়ার জন্য ব্যবহৃত অ্যাকশন পয়েন্ট (প্রতি টার্নের শুরুতে মানা রিফিল হয়)। কার্ড ছুড়তে 0–3 মানা খরচ হয়।',
	STEAL:
		'প্রতিপক্ষকে দেওয়া আনব্লকড ড্যামেজের ওপর ভিত্তি করে আপনার যোদ্ধাকে হিল করে। Hemostasis (NO-STEAL) থাকলে এটি কাজ করে না।',
	'TRUE DMG':
		'লক্ষ্যের Block সম্পূর্ণভাবে উপেক্ষা করে এবং সরাসরি HP থেকে বিয়োগ করে।',
	CURE:
		'জীববিজ্ঞানের নিরাময় মেকানিক যা সক্রিয় ডিবফগুলো (Poison, Parasite, Weak, Vulnerable, Corrode, Anti-heal, Hemostasis এবং Strength হ্রাস) দূর করে।',
	BURST:
		'প্রতিপক্ষের বর্তমান Poison স্ট্যাকের সমান তাৎক্ষণিক ড্যামেজ দেয়।',
	AFFINITY:
		'আপনার চ্যাম্পিয়নের Affinity-র সাথে মিলে যাওয়া কার্ডগুলো +25% আউটগোয়িং প্রভাব পায় এবং সেই বিষয়ের ইনকামিং ড্যামেজ 25% কমায়। Weakness কার্ডগুলো -25% আউটগোয়িং প্রভাব দেয় এবং +25% ইনকামিং ড্যামেজ নেয়।',
	DEFENSE:
		'টাইমারের মধ্যে ছোড়া কার্ডের STEM কুইজের সঠিক উত্তর দিলে Normal ও Uncommon কার্ড সম্পূর্ণ বাতিল (0%) হয়, এবং Epic ও Legendary কার্ডের ক্ষমতা 35%-এ নেমে আসে।',

	// Permanent Powers
	STR: 'বাকি যুদ্ধের জন্য আপনার প্রতিটি আক্রমণের আঘাতে +N ড্যামেজ যোগ করে। ডিবফের কারণে এটি ঋণাত্মকও হতে পারে।',
	DEMON: 'আপনার প্রতিটি টার্নের শুরুতে স্বয়ংক্রিয়ভাবে +N Strength পান।',
	METAL: 'আপনার প্রতিটি টার্নের শেষে স্বয়ংক্রিয়ভাবে N Block পান।',
	BARRICADE: 'বাকি যুদ্ধের জন্য আপনার টার্নের শুরুতে আপনার Block কখনো মুছে যাবে না।',
	JUGG: 'যখনই আপনি Block পাবেন, স্বয়ংক্রিয়ভাবে প্রতিপক্ষকে N ড্যামেজ দেবেন।',
	FUMES: 'আপনার প্রতিটি টার্নের শুরুতে স্বয়ংক্রিয়ভাবে প্রতিপক্ষকে N Poison প্রয়োগ করুন।',
	ENVENOM: 'যখনই আপনার আক্রমণ আনব্লকড ড্যামেজ দেয়, প্রতিপক্ষকে N Poison প্রয়োগ করুন।',
	REPAIR: 'আপনার প্রতিটি টার্নের শেষে স্বয়ংক্রিয়ভাবে N HP হিল করুন।',
	PHOENIX: 'এই যুদ্ধে একবার, আপনার HP 0-তে পৌঁছালে সাথে সাথে আপনার সর্বোচ্চ HP-এর 30% (বা 45%+) নিয়ে পুনরুজ্জীবিত হোন।',

	// Buffs
	FLEX: 'শুধুমাত্র বর্তমান টার্নের জন্য +N Strength পান; টার্নের শেষে এটি চলে যায়।',
	BLUR: 'আপনার পরবর্তী টার্নের শুরুতে আপনার Block মুছে যাবে না।',
	COAT: 'আপনার পরবর্তী আনব্লকড আক্রমণের আঘাত প্রতিপক্ষকে +N Poison প্রয়োগ করে।',
	WARD: 'আপনার ওপর প্রয়োগ করা পরবর্তী Nটি ডিবফ বাতিল ও প্রতিহত করে।',
	REFLECT: 'আপনার পরবর্তী টার্ন পর্যন্ত আপনার নেওয়া আক্রমণের ড্যামেজের P% আক্রমণকারীর দিকে প্রতিফলিত করে।',
	APPARITION: 'আপনার পরবর্তী টার্নের শুরু পর্যন্ত আপনার নেওয়া যেকোনো একক আঘাত বা HP ক্ষতি কমে সর্বোচ্চ 1 HP হয়।',
	'2X TAP': 'এই টার্নে আপনার খেলা পরবর্তী Maths আক্রমণ কার্ডটি দুইবার কার্যকর হবে।',
	REGEN: 'R রাউন্ডের জন্য আপনার প্রতিটি টার্নের শুরুতে N HP হিল করুন।',
	HIBERNATE: 'আপনার পরবর্তী টার্নের শুরুতে N HP হিল করুন।',
	CHARGE: 'আপনার পরবর্তী টার্নের শুরুতে +N বোনাস মানা পান।',
	'STUN-IMM': 'N রাউন্ডের জন্য আপনাকে Stun করা যাবে না (Stun থেকে সেরে ওঠার পর স্বয়ংক্রিয়ভাবে 2 রাউন্ডের জন্য পাওয়া যায়)।',

	// Debuffs
	POISON: 'আপনার টার্নের শুরুতে N HP হারান (Block উপেক্ষা করে), তারপর Poison 1 কমে যায়।',
	PARASITE: 'আপনার টার্নের শুরুতে N HP হারান (Block উপেক্ষা করে), তারপর প্রতি টার্নে Parasite 1 করে বৃদ্ধি পায়! শুধুমাত্র Biology Cure এটি দূর করতে পারে।',
	WEAK: 'N রাউন্ডের জন্য আক্রমণে 25% কম ড্যামেজ দিন।',
	VULN: 'N রাউন্ডের জন্য আক্রমণ থেকে 50% বেশি ড্যামেজ নিন।',
	CORRODE: 'N রাউন্ডের জন্য কার্ড থেকে 25% কম Block পান।',
	'ANTI-HEAL': 'N রাউন্ডের জন্য আপনার প্রাপ্ত সমস্ত হিলিং 50% কমে যায়।',
	'NO-STEAL': 'N রাউন্ডের জন্য Life Steal প্রভাব 0 HP হিল করে।',
	STUNNED: 'আপনার পরবর্তী টার্ন স্কিপ হবে, তারপর আপনি 2 রাউন্ডের জন্য Stun Immune পাবেন।',
}

export function translateAttributeSummary(badge: string, englishSummary: string, lang: Language): string {
	if (lang === 'en') return englishSummary
	const bn = ATTRIBUTE_SUMMARY_BN[badge]
	return bn ? ensureEnglishDigits(bn) : englishSummary
}

export function translateStatusTooltip(
	key: string,
	powers: PlayerPowers,
	englishTooltip: string,
	lang: Language,
): string {
	if (lang === 'en') return englishTooltip

	switch (key) {
		case 'strength': {
			const s = powers.strength ?? 0
			const sign = s > 0 ? '+' : ''
			return ensureEnglishDigits(`Strength: প্রতিটি আঘাতে ${sign}${s} ড্যামেজ।`)
		}
		case 'tempStrength':
			return ensureEnglishDigits(`Temporary Strength: এই টার্নে +${powers.tempStrength ?? 0} ড্যামেজ।`)
		case 'demonForm':
			return ensureEnglishDigits(`Demon Form (P): প্রতি টার্নের শুরুতে +${powers.demonForm ?? 0} Strength পান।`)
		case 'metallicize':
			return ensureEnglishDigits(`Metallicize (P): প্রতি টার্নের শেষে ${powers.metallicize ?? 0} Block পান।`)
		case 'barricade':
			return ensureEnglishDigits('Barricade (P): আপনার টার্নের শুরুতে Block মুছে যাবে না।')
		case 'barricadeOneTurn':
			return ensureEnglishDigits('Blur: আপনার পরবর্তী টার্নের শুরুতে Block মুছে যাবে না।')
		case 'juggernaut':
			return ensureEnglishDigits(`Juggernaut (P): যখনই আপনি Block পাবেন, প্রতিপক্ষকে ${powers.juggernaut ?? 0} ড্যামেজ দিন।`)
		case 'noxiousFumes':
			return ensureEnglishDigits(
				`Noxious Fumes (P): আপনার টার্নের শুরুতে প্রতিপক্ষকে ${powers.noxiousFumes ?? 0} Poison প্রয়োগ করুন।`,
			)
		case 'envenom':
			return ensureEnglishDigits(`Envenom (P): আনব্লকড ড্যামেজ অতিরিক্ত ${powers.envenom ?? 0} Poison প্রয়োগ করে।`)
		case 'envenomOnce':
			return ensureEnglishDigits(`Venomous Coat: পরবর্তী আনব্লকড আঘাত ${powers.envenomOnce ?? 0} Poison প্রয়োগ করে।`)
		case 'selfRepair':
			return ensureEnglishDigits(`Self-Repair (P): আপনার প্রতিটি টার্নের শেষে ${powers.selfRepair ?? 0} HP হিল করুন।`)
		case 'phoenix':
			return ensureEnglishDigits(
				`Phoenix: এই যুদ্ধে একবার, HP 0 হলে ${powers.phoenix ?? 0}% সর্বোচ্চ HP নিয়ে পুনরুজ্জীবিত হোন।`,
			)
		case 'ward':
			return ensureEnglishDigits(`Ward: আপনার ওপর প্রয়োগ করা পরবর্তী ${powers.ward ?? 0}টি ডিবফ বাতিল করে।`)
		case 'reflect':
			return ensureEnglishDigits(
				`Mirror Calculus: পরবর্তী টার্ন পর্যন্ত নেওয়া ড্যামেজের ${powers.reflect ?? 0}% আক্রমণকারীর দিকে প্রতিফলিত করে।`,
			)
		case 'apparition':
			return ensureEnglishDigits('Apparition: পরবর্তী টার্ন পর্যন্ত যেকোনো একক আঘাত বা HP ক্ষতি কমে 1 হয়।')
		case 'doubleTap':
			return ensureEnglishDigits('Double Tap: এই টার্নে আপনার পরবর্তী Maths আক্রমণ কার্ডটি দুইবার খেলা হবে।')
		case 'regen':
			return ensureEnglishDigits(
				`Regen: ${powers.regenRounds ?? 0} রাউন্ডের জন্য আপনার টার্নের শুরুতে ${powers.regenAmount ?? 0} HP হিল করুন।`,
			)
		case 'nextTurnHeal':
			return ensureEnglishDigits(`Hibernate: আপনার পরবর্তী টার্নের শুরুতে ${powers.nextTurnHeal ?? 0} HP হিল করুন।`)
		case 'nextTurnExtraMana':
			return ensureEnglishDigits(`Next Turn Mana: আপনার পরবর্তী টার্নের শুরুতে +${powers.nextTurnExtraMana ?? 0} মানা পান।`)
		case 'stunImmune':
			return ensureEnglishDigits(`Stun Immune: ${powers.stunImmune ?? 0} রাউন্ডের জন্য আপনাকে Stun করা যাবে না।`)
		case 'poison':
			return ensureEnglishDigits(`Poison: টার্নের শুরুতে ${powers.poison ?? 0} HP হারান, তারপর Poison 1 কমে যায়।`)
		case 'parasite':
			return ensureEnglishDigits(
				`Parasite: টার্নের শুরুতে ${powers.parasite ?? 0} HP হারান, তারপর Parasite 1 বৃদ্ধি পায়! শুধুমাত্র Cure এটি দূর করে।`,
			)
		case 'weak':
			return ensureEnglishDigits(`Weak: ${powers.weak ?? 0} রাউন্ডের জন্য 25% কম ড্যামেজ দিন।`)
		case 'vulnerable':
			return ensureEnglishDigits(`Vulnerable: ${powers.vulnerable ?? 0} রাউন্ডের জন্য 50% বেশি ড্যামেজ নিন।`)
		case 'corrode':
			return ensureEnglishDigits(`Corrode: ${powers.corrode ?? 0} রাউন্ডের জন্য 25% কম Block পান।`)
		case 'antiHeal':
			return ensureEnglishDigits(`Anti-heal: ${powers.antiHeal ?? 0} রাউন্ডের জন্য 50% কম হিল পান।`)
		case 'noLifeSteal':
			return ensureEnglishDigits(`Hemostasis: ${powers.noLifeSteal ?? 0} রাউন্ডের জন্য Life steal 0 HP হিল করে।`)
		case 'stun':
			return ensureEnglishDigits('Stunned: আপনার পরবর্তী টার্ন স্কিপ হবে!')
		default:
			return ensureEnglishDigits(englishTooltip)
	}
}
