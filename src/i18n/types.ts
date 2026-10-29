export type Language = 'en' | 'bn'

const BENGALI_TO_ENGLISH_DIGITS: Record<string, string> = {
	'০': '0',
	'১': '1',
	'২': '2',
	'৩': '3',
	'৪': '4',
	'৫': '5',
	'৬': '6',
	'৭': '7',
	'৮': '8',
	'৯': '9',
}

/**
 * Guarantees that any digits in a translated string remain in standard English numerals (0-9).
 */
export function ensureEnglishDigits(input: string): string {
	return input.replace(/[০-৯]/g, (d) => BENGALI_TO_ENGLISH_DIGITS[d] ?? d)
}
