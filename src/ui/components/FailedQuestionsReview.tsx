import {useState} from 'react'
import {audioManager} from '../../audio/audioManager'
import {getQuestionsBySubjectAndRarity, type QuizQuestion, resolveCardQuestion} from '../../content/questions'
import type {PlayerIndex, QuizResolutionSummary} from '../../engine/actions'
import {SUBJECT_BORDER_PALETTE} from '../../engine/config'
import {RARITY_LABELS_BN, SUBJECT_LABELS_BN, useLanguage} from '../../i18n/LanguageContext'
import {localizeQuestion} from '../../i18n/questionTranslations'
import {FlatBanner, FlatButton, FlatWell} from './FlatUi'
import {MathText} from './MathText'

export interface FailedQuestionsReviewProps {
	quizHistory?: QuizResolutionSummary[]
	seed?: number
	localPlayerIndex?: PlayerIndex
	isHotseat?: boolean
	p1Name?: string
	p2Name?: string
	compact?: boolean
}

function resolveQuestionForSummary(item: QuizResolutionSummary, seed?: number): QuizQuestion | undefined {
	const direct = resolveCardQuestion(
		{
			boundQuestionId: item.questionId,
			boundChoices: item.boundChoices,
			boundCorrectIndex: item.boundCorrectIndex,
		},
		seed,
		item.questionId,
	)
	if (direct) return direct

	const fallbackPool = getQuestionsBySubjectAndRarity(item.cardSubject, item.cardRarity)
	const fallbackBase = fallbackPool[0]
	if (!fallbackBase) return undefined
	return resolveCardQuestion(
		{
			boundQuestionId: fallbackBase.id,
		},
		seed,
		fallbackBase.id,
	)
}

