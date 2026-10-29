/**
 * Quiz Duel — 320-Question STEM Quiz Bank & KaTeX Math Rendering Unit Tests
 */

import test from 'ava'
import {getQuestionById, getQuestionsBySubjectAndRarity, QUESTION_BANK} from '../src/content/questions'
import {ENGINE_CONFIG, RARITIES, SUBJECTS} from '../src/engine/config'
import {preprocessPlainMathToDelimitedLatex, renderMathTextToHtml} from '../src/ui/components/MathText'

test('QUESTION_BANK contains 320 questions (20 per subject and rarity across all 16 cells)', (t) => {
	t.is(QUESTION_BANK.length, 320)

	for (const subject of SUBJECTS) {
		for (const rarity of RARITIES) {
			const cell = getQuestionsBySubjectAndRarity(subject, rarity)
			t.is(cell.length, 20, `${subject} × ${rarity} has 20 questions`)
		}
	}
})

test('every question in QUESTION_BANK has a unique ID, 4 distinct choices, valid correctIndex, explanation, and timer', (t) => {
	const ids = new Set<string>()
	const prompts = new Set<string>()

	for (const qItem of QUESTION_BANK) {
		t.false(ids.has(qItem.id), `Duplicate question ID: ${qItem.id}`)
		ids.add(qItem.id)

		t.false(prompts.has(qItem.prompt), `Duplicate question prompt: ${qItem.prompt}`)
		prompts.add(qItem.prompt)

		t.true(qItem.prompt.trim().length > 10)
		t.is(qItem.choices.length, 4)

		const choiceSet = new Set(qItem.choices.map((c) => c.trim()))
		t.is(choiceSet.size, 4, `Question ${qItem.id} has 4 distinct choices`)

		t.true([0, 1, 2, 3].includes(qItem.correctIndex))
		t.true(qItem.explanation.trim().length > 5)
		t.is(qItem.timerSeconds, ENGINE_CONFIG.quizTimersSeconds[qItem.rarity])
		t.deepEqual(getQuestionById(qItem.id), qItem)
	}
})

test('renderMathTextToHtml renders all 320 question prompts, choices, and explanations with KaTeX vertical fractions and no raw ^( or [[', (t) => {
	for (const qItem of QUESTION_BANK) {
		for (const field of [qItem.prompt, ...qItem.choices, qItem.explanation]) {
			const delimited = preprocessPlainMathToDelimitedLatex(field)
			const mathBlocks = delimited.match(/\$[^$]+\$/g) ?? []
			for (const mb of mathBlocks) {
				t.false(mb.includes('/'), `Expected vertical \\frac instead of slash in ${qItem.id}: ${mb}`)
			}

			const html = renderMathTextToHtml(field)
			t.false(html.includes('^('), `Raw ^( left in ${qItem.id}: ${field} -> ${html}`)
			t.false(html.includes('[['), `Raw [[ left in ${qItem.id}: ${field} -> ${html}`)
			t.false(html.includes('_{'), `Raw _{ left in ${qItem.id}: ${field} -> ${html}`)
			t.false(html.includes('katex-error'), `KaTeX parse error in ${qItem.id}: ${field}`)
		}
	}

	const sampleOde = renderMathTextToHtml('Separating variables gives y(x) = 3e^(x²), so y(1) = 3e¹ = 3e.')
	t.true(sampleOde.includes('katex'), 'Expected KaTeX markup for ODE explanation')

	for (const fracSample of ['3/8', '√3 / 2', 'π / 4', '1 / s³', 'Slope m = (14 - 2) / (3 - (-1)) = 12 / 4 = 3.', 'a = F / m']) {
		const rendered = renderMathTextToHtml(fracSample)
		t.true(rendered.includes('mfrac'), `Expected vertical fraction mfrac in: ${fracSample}`)
		t.true(rendered.includes('frac-line'), `Expected horizontal fraction bar frac-line in: ${fracSample}`)
	}
})

