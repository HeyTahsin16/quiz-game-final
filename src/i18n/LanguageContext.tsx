import {createContext, type ReactNode, useCallback, useContext, useState} from 'react'
import type {BgmTrackId} from '../audio/audioManager'
import type {CharacterId, Rarity, Subject} from '../engine/config'
import {ensureEnglishDigits, type Language} from './types'

const STORAGE_KEY = 'quiz_duel_lang'

function readInitialLanguage(): Language {
	try {
		if (typeof window !== 'undefined') {
			const saved = window.localStorage.getItem(STORAGE_KEY)
			if (saved === 'bn' || saved === 'en') {
				return saved
			}
		}
	} catch {
		// Ignore localStorage access errors
	}
	return 'en'
}

export interface LanguageContextValue {
	lang: Language
	isBangla: boolean
	setLang: (next: Language) => void
	toggleLang: () => void
}

const LanguageContext = createContext<LanguageContextValue>({
	lang: 'en',
	isBangla: false,
	setLang: () => {},
	toggleLang: () => {},
})

export function LanguageProvider({children}: {children: ReactNode}) {
	const [lang, setLangState] = useState<Language>(() => readInitialLanguage())

	const setLang = useCallback((next: Language) => {
		setLangState(next)
		try {
			if (typeof window !== 'undefined') {
				window.localStorage.setItem(STORAGE_KEY, next)
			}
		} catch {
			// Ignore localStorage access errors
		}
	}, [])

	const toggleLang = useCallback(() => {
		setLangState((prev) => {
			const next: Language = prev === 'en' ? 'bn' : 'en'
			try {
				if (typeof window !== 'undefined') {
					window.localStorage.setItem(STORAGE_KEY, next)
				}
			} catch {
				// Ignore localStorage access errors
			}
			return next
		})
	}, [])

	return (
		<LanguageContext.Provider value={{lang, isBangla: lang === 'bn', setLang, toggleLang}}>
			{children}
		</LanguageContext.Provider>
	)
}

export function useLanguage(): LanguageContextValue {
	return useContext(LanguageContext)
}

export const CHARACTER_TRANSLATIONS_BN: Record<CharacterId, {name: string; title: string; bio: string}> = {
	'dark-ninja': {
		name: 'ডার্ক নিনজা',
		title: 'অ্যালকেমিক্যাল ছায়া',
		bio: 'প্রাণঘাতী বিষ এবং ক্ষয়কারী মেঘ তৈরি করে। প্রতিপক্ষের মানা চুরি করার পাশাপাশি Poison এবং Parasite জমা করতে পারদর্শী।',
	},
	reaper: {
		name: 'রিপার',
		title: 'প্রাণশক্তির ফসল কাটিয়ে',
		bio: 'নীরব এবং অমর। কোষীয় পুনরুৎপাদন, ডিবফ প্রতিরোধক Ward এবং কিংবদন্তি Phoenix পুনরুজ্জীবনের মাধ্যমে টিকে থাকে।',
	},
	samurai: {
		name: 'সামুরাই',
		title: 'ক্যালকুলাস ব্লেড',
		bio: 'নিরলস আক্রমণাত্মক নিখুঁততার জাদুকর। Strength বহুগুণ বৃদ্ধি করে এবং একের পর এক বহু-আঘাত হানে।',
	},
	knight: {
		name: 'নাইট',
		title: 'গতিশক্তির অগ্রদূত',
		bio: 'গতিশক্তির অবিচল দুর্গ। স্থায়ী Barricade বর্ম জমা করে এবং Block-কে বিধ্বংসী Body Slam আক্রমণে রূপান্তরিত করে।',
	},
}

export const SUBJECT_LABELS_BN: Record<Subject, {label: string; role: string}> = {
	maths: {label: 'গণিত', role: 'আক্রমণ'},
	physics: {label: 'পদার্থবিজ্ঞান', role: 'প্রতিরক্ষা ও আক্রমণ'},
	chemistry: {label: 'রসায়ন', role: 'ডিবফ'},
	biology: {label: 'জীববিজ্ঞান', role: 'নিরাময় ও স্থায়িত্ব'},
}

export const RARITY_LABELS_BN: Record<Rarity, string> = {
	normal: 'সাধারণ',
	uncommon: 'অসাধারণ',
	epic: 'এপিক',
	legendary: 'কিংবদন্তি',
}

export const BGM_LABELS_BN: Record<BgmTrackId, string> = {
	menu: 'মেনু থিম (Menu Theme)',
	battle: 'ব্যাটল থিম (Battle Theme)',
	quiz: 'কুইজ টেনশন (Quiz Tension)',
}

export function getCharacterDisplay(charId: CharacterId, fallback: {name: string; title: string; bio: string}, lang: Language) {
	if (lang === 'en') return fallback
	const bn = CHARACTER_TRANSLATIONS_BN[charId]
	return bn
		? {
				name: ensureEnglishDigits(bn.name),
				title: ensureEnglishDigits(bn.title),
				bio: ensureEnglishDigits(bn.bio),
			}
		: fallback
}
