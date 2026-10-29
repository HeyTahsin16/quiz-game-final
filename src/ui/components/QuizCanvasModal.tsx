import {useCallback, useEffect, useRef, useState} from 'react'
import {audioManager} from '../../audio/audioManager'
import {type QuizQuestion, resolveCardQuestion} from '../../content/questions'
import type {QuizAnswerOutcome, ThrownCardEntry} from '../../engine/actions'
import type {CardInstance} from '../../engine/cards'
import {
	CHARACTERS,
	type CharacterId,
	ENGINE_CONFIG,
	RARITY_FILL_PALETTE,
	SUBJECT_BORDER_PALETTE,
} from '../../engine/config'
import {translateCardText} from '../../i18n/cardTranslations'
import {getCharacterDisplay, RARITY_LABELS_BN, SUBJECT_LABELS_BN, useLanguage} from '../../i18n/LanguageContext'
import {localizeQuestion} from '../../i18n/questionTranslations'
import {FlatBanner, FlatBar, FlatPanel, FlatWell} from './FlatUi'
import {MathText} from './MathText'
import {NineSliceCard} from './NineSliceCard'
import {PixelSprite} from './PixelSprite'

export interface QuizCanvasModalProps {
	entry: ThrownCardEntry
	queuePosition: number
	queueTotal: number
	attackerCharacter: CharacterId
	defenderCharacter: CharacterId
	formattedCardText: string
	seed?: number
	isBotDefender?: boolean
	onResolve: (outcome: QuizAnswerOutcome, selectedChoice?: number | null) => void
}

export interface QuestionPeekModalProps {
	card: CardInstance
	seed?: number
	onClose: () => void
}

