import {audioManager} from '../../audio/audioManager'
import {CHARACTERS, type CharacterId} from '../../engine/config'
import {getCharacterDisplay, useLanguage} from '../../i18n/LanguageContext'
import {FailedQuestionsReview} from '../components/FailedQuestionsReview'
import {FlatBanner, FlatButton, FlatPanel, FlatWell} from '../components/FlatUi'
import {PixelSprite} from '../components/PixelSprite'
import type {MatchSummary} from './BattleScreen'

export interface ResultScreenProps {
	winner: 0 | 1 | 2
	p1Character: CharacterId
	p2Character: CharacterId
	summary?: MatchSummary | null
	onRematch: () => void
	onReturnSelect: () => void
}

export function ResultScreen({
	winner,
	p1Character,
	p2Character,
	summary,
	onRematch,
	onReturnSelect,
}: ResultScreenProps) {
	const {lang, isBangla} = useLanguage()
	const winCharId = winner === 2 ? p2Character : p1Character
	const loseCharId = winner === 2 ? p1Character : p2Character
	const winChar = getCharacterDisplay(winCharId, CHARACTERS[winCharId], lang)
	const loseChar = getCharacterDisplay(loseCharId, CHARACTERS[loseCharId], lang)
	const p1CharDisplay = getCharacterDisplay(p1Character, CHARACTERS[p1Character], lang)
	const p2CharDisplay = getCharacterDisplay(p2Character, CHARACTERS[p2Character], lang)

	return (
		<div className="mx-auto max-w-[960px] space-y-8 px-6 py-10 text-center">
			<FlatPanel variant="gold" wellVariant="dark" wellClassName="space-y-6 p-6 sm:p-8">
				<div className="flex justify-center">
					<FlatBanner variant="offset-bl">{isBangla ? 'ম্যাচ সম্পন্ন' : 'MATCH COMPLETE'}</FlatBanner>
				</div>
				<h1 className="font-pixel text-2xl text-white">
					{winner === 0
						? isBangla
							? '500-অ্যাকশন সীমায় ম্যাচ ড্র হয়েছে!'
							: 'DRAW AT 500-ACTION CAP!'
						: isBangla
							? `প্লেয়ার ${winner} (${winChar.name}) জয়ী!`
							: `PLAYER ${winner} (${winChar.name.toUpperCase()}) WINS!`}
				</h1>

				{summary && (
					<div className="mx-auto grid max-w-xl grid-cols-2 gap-3 text-xs sm:grid-cols-4">
						<FlatWell variant="gold-dark" className="p-3">
							<div className="text-slate-300">{isBangla ? 'রাউন্ড' : 'Rounds'}</div>
							<div className="mt-1 font-pixel text-sm text-amber-300 tabular-nums">{summary.rounds}</div>
						</FlatWell>
						<FlatWell variant="dark" className="p-3">
							<div className="text-slate-300">{isBangla ? 'P1 চূড়ান্ত HP' : 'P1 Final HP'}</div>
							<div className="mt-1 font-pixel text-sm text-emerald-300 tabular-nums">
								{summary.p1EndHp}/{summary.p1MaxHp}
							</div>
						</FlatWell>
						<FlatWell variant="blue-dark" className="p-3">
							<div className="text-slate-300">{isBangla ? 'P2 চূড়ান্ত HP' : 'P2 Final HP'}</div>
							<div className="mt-1 font-pixel text-sm text-sky-300 tabular-nums">
								{summary.p2EndHp}/{summary.p2MaxHp}
							</div>
						</FlatWell>
						<FlatWell variant="dark" className="p-3">
							<div className="text-slate-300">{isBangla ? 'মোট অ্যাকশন' : 'Logged Actions'}</div>
							<div className="mt-1 font-pixel text-sm text-slate-200 tabular-nums">{summary.actionCount}</div>
						</FlatWell>
					</div>
				)}

				<div className="my-6 flex items-end justify-center gap-12">
					<FlatWell variant="gold-dark" className="flex flex-col items-center px-6 py-4">
						<PixelSprite
							characterId={winner === 1 ? p1Character : p2Character}
							animation="idle"
							integerScale={3}
							facing="right"
						/>
						<span className="mt-3 font-pixel text-xs text-emerald-300">
							{isBangla ? `বিজয়ী: ${winChar.name}` : `Winner: ${winChar.name}`}
						</span>
					</FlatWell>

					<FlatWell variant="dark" className="flex flex-col items-center px-6 py-4 opacity-85">
						<PixelSprite
							characterId={winner === 1 ? p2Character : p1Character}
							animation="death"
							integerScale={3}
							facing="left"
						/>
						<span className="mt-3 font-pixel text-xs text-slate-400">
							{isBangla ? `পরাজিত: ${loseChar.name}` : `Defeated: ${loseChar.name}`}
						</span>
					</FlatWell>
				</div>

				<FailedQuestionsReview
					quizHistory={summary?.quizHistory ?? []}
					seed={summary?.seed}
					localPlayerIndex={summary?.localPlayerIndex ?? 0}
					isHotseat={summary?.isHotseat ?? false}
					p1Name={summary?.p1Name ?? p1CharDisplay.name}
					p2Name={summary?.p2Name ?? p2CharDisplay.name}
				/>

				<div className="flex flex-wrap items-center justify-center gap-4 pt-4">
					<FlatButton
						variant="cream"
						size="lg"
						icon="play"
						onClick={() => {
							audioManager.playSfx('click')
							onRematch()
						}}
					>
						{isBangla ? 'আবার খেলুন (রিম্যাচ)' : 'Play Again (Rematch)'}
					</FlatButton>
					<FlatButton
						variant="silver"
						size="lg"
						icon="arrow"
						onClick={() => {
							audioManager.playSfx('click')
							onReturnSelect()
						}}
					>
						{isBangla ? 'চরিত্র নির্বাচন' : 'Character Select'}
					</FlatButton>
				</div>
			</FlatPanel>
		</div>
	)
}


