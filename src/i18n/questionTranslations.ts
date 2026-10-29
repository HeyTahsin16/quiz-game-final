import type {QuizQuestion} from '../content/questions'
import {BIOLOGY_QUESTIONS_BN} from './questionsBiologyBn'
import {CHEMISTRY_QUESTIONS_BN} from './questionsChemistryBn'
import {MATHS_QUESTIONS_BN, type QuestionTranslationBn} from './questionsMathsBn'
import {PHYSICS_QUESTIONS_BN} from './questionsPhysicsBn'
import {ensureEnglishDigits, type Language} from './types'

export const ALL_QUESTIONS_BN: Record<string, QuestionTranslationBn> = {
	...MATHS_QUESTIONS_BN,
	...PHYSICS_QUESTIONS_BN,
	...CHEMISTRY_QUESTIONS_BN,
	...BIOLOGY_QUESTIONS_BN,
}

/**
 * Localizes a QuizQuestion into Bangla when `lang === 'bn'`, translating the prompt,
 * explanation, and any prose-based choices while preserving all English numbers (0-9)
 * and mathematical/scientific formulas.
 */
export function localizeQuestion(question: QuizQuestion, lang: Language): QuizQuestion {
	if (lang === 'en') return question

	const bn = ALL_QUESTIONS_BN[question.id]
	if (!bn) return question

	const localizedChoices = question.choices.map((c) => {
		const mapped = bn.choices?.[c]
		return mapped ? ensureEnglishDigits(mapped) : ensureEnglishDigits(c)
	}) as [string, string, string, string]

	return {
		...question,
		prompt: ensureEnglishDigits(bn.prompt),
		explanation: ensureEnglishDigits(bn.explanation),
		choices: localizedChoices,
	}
}