export function QuizCanvasModal({
	entry,
	queuePosition,
	queueTotal,
	attackerCharacter,
	defenderCharacter,
	formattedCardText,
	seed,
	isBotDefender = false,
	onResolve,
}: QuizCanvasModalProps) {
	const {lang, isBangla} = useLanguage()
	const {card} = entry
	const rawQuestion: QuizQuestion = resolveCardQuestion(card, seed, entry.questionId) || {
		id: 'Q-FALLBACK',
		subject: card.subject,
		rarity: card.rarity,
		timerSeconds: ENGINE_CONFIG.quizTimersSeconds[card.rarity],
		prompt: 'Solve for x: 3x + 7 = 22',
		choices: ['3', '5', '7', '9'],
		correctIndex: 1,
		explanation: '3(5) + 7 = 15 + 7 = 22.',
	}
	const question = localizeQuestion(rawQuestion, lang)

	const totalMs = question.timerSeconds * 1000
	const [remainingMs, setRemainingMs] = useState<number>(totalMs)
	const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
	const [resolvedOutcome, setResolvedOutcome] = useState<QuizAnswerOutcome | null>(null)
	const [isWindowBlurred, setIsWindowBlurred] = useState<boolean>(false)

	const onResolveRef = useRef(onResolve)
	onResolveRef.current = onResolve

	const attacker = getCharacterDisplay(attackerCharacter, CHARACTERS[attackerCharacter], lang)
	const defender = getCharacterDisplay(defenderCharacter, CHARACTERS[defenderCharacter], lang)
	const subjectMeta = SUBJECT_BORDER_PALETTE[card.subject]
	const rarityMeta = RARITY_FILL_PALETTE[card.rarity]
	const isEpicOrLegendary = card.rarity === 'epic' || card.rarity === 'legendary'

	// Reset state whenever a new thrown card entry arrives
	const entryKey = `${card.instanceId}:${question.id}`
	useEffect(() => {
		if (!entryKey) return
		setRemainingMs(question.timerSeconds * 1000)
		setSelectedChoice(null)
		setResolvedOutcome(null)
		audioManager.playSfx('popup-open')
	}, [entryKey, question.timerSeconds])

	// Play STEM Trial tension BGM while quiz modal is active, then restore battle BGM on close
	useEffect(() => {
		audioManager.playBgm('quiz')
		return () => {
			audioManager.playBgm('battle')
		}
	}, [])

	// Handle window blur / visibility anti-cheat mask (ENGINE_CONFIG.hideOnBlur) + block copy/cut/contextmenu
	useEffect(() => {
		const blockCopy = (e: Event) => e.preventDefault()
		document.addEventListener('copy', blockCopy)
		document.addEventListener('cut', blockCopy)
		document.addEventListener('contextmenu', blockCopy)

		if (!ENGINE_CONFIG.hideOnBlur) {
			return () => {
				document.removeEventListener('copy', blockCopy)
				document.removeEventListener('cut', blockCopy)
				document.removeEventListener('contextmenu', blockCopy)
			}
		}

		const handleBlur = () => setIsWindowBlurred(true)
		const handleFocus = () => setIsWindowBlurred(false)
		const handleVisibility = () => {
			if (document.visibilityState === 'hidden') {
				setIsWindowBlurred(true)
			} else {
				setIsWindowBlurred(false)
			}
		}

		window.addEventListener('blur', handleBlur)
		window.addEventListener('focus', handleFocus)
		document.addEventListener('visibilitychange', handleVisibility)
		return () => {
			document.removeEventListener('copy', blockCopy)
			document.removeEventListener('cut', blockCopy)
			document.removeEventListener('contextmenu', blockCopy)
			window.removeEventListener('blur', handleBlur)
			window.removeEventListener('focus', handleFocus)
			document.removeEventListener('visibilitychange', handleVisibility)
		}
	}, [])

	const commitAnswer = useCallback(
		(choiceIndex: number | null, isTimeout = false) => {
			if (resolvedOutcome !== null) return
			let outcome: QuizAnswerOutcome
			if (isTimeout || choiceIndex === null) {
				outcome = 'timeout'
			} else if (choiceIndex === question.correctIndex) {
				outcome = 'correct'
			} else {
				outcome = 'wrong'
			}

			setSelectedChoice(choiceIndex)
			setResolvedOutcome(outcome)

			if (outcome === 'correct') {
				audioManager.playSfx('quiz-correct')
			} else {
				audioManager.playSfx('quiz-wrong')
				audioManager.playCharacterVoice(defenderCharacter, 'hurt')
			}
		},
		[defenderCharacter, question.correctIndex, resolvedOutcome],
	)

	// Countdown timer + final 4-second clock tick SFX
	const lastTickSecondRef = useRef<number | null>(null)
	useEffect(() => {
		if (!entryKey || resolvedOutcome !== null) return
		const startedAt = performance.now()
		lastTickSecondRef.current = null

		const interval = window.setInterval(() => {
			const elapsed = performance.now() - startedAt
			const nextRemaining = Math.max(0, totalMs - elapsed)
			setRemainingMs(nextRemaining)

			const wholeSec = Math.ceil(nextRemaining / 1000)
			if (wholeSec >= 1 && wholeSec <= 4 && lastTickSecondRef.current !== wholeSec) {
				lastTickSecondRef.current = wholeSec
				audioManager.playSfx('tick')
			}

			if (nextRemaining <= 0) {
				window.clearInterval(interval)
				commitAnswer(null, true)
			}
		}, 50)

		return () => window.clearInterval(interval)
	}, [commitAnswer, entryKey, resolvedOutcome, totalMs])

	// Bot defender auto-answer
	useEffect(() => {
		if (!isBotDefender || resolvedOutcome !== null) return
		const botAccuracyByRarity: Record<string, number> = {
			normal: 0.65,
			uncommon: 0.55,
			epic: 0.45,
			legendary: 0.35,
		}
		const targetAccuracy = botAccuracyByRarity[card.rarity] ?? 0.5
		const timer = window.setTimeout(() => {
			const roll = Math.random()
			if (roll < targetAccuracy) {
				commitAnswer(question.correctIndex, false)
			} else {
				const wrongChoices = [0, 1, 2, 3].filter((idx) => idx !== question.correctIndex)
				const pick = wrongChoices[Math.floor(Math.random() * wrongChoices.length)] ?? 0
				commitAnswer(pick, false)
			}
		}, 1150)
		return () => window.clearTimeout(timer)
	}, [card.rarity, commitAnswer, isBotDefender, question.correctIndex, resolvedOutcome])

	// Automatically continue 2 seconds after the question is answered (no manual confirmation required)
	useEffect(() => {
		if (resolvedOutcome === null) return
		const timer = window.setTimeout(() => {
			onResolveRef.current(resolvedOutcome, selectedChoice)
		}, 2000)
		return () => window.clearTimeout(timer)
	}, [resolvedOutcome, selectedChoice])

	// Keyboard shortcuts (1-4 / A-D)
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (resolvedOutcome !== null || isBotDefender) return
			const key = e.key.toUpperCase()
			if (key === '1' || key === 'A') commitAnswer(0)
			if (key === '2' || key === 'B') commitAnswer(1)
			if (key === '3' || key === 'C') commitAnswer(2)
			if (key === '4' || key === 'D') commitAnswer(3)
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [commitAnswer, isBotDefender, resolvedOutcome])

	const secondsDisplay = (remainingMs / 1000).toFixed(1)
	const badges = ['A', 'B', 'C', 'D'] as const

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none backdrop-blur-xs">
			<FlatPanel variant="gold" wellVariant="dark" className="w-full max-w-[1060px] shadow-2xl" wellClassName="p-6">
				{/* Top Quiz Header Bar */}
				<div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
					<div className="flex items-center gap-3">
						<FlatBanner variant="offset-bl">
							{isBangla
								? `${SUBJECT_LABELS_BN[card.subject].label} কুইজ (${queuePosition}/${queueTotal})`
								: `${subjectMeta.label.toUpperCase()} QUIZ (${queuePosition}/{queueTotal})`}
						</FlatBanner>
						<span style={{color: rarityMeta.badgeText}} className="font-pixel text-xs">
							{isBangla
								? `${RARITY_LABELS_BN[card.rarity]} কার্ড · ${question.timerSeconds}s সময়সীমা`
								: `${rarityMeta.label} Card · ${question.timerSeconds}s Limit`}
						</span>
					</div>

					{/* Defender Identity */}
					<div className="flex items-center gap-3 text-xs">
						<span className="text-slate-300">
							{isBangla ? 'আক্রমণকারী:' : 'Attacker:'} <strong className="text-amber-300">{attacker.name}</strong>
						</span>
						<span aria-hidden="true" className="text-slate-500">
							→
						</span>
						<span className="text-slate-200">
							{isBangla ? 'প্রতিরক্ষাকারী উত্তর দিচ্ছেন:' : 'Defender Answering:'}{' '}
							<strong className="text-sky-300">
								{defender.name} (P{entry.defenderIndex + 1}
								{isBotDefender ? (isBangla ? ' · বট' : ' · BOT') : ''})
							</strong>
						</span>
					</div>
				</div>

				{/* Countdown Progress Bar using FlatBar */}
				<div className="my-4 space-y-1.5">
					<div className="flex items-center justify-between font-pixel text-xs">
						<span className="text-slate-200">
							{resolvedOutcome === null
								? isBotDefender
									? isBangla
										? `${defender.name} (বট) উত্তর হিসাব করছে...`
										: `${defender.name} (Bot) is calculating answer...`
									: isBangla
										? `প্রতিরক্ষাকারী P${entry.defenderIndex + 1} (${defender.name}): সময় শেষ হওয়ার আগেই উত্তর দিন!`
										: `Defender P${entry.defenderIndex + 1} (${defender.name}): Answer before timer expires!`
								: isBangla
									? 'প্রশ্নের ফলাফল নির্ধারিত'
									: 'Question Resolved'}
						</span>
						<span className={`tabular-nums ${remainingMs <= 3000 ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>
							{secondsDisplay}s
						</span>
					</div>
					<FlatBar
						value={remainingMs}
						max={totalMs}
						fillTone={remainingMs <= 3000 ? 'red' : remainingMs <= 6000 ? 'gold' : 'green'}
						heightClass="h-5"
					/>
				</div>

				{/* Main 2-Column Quiz Arena: Thrown Card on Left, Protected KaTeX Quiz on Right */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
					{/* Left Column: Incoming Thrown Card + Resolution Stakes */}
					<FlatWell variant="gold-dark" className="flex flex-col items-center justify-between p-4 lg:col-span-4">
						<div className="mb-2 flex w-full items-center justify-between text-xs text-slate-300">
							<div className="flex items-center gap-2">
								<PixelSprite characterId={attackerCharacter} integerScale={1} facing="right" />
								<span className="font-pixel text-[10px] text-amber-300">
									{isBangla ? 'ছোড়া কার্ড' : 'Thrown Card'}
								</span>
							</div>
							<span className="font-mono text-[11px] text-slate-300">#{card.id}</span>
						</div>

						<NineSliceCard
							id={card.id}
							name={card.name}
							subject={card.subject}
							rarity={card.rarity}
							cost={card.cost}
							text={formattedCardText}
							upgraded={card.upgraded}
							exhaust={card.exhaust}
							power={card.power}
							integerScale={3}
						/>

						{/* Stakes Matrix */}
						<div className="mt-4 w-full space-y-1.5 border-t border-slate-800 pt-3 text-xs">
							<div className="font-pixel text-[9px] text-slate-300">
								{isBangla ? 'প্রতিরক্ষাকারীর কুইজ ফলাফল:' : 'DEFENDER QUIZ STAKES:'}
							</div>
							<div className="flat-slot-blue flex items-center justify-between px-2.5 py-1 text-white">
								<span>{isBangla ? 'সঠিক হলে:' : 'If Correct:'}</span>
								<span className="font-semibold">
									{isEpicOrLegendary
										? isBangla
											? '35%-এ হ্রাস পাবে'
											: 'Reduced to 35%'
										: isBangla
											? 'সম্পূর্ণ বাতিল (0% প্রভাব)'
											: 'NULLIFIED (No Effect)'}
								</span>
							</div>
							{isEpicOrLegendary && card.reducedText && (
								<div className="flat-slot-dark px-2.5 py-1 text-[11px] text-amber-200">
									{isBangla
										? `হ্রাসকৃত রূপ: ${translateCardText(card.reducedText, lang)}`
										: `Reduced Form: ${card.reducedText}`}
								</div>
							)}
							<div className="flat-slot-orange flex items-center justify-between px-2.5 py-1 text-white">
								<span>{isBangla ? 'ভুল / সময় শেষ হলে:' : 'If Wrong / Timeout:'}</span>
								<span className="font-semibold">{isBangla ? 'পূর্ণ প্রভাব (100%)' : 'FULL EFFECT (100%)'}</span>
							</div>
						</div>
					</FlatWell>

					{/* Right Column: Question Prompt & 4 Choice Buttons */}
					<div className="relative flex flex-col justify-between space-y-4 lg:col-span-8">
						{/* Anti-Cheat Blur Mask when window loses focus */}
						{isWindowBlurred && resolvedOutcome === null && (
							<div className="flat-frame-gold absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center">
								<div className="font-pixel text-sm text-amber-300">
									{isBangla ? 'অ্যান্টি-চিট শিল্ড সক্রিয়' : 'ANTI-CHEAT SHIELD ACTIVE'}
								</div>
								<p className="mt-2 max-w-md text-xs text-slate-200">
									{isBangla
										? 'গেম উইন্ডো আনফোকাসড থাকাকালীন কুইজের প্রশ্ন ও অপশন লুকানো থাকে। সময় শেষ হওয়ার আগে পুনরায় দেখতে উইন্ডোর ভেতরে ক্লিক করুন!'
										: 'Quiz prompt and choices are hidden while the game window is unfocused. Click inside the window to resume viewing before the timer runs out!'}
								</p>
							</div>
						)}

						{/* Question Prompt */}
						<FlatWell variant="dark" className="p-4">
							<div className="mb-2 flex items-center justify-between font-mono text-[11px] text-slate-400">
								<span>{isBangla ? 'STEM ট্রায়াল প্রশ্ন' : 'STEM Trial Question'}</span>
								<span>{isBangla ? 'কী: [1-4] বা [A-D]' : 'Keys: [1-4] or [A-D]'}</span>
							</div>
							<div
								className="pointer-events-none flex min-h-[104px] items-center rounded border-2 bg-[#090d16] px-5 py-4 text-lg leading-relaxed font-semibold text-slate-100 select-none"
								style={{borderColor: subjectMeta.border}}
							>
								<MathText text={question.prompt} />
							</div>
						</FlatWell>

						{/* 4 Multiple Choice Buttons */}
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							{[0, 1, 2, 3].map((idx) => {
								const choiceText = question.choices[idx] ?? ''
								const isSelected = selectedChoice === idx
								const isCorrect = idx === question.correctIndex
								let borderColor = '#334155'
								let bgColor = '#0f172a'
								let textColor = '#f1f5f9'

								if (resolvedOutcome !== null) {
									if (isCorrect) {
										borderColor = '#10b981'
										bgColor = '#062c22'
										textColor = '#6ee7b7'
									} else if (isSelected && !isCorrect) {
										borderColor = '#ef4444'
										bgColor = '#3b0d15'
										textColor = '#fca5a5'
									}
								}

								const badgeColor = resolvedOutcome !== null && isCorrect ? '#34d399' : subjectMeta.highlight

								return (
									<button
										key={idx}
										type="button"
										disabled={resolvedOutcome !== null || isBotDefender}
										aria-label={`Select quiz option ${idx + 1}`}
										onClick={() => commitAnswer(idx, false)}
										className={`flat-slot-dark flex items-center overflow-hidden p-1.5 text-left transition-transform ${
											resolvedOutcome === null && !isBotDefender
												? 'cursor-pointer hover:-translate-y-0.5'
												: 'cursor-default'
										}`}
									>
										<div
											className="pointer-events-none flex min-h-[64px] w-full items-center gap-3 rounded border-2 px-3.5 py-2.5 text-base font-semibold select-none"
											style={{borderColor, backgroundColor: bgColor, color: textColor}}
										>
											<span
												className="flex h-7 w-6 shrink-0 items-center justify-center border text-xs font-bold"
												style={{
													borderColor: badgeColor,
													color: badgeColor,
													backgroundColor: 'rgba(251, 191, 36, 0.12)',
												}}
											>
												{badges[idx]}
											</span>
											<span className="flex-1">
												<MathText text={choiceText} />
											</span>
										</div>
									</button>
								)
							})}
						</div>

						{/* Post-Answer Resolution Banner + Explanation (Auto-continues after 2s) */}
						{resolvedOutcome !== null && (
							<div className="space-y-3 border-t border-slate-800 pt-3">
								<FlatWell
									variant={resolvedOutcome === 'correct' ? 'blue' : 'orange'}
									className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
								>
									<div className="font-pixel text-xs text-white">
										{resolvedOutcome === 'correct'
											? isEpicOrLegendary
												? isBangla
													? 'সঠিক উত্তর! কার্ডের ক্ষমতা কমে 35% হয়েছে!'
													: 'CORRECT ANSWER! CARD REDUCED TO 35% STRENGTH!'
												: isBangla
													? 'সঠিক উত্তর! কার্ডটি সম্পূর্ণ বাতিল হয়েছে!'
													: 'CORRECT ANSWER! CARD COMPLETELY NULLIFIED!'
											: resolvedOutcome === 'timeout'
												? isBangla
													? 'সময় শেষ! কার্ডটি পূর্ণ ক্ষমতায় (100%) আঘাত হেনেছে!'
													: 'TIME EXPIRED! CARD LANDS AT FULL STRENGTH!'
												: isBangla
													? 'ভুল উত্তর! কার্ডটি পূর্ণ ক্ষমতায় (100%) আঘাত হেনেছে!'
													: 'WRONG ANSWER! CARD LANDS AT FULL STRENGTH!'}
									</div>

									<span className="font-mono text-xs text-amber-200">
										{isBangla ? '2s পর চলমান...' : 'Continuing in 2s...'}
									</span>
								</FlatWell>

								<div className="pointer-events-none rounded border-2 border-slate-600 bg-[#131826] px-4 py-3 text-sm leading-relaxed text-amber-200 select-none">
									<span className="font-pixel text-[10px] text-amber-400">
										{isBangla ? 'ব্যাখ্যা: ' : 'EXPLANATION: '}
									</span>
									<MathText text={question.explanation} />
								</div>
							</div>
						)}
					</div>
				</div>
			</FlatPanel>
		</div>
	)
}

export function QuestionPeekModal({card, seed, onClose}: QuestionPeekModalProps) {
	const {lang, isBangla} = useLanguage()
	const rawQuestion = resolveCardQuestion(card, seed)
	const question = rawQuestion ? localizeQuestion(rawQuestion, lang) : undefined
	const subjectMeta = SUBJECT_BORDER_PALETTE[card.subject]
	const rarityMeta = RARITY_FILL_PALETTE[card.rarity]
	const badges = ['A', 'B', 'C', 'D'] as const

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose()
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [onClose])

	return (
		<div
			onPointerDown={(e) => {
				if (e.target === e.currentTarget) {
					onClose()
				}
			}}
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none"
		>
			<div onPointerDown={(e) => e.stopPropagation()} className="w-full max-w-[680px]">
				<FlatPanel variant="silver" wellVariant="dark" className="w-full" wellClassName="p-6 space-y-4">
					<div className="flex items-center justify-between border-b border-slate-800 pb-3">
						<div>
							<FlatBanner variant="offset-bl">
								{isBangla
									? `যুক্ত প্রশ্ন প্রিভিউ · ${card.name} (#${card.id})`
									: `Bound Question Peek · ${card.name} (#${card.id})`}
							</FlatBanner>
							<div className="mt-2 text-xs text-slate-300">
								{isBangla
									? `${SUBJECT_LABELS_BN[card.subject].label} · ${RARITY_LABELS_BN[card.rarity]} · ছোড়া হলে প্রতিপক্ষ উত্তর দিতে ${question?.timerSeconds ?? 15}s সময় পাবে`
									: `${subjectMeta.label} · ${rarityMeta.label} · Opponent gets ${question?.timerSeconds ?? 15}s to answer when thrown`}
							</div>
						</div>
					</div>

					{question ? (
						<div className="space-y-3">
							<div
								className="pointer-events-none rounded border-2 bg-[#090d16] px-4 py-3.5 text-base leading-relaxed font-semibold text-slate-100 select-none"
								style={{borderColor: subjectMeta.border}}
							>
								<MathText text={question.prompt} />
							</div>
							<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
								{[0, 1, 2, 3].map((idx) => (
									<div
										key={idx}
										className="flat-slot-dark flex items-center gap-2.5 overflow-hidden px-3.5 py-2.5 text-sm text-slate-200"
									>
										<span
											className="flex h-6 w-6 shrink-0 items-center justify-center border font-bold"
											style={{borderColor: subjectMeta.highlight, color: subjectMeta.highlight}}
										>
											{badges[idx]}
										</span>
										<MathText text={question.choices[idx] ?? ''} />
									</div>
								))}
							</div>
						</div>
					) : (
						<div className="py-6 text-center text-xs text-slate-400">
							{isBangla ? 'এই কার্ডে কোনো যুক্ত প্রশ্ন পাওয়া যায়নি।' : 'No bound question found on this card instance.'}
						</div>
					)}
				</FlatPanel>
			</div>
		</div>
	)
}