test('shuffling question choices per match across all 320 questions and 5 seeds places 22-28% of correct answers in each position', (t) => {
	const seeds = [101, 202, 303, 404, 505]
	const counts: [number, number, number, number] = [0, 0, 0, 0]
	const totalSamples = QUESTION_BANK.length * seeds.length
	t.is(totalSamples, 1600)

	for (const seed of seeds) {
		for (const baseQuestion of QUESTION_BANK) {
			const expectedCorrectAnswer = baseQuestion.choices[baseQuestion.correctIndex]
			const shuffled = getQuestionById(baseQuestion.id, seed)
			t.truthy(shuffled)
			if (!shuffled) continue

			t.is(shuffled.choices[shuffled.correctIndex], expectedCorrectAnswer)
			t.is(new Set(shuffled.choices).size, 4)
			counts[shuffled.correctIndex] += 1
		}
	}

	for (const pos of [0, 1, 2, 3] as const) {
		const ratio = counts[pos] / totalSamples
		t.true(
			ratio >= 0.22 && ratio <= 0.28,
			`Expected answer position ${pos} to hold 22-28% of correct answers, got ${(ratio * 100).toFixed(2)}% (${counts[pos]}/${totalSamples})`,
		)
	}
})

test('all 320 questions, 80 cards, and 40 attributes localize to Bangla with English digits (0-9) and clean KaTeX rendering', async (t) => {
	const {localizeQuestion, ALL_QUESTIONS_BN} = await import('../src/i18n/questionTranslations')
	const {translateCardText} = await import('../src/i18n/cardTranslations')
	const {ATTRIBUTE_SUMMARY_BN} = await import('../src/i18n/attributeTranslations')
	const {CATALOG_CARDS} = await import('../src/content/cards')

	const bengaliDigitRegex = /[০-৯]/

	for (const qItem of QUESTION_BANK) {
		const bnEntry = ALL_QUESTIONS_BN[qItem.id]
		t.truthy(bnEntry, `Missing Bangla translation for question ${qItem.id}`)

		const localized = localizeQuestion(qItem, 'bn')
		t.not(localized.prompt, qItem.prompt, `Expected Bangla prompt for ${qItem.id}`)
		t.not(localized.explanation, qItem.explanation, `Expected Bangla explanation for ${qItem.id}`)

		for (const field of [localized.prompt, ...localized.choices, localized.explanation]) {
			t.false(bengaliDigitRegex.test(field), `Found Bengali numeral in ${qItem.id}: ${field}`)
			const html = renderMathTextToHtml(field)
			t.false(html.includes('katex-error'), `KaTeX error in Bangla ${qItem.id}: ${field}`)
		}
	}

	t.is(CATALOG_CARDS.length, 80)
	for (const card of CATALOG_CARDS) {
		const upgraded = card.upgrade(card)
		const bnBase = translateCardText(card.text, 'bn')
		const bnUpg = translateCardText(upgraded.text, 'bn')
		t.not(bnBase, card.text, `Expected Bangla card text for ${card.id}: ${card.text}`)
		t.not(bnUpg, upgraded.text, `Expected Bangla upgraded card text for ${card.id}: ${upgraded.text}`)
		t.false(bengaliDigitRegex.test(bnBase), `Found Bengali numeral in card ${card.id}: ${bnBase}`)
		t.false(bengaliDigitRegex.test(bnUpg), `Found Bengali numeral in upgraded card ${card.id}: ${bnUpg}`)
		if (card.reducedText) {
			const bnRed = translateCardText(card.reducedText, 'bn')
			t.not(bnRed, card.reducedText, `Expected Bangla reduced card text for ${card.id}: ${card.reducedText}`)
			t.false(bengaliDigitRegex.test(bnRed), `Found Bengali numeral in reduced card ${card.id}: ${bnRed}`)
		}
	}

	t.is(Object.keys(ATTRIBUTE_SUMMARY_BN).length, 40)
	for (const [badge, summaryBn] of Object.entries(ATTRIBUTE_SUMMARY_BN)) {
		t.false(bengaliDigitRegex.test(summaryBn), `Found Bengali numeral in attribute ${badge}: ${summaryBn}`)
	}
})