export function FailedQuestionsReview({
	quizHistory = [],
	seed,
	localPlayerIndex = 0,
	isHotseat = false,
	p1Name = 'Player 1',
	p2Name = 'Player 2',
	compact = false,
}: FailedQuestionsReviewProps) {
	const {lang, isBangla} = useLanguage()

	const allFailed = quizHistory.filter((q) => q.answer === 'wrong' || q.answer === 'timeout')
	const myFailed = allFailed.filter((q) => q.defenderIndex === localPlayerIndex)
	const oppFailed = allFailed.filter((q) => q.defenderIndex !== localPlayerIndex)

	const defaultFilter: 'mine' | 'all' = isHotseat || (myFailed.length === 0 && allFailed.length > 0) ? 'all' : 'mine'
	const [filterMode, setFilterMode] = useState<'mine' | 'all'>(defaultFilter)

	const displayedList = filterMode === 'mine' && (myFailed.length > 0 || allFailed.length === 0) ? myFailed : allFailed

	return (
		<div className="w-full space-y-3 text-left">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 pb-2.5">
				<div className="flex flex-wrap items-center gap-2">
					<FlatBanner variant="offset-bl" className="px-3 py-0.5 text-[10px]">
						{isBangla ? 'ভুল উত্তর দেওয়া প্রশ্ন ও ব্যাখ্যা' : 'FAILED QUESTIONS & EXPLANATIONS'}
					</FlatBanner>
					<span className="font-mono text-xs text-slate-300 tabular-nums">
						({displayedList.length})
					</span>
				</div>

				{!isHotseat && allFailed.length > 0 && oppFailed.length > 0 && (
					<div className="flex items-center gap-1.5">
						<FlatButton
							variant={filterMode === 'mine' ? 'gold' : 'dark'}
							size="sm"
							onClick={() => {
								audioManager.playSfx('click')
								setFilterMode('mine')
							}}
						>
							{isBangla ? `আপনার ভুল (${myFailed.length})` : `Your Failed (${myFailed.length})`}
						</FlatButton>
						<FlatButton
							variant={filterMode === 'all' ? 'gold' : 'dark'}
							size="sm"
							onClick={() => {
								audioManager.playSfx('click')
								setFilterMode('all')
							}}
						>
							{isBangla ? `ম্যাচের সব (${allFailed.length})` : `All Match (${allFailed.length})`}
						</FlatButton>
					</div>
				)}
			</div>

			{!isHotseat && myFailed.length === 0 && allFailed.length > 0 && filterMode === 'all' && (
				<FlatWell variant="blue-dark" className="px-3.5 py-2 text-xs text-emerald-300">
					{isBangla
						? 'অভিনন্দন! আপনি আপনার সব প্রশ্নের সঠিক উত্তর দিয়েছেন। নিচে প্রতিপক্ষের ভুল উত্তর দেওয়া প্রশ্নগুলো দেখানো হলো:'
						: 'Great job! You answered all of your questions correctly. Showing questions failed by the opponent below:'}
				</FlatWell>
			)}

			{displayedList.length === 0 ? (
				<FlatWell variant="dark" className="px-4 py-5 text-center text-xs text-emerald-300">
					{isBangla
						? 'এই ম্যাচে কোনো প্রশ্নের ভুল উত্তর দেওয়া হয়নি! নিখুঁত STEM প্রতিরক্ষা।'
						: 'No questions were failed during this match! Flawless STEM defense.'}
				</FlatWell>
			) : (
				<div
					className={`space-y-3 overflow-y-auto pr-1 ${
						compact ? 'max-h-[34vh]' : 'max-h-[480px]'
					}`}
				>
					{displayedList.map((item, idx) => {
						const rawQ = resolveQuestionForSummary(item, seed)
						if (!rawQ) return null
						const q = localizeQuestion(rawQ, lang)
						const subjectPalette = SUBJECT_BORDER_PALETTE[q.subject]
						const defenderLabel =
							item.defenderIndex === 0 ? `P1 (${p1Name})` : `P2 (${p2Name})`
						const correctLetter = String.fromCharCode(65 + q.correctIndex)
						const correctText = q.choices[q.correctIndex] ?? ''
						const pickedIdx = item.selectedChoice
						const hasPickedWrongChoice =
							pickedIdx !== undefined &&
							pickedIdx !== null &&
							pickedIdx !== q.correctIndex &&
							q.choices[pickedIdx] !== undefined

						return (
							<FlatWell key={`${item.cardId}-${q.id}-${idx}`} variant="dark" className="space-y-2.5 p-3.5">
								<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
									<div className="flex flex-wrap items-center gap-2">
										<span
											className="font-pixel text-[10px]"
											style={{color: subjectPalette.highlight}}
										>
											{q.id} ·{' '}
											{isBangla
												? `${SUBJECT_LABELS_BN[q.subject].label} (${RARITY_LABELS_BN[q.rarity]})`
												: `${subjectPalette.label.toUpperCase()} (${q.rarity.toUpperCase()})`}
										</span>
										<span className="font-mono text-[11px] text-slate-400">
											· {item.cardName} (#{item.cardId})
										</span>
									</div>

									<div className="flex items-center gap-2">
										<span className="font-mono text-[11px] text-slate-300">{defenderLabel}</span>
										<span
											className={`px-2 py-0.5 font-pixel text-[9px] ${
												item.answer === 'timeout'
													? 'bg-amber-950/90 text-amber-300 border border-amber-500/40'
													: 'bg-rose-950/90 text-rose-300 border border-rose-500/40'
											}`}
										>
											{item.answer === 'timeout'
												? isBangla
													? 'সময় শেষ (TIMEOUT)'
													: 'TIME EXPIRED'
												: isBangla
													? 'ভুল উত্তর (WRONG)'
													: 'WRONG ANSWER'}
										</span>
									</div>
								</div>

								<p className="text-sm sm:text-base leading-relaxed font-semibold text-white">
									<MathText text={q.prompt} />
								</p>

								<div className="grid grid-cols-1 gap-1.5 pt-0.5 text-xs sm:text-sm">
									{hasPickedWrongChoice && pickedIdx !== null && pickedIdx !== undefined && (
										<div className="border border-rose-500/30 bg-rose-950/40 px-3 py-1.5 font-mono text-rose-300">
											<span className="font-pixel text-[10px] text-rose-400">
												{isBangla ? 'প্রদত্ত উত্তর: ' : 'YOUR ANSWER: '}
											</span>
											{String.fromCharCode(65 + pickedIdx)}. <MathText text={q.choices[pickedIdx] ?? ''} />
										</div>
									)}

									{item.answer === 'timeout' && (
										<div className="border border-amber-500/30 bg-amber-950/40 px-3 py-1.5 font-mono text-amber-300">
											<span className="font-pixel text-[10px] text-amber-400">
												{isBangla ? 'প্রদত্ত উত্তর: ' : 'YOUR ANSWER: '}
											</span>
											{isBangla ? 'সময় শেষ (কোনো উত্তর নির্বাচিত হয়নি)' : 'Timed Out (No option selected)'}
										</div>
									)}

									<div className="border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 font-mono font-bold text-emerald-300">
										<span className="font-pixel text-[10px] text-emerald-400">
											{isBangla ? 'সঠিক উত্তর: ' : 'CORRECT ANSWER: '}
										</span>
										{correctLetter}. <MathText text={correctText} />
									</div>
								</div>

								{q.explanation && (
									<div className="border-t border-slate-700/80 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed text-amber-200">
										<span className="font-pixel text-[10px] text-amber-400">
											{isBangla ? 'ব্যাখ্যা: ' : 'EXPLANATION: '}
										</span>
										<MathText text={q.explanation} />
									</div>
								)}
							</FlatWell>
						)
					})}
				</div>
			)}
		</div>
	)
}
