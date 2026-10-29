import {useState} from 'react'
import {audioManager} from '../../audio/audioManager'
import {buildCharacterDeck} from '../../content/decks'
import {CHARACTER_LIST, CHARACTERS, type CharacterId, ENGINE_CONFIG, SUBJECT_BORDER_PALETTE} from '../../engine/config'
import {getCharacterDisplay, SUBJECT_LABELS_BN, useLanguage} from '../../i18n/LanguageContext'
import {FlatBanner, FlatButton, FlatPanel, FlatWell} from '../components/FlatUi'
import {NineSliceCard} from '../components/NineSliceCard'
import {PixelSprite} from '../components/PixelSprite'

export interface CharacterSelectScreenProps {
	p1Character: CharacterId
	p2Character: CharacterId
	onSelectP1: (id: CharacterId) => void
	onSelectP2: (id: CharacterId) => void
	onProceedToLobby: () => void
	onStartQuickBattle: (mode: 'vs-bot' | 'hotseat-open') => void
	onBackToMenu?: () => void
}

const SIGNATURE_PREVIEW_CARDS: Record<
	CharacterId,
	{id: string; name: string; cost: number; rarity: 'epic' | 'legendary'; text: string}
> = {
	'dark-ninja': {
		id: 'C19',
		name: 'Corpse Explosion',
		cost: 3,
		rarity: 'legendary',
		text: 'Apply 6 Poison, then Poison burst. Exhaust.',
	},
	reaper: {
		id: 'B19',
		name: 'Phoenix',
		cost: 3,
		rarity: 'legendary',
		text: 'Once this battle, if your HP would reach 0, revive with 30% max HP.',
	},
	samurai: {
		id: 'M18',
		name: 'Bludgeon',
		cost: 3,
		rarity: 'epic',
		text: 'Deal 32 (40 with Samurai Maths Affinity!).',
	},
	knight: {
		id: 'P16',
		name: 'Barricade',
		cost: 3,
		rarity: 'epic',
		text: 'Your Block is no longer removed at the start of your turn. (P)',
	},
}

export function CharacterSelectScreen({
	p1Character,
	p2Character,
	onSelectP1,
	onSelectP2,
	onProceedToLobby,
	onStartQuickBattle,
	onBackToMenu,
}: CharacterSelectScreenProps) {
	const {lang, isBangla} = useLanguage()
	const [inspectDeckCharacter, setInspectDeckCharacter] = useState<CharacterId | null>(null)
	const [showModePrompt, setShowModePrompt] = useState<boolean>(false)

	const handleChoose = (seat: 1 | 2, id: CharacterId) => {
		audioManager.playSfx('click')
		if (seat === 1) {
			onSelectP1(id)
		} else {
			onSelectP2(id)
		}
	}

	const inspectedDeck = inspectDeckCharacter ? buildCharacterDeck(inspectDeckCharacter, 1337) : []
	const p1CharDisp = getCharacterDisplay(p1Character, CHARACTERS[p1Character], lang)
	const p2CharDisp = getCharacterDisplay(p2Character, CHARACTERS[p2Character], lang)

	return (
		<div className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
			{/* Top Header inside FlatPanel */}
			<FlatPanel
				variant="silver"
				wellVariant="dark"
				wellClassName="flex flex-wrap items-center justify-between gap-4 p-5"
			>
				<div>
					<FlatBanner variant="offset-bl">
						{isBangla ? 'আপনার চ্যাম্পিয়ন নির্বাচন করুন' : 'SELECT YOUR CHAMPION'}
					</FlatBanner>
					<p className="mt-2 text-sm text-slate-300">
						{isBangla
							? 'প্রতিটি যোদ্ধা একটি নির্দিষ্ট 24-কার্ডের ডেক নিয়ে আসে (10 দক্ষতা · 2 দুর্বলতা · 6/6 নিরপেক্ষ | 10 সাধারণ · 8 অসাধারণ · 4 এপিক · 2 কিংবদন্তি)।'
							: 'Each fighter brings a fixed 24-card deck (10 Affinity · 2 Weakness · 6/6 Neutral | 10 Normal · 8 Uncommon · 4 Epic · 2 Legendary).'}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					{onBackToMenu && (
						<FlatButton
							variant="cream"
							size="lg"
							icon="arrow"
							onClick={() => {
								audioManager.playSfx('click')
								onBackToMenu()
							}}
						>
							{isBangla ? 'প্রধান মেনু' : 'Main Menu'}
						</FlatButton>
					)}
					<FlatButton
						variant="blue"
						size="lg"
						icon="arrow"
						onClick={() => {
							audioManager.playSfx('click')
							onProceedToLobby()
						}}
					>
						{isBangla ? 'রুম লবি (অনলাইন / 6-অক্ষরের কোড)' : 'Room Lobby (Online / 6-Char Code)'}
					</FlatButton>
					<FlatButton
						variant="cream"
						size="lg"
						icon="play"
						onClick={() => {
							audioManager.playSfx('popup-open')
							setShowModePrompt(true)
						}}
					>
						{isBangla ? 'যুদ্ধক্ষেত্রে প্রবেশ করুন' : 'Enter Arena'}
					</FlatButton>
				</div>
			</FlatPanel>

			{/* 4 Character Cards using FlatPanel (Gold for P1, Blue for P2, Silver for Unselected) */}
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
				{CHARACTER_LIST.map((char) => {
					const isP1 = p1Character === char.id
					const isP2 = p2Character === char.id
					const affMeta = SUBJECT_BORDER_PALETTE[char.affinity]
					const weakMeta = SUBJECT_BORDER_PALETTE[char.weakness]
					const sigCard = SIGNATURE_PREVIEW_CARDS[char.id]
					const frameVariant = isP1 ? 'gold' : isP2 ? 'blue' : 'silver'
					const wellVariant = isP1 ? 'gold-dark' : isP2 ? 'blue-dark' : 'dark'
					const charDisp = getCharacterDisplay(char.id, char, lang)

					return (
						<FlatPanel
							key={char.id}
							variant={frameVariant}
							wellVariant={wellVariant}
							wellClassName="flex flex-col justify-between p-4"
						>
							<div>
								{/* Header & Seat Indicators */}
								<div className="flex items-start justify-between gap-2">
									<div>
										<h2 className="font-pixel text-sm" style={{color: char.accentHex}}>
											{charDisp.name}
										</h2>
										<div className="mt-0.5 text-xs text-slate-300">{charDisp.title}</div>
									</div>
									<div className="flex items-center gap-1.5 font-pixel text-[10px]">
										{isP1 && <span className="flat-slot-gold px-2 py-0.5 text-[#141824]">P1</span>}
										{isP2 && <span className="flat-slot-blue px-2 py-0.5 text-white">P2</span>}
									</div>
								</div>

								{/* Pixel Sprite Stage with Optional FlatUI Select Reticle */}
								<button
									type="button"
									onClick={() => handleChoose(1, char.id)}
									className="flat-slot-dark relative my-4 flex w-full cursor-pointer flex-col items-center justify-center py-5"
								>
									{(isP1 || isP2) && (
										<div
											className={`pointer-events-none absolute inset-1 ${
												isP1 ? 'flat-select-reticle' : 'flat-select-reticle-alt'
											}`}
										/>
									)}
									<PixelSprite characterId={char.id} integerScale={3} facing="right" animate />
								</button>

								{/* Bio */}
								<p className="text-xs leading-relaxed text-slate-200">{charDisp.bio}</p>

								{/* Subject Affinity & Weakness Table */}
								<FlatWell variant="dark" className="mt-3 space-y-1.5 p-2.5 text-xs">
									<div className="flex items-center justify-between">
										<span className="text-slate-400">
											{isBangla ? 'দক্ষতা (10টি কার্ড):' : 'Affinity (10 cards):'}
										</span>
										<span style={{color: affMeta.highlight}} className="font-semibold">
											{isBangla
												? `${SUBJECT_LABELS_BN[char.affinity].label} (${SUBJECT_LABELS_BN[char.affinity].role})`
												: `${affMeta.label} (${affMeta.role})`}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-slate-400">
											{isBangla ? 'দুর্বলতা (2টি কার্ড):' : 'Weakness (2 cards):'}
										</span>
										<span style={{color: weakMeta.highlight}} className="font-semibold">
											{isBangla ? SUBJECT_LABELS_BN[char.weakness].label : weakMeta.label}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-slate-400">
											{isBangla ? 'প্রারম্ভিক পরিসংখ্যান:' : 'Starting Stats:'}
										</span>
										<span className="font-mono text-slate-200 tabular-nums">
											{char.startingHp} HP · {ENGINE_CONFIG.startingMana}/{ENGINE_CONFIG.maxMana}{' '}
											{isBangla ? 'মানা' : 'Mana'}
										</span>
									</div>
								</FlatWell>

								{/* Signature Card Preview using 9-Slice Card Component */}
								<div className="mt-4 flex flex-col items-center pt-2">
									<FlatBanner variant="offset-bl" className="mb-2 px-2 py-0.5 text-[10px]">
										{isBangla ? 'সিগনেচার কার্ড' : 'Signature Card'}
									</FlatBanner>
									<NineSliceCard
										id={sigCard.id}
										name={sigCard.name}
										subject={char.affinity}
										rarity={sigCard.rarity}
										cost={sigCard.cost}
										text={sigCard.text}
										integerScale={2}
									/>
								</div>
							</div>

							{/* Seat Selection, Deck Viewer & Voice Test Controls */}
							<div className="mt-5 space-y-2 pt-2">
								<div className="grid grid-cols-2 gap-2">
									<FlatButton
										variant={isP1 ? 'gold' : 'cream'}
										size="sm"
										icon={isP1 ? 'check' : undefined}
										onClick={() => handleChoose(1, char.id)}
										className="w-full"
									>
										{isP1 ? (isBangla ? 'P1 নির্বাচিত' : 'P1 Selected') : isBangla ? 'P1 হিসেবে নিন' : 'Select as P1'}
									</FlatButton>
									<FlatButton
										variant={isP2 ? 'blue' : 'silver'}
										size="sm"
										icon={isP2 ? 'check' : undefined}
										onClick={() => handleChoose(2, char.id)}
										className="w-full"
									>
										{isP2 ? (isBangla ? 'P2 নির্বাচিত' : 'P2 Selected') : isBangla ? 'P2 হিসেবে নিন' : 'Select as P2'}
									</FlatButton>
								</div>

								<FlatButton
									variant="dark"
									size="sm"
									icon="point"
									onClick={() => {
										audioManager.playSfx('popup-open')
										setInspectDeckCharacter(char.id)
									}}
									className="w-full"
								>
									{isBangla ? '24-কার্ডের ডেক' : '24-Card Deck'}
								</FlatButton>
							</div>
						</FlatPanel>
					)
				})}
			</div>

			{/* 24-Card Fixed Deck Inspector Modal */}
			{inspectDeckCharacter && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
					<FlatPanel
						variant="gold"
						wellVariant="dark"
						className="max-h-[85vh] w-full max-w-[1140px] overflow-y-auto"
						wellClassName="p-6 space-y-5"
					>
						<div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
							<div>
								<FlatBanner variant="offset-bl">
									{getCharacterDisplay(inspectDeckCharacter, CHARACTERS[inspectDeckCharacter], lang).name} ·{' '}
									{isBangla ? 'নির্ধারিত 24-কার্ডের ডেক' : 'Fixed 24-Card Deck'}
								</FlatBanner>
								<div className="mt-2 text-xs text-slate-300">
									{isBangla
										? `10 ${SUBJECT_LABELS_BN[CHARACTERS[inspectDeckCharacter].affinity].label} (দক্ষতা) · 2 ${SUBJECT_LABELS_BN[CHARACTERS[inspectDeckCharacter].weakness].label} (দুর্বলতা) · 6 + 6 নিরপেক্ষ বিষয় | 10 সাধারণ · 8 অসাধারণ · 4 এপিক · 2 কিংবদন্তি`
										: `10 ${SUBJECT_BORDER_PALETTE[CHARACTERS[inspectDeckCharacter].affinity].label} (Affinity) · 2 ${SUBJECT_BORDER_PALETTE[CHARACTERS[inspectDeckCharacter].weakness].label} (Weakness) · 6 + 6 Neutral Subjects | 10 Normal · 8 Uncommon · 4 Epic · 2 Legendary`}
								</div>
							</div>
							<FlatButton
								variant="cream"
								size="sm"
								icon="cross"
								onClick={() => {
									audioManager.playSfx('popup-close')
									setInspectDeckCharacter(null)
								}}
							>
								{isBangla ? 'ডেক ভিউ বন্ধ করুন' : 'Close Deck View'}
							</FlatButton>
						</div>

						<div className="flex flex-wrap items-center justify-center gap-4 py-2">
							{inspectedDeck.map((card) => (
								<NineSliceCard
									key={card.instanceId}
									id={card.id}
									name={card.name}
									subject={card.subject}
									rarity={card.rarity}
									cost={card.cost}
									text={card.text}
									upgraded={card.upgraded}
									exhaust={card.exhaust}
									power={card.power}
									integerScale={2}
								/>
							))}
						</div>
					</FlatPanel>
				</div>
			)}

			{/* Pre-Battle Mode Selection Prompt Modal (Player vs Bot or 1v1 Local) */}
			{showModePrompt && (
				<div
					onClick={() => {
						audioManager.playSfx('popup-close')
						setShowModePrompt(false)
					}}
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
				>
					<div onClick={(e) => e.stopPropagation()} className="w-full max-w-[460px]">
						<FlatPanel variant="gold" wellVariant="dark" className="w-full" wellClassName="p-6 space-y-5">
							<div className="flex items-center justify-between border-b border-slate-800 pb-3">
								<FlatBanner variant="offset-bl">
									{isBangla ? 'যুদ্ধের মোড নির্বাচন করুন' : 'SELECT BATTLE MODE'}
								</FlatBanner>
								<FlatButton
									variant="dark"
									size="sm"
									icon="cross"
									onClick={() => {
										audioManager.playSfx('popup-close')
										setShowModePrompt(false)
									}}
								>
									{isBangla ? 'বাতিল' : 'Cancel'}
								</FlatButton>
							</div>

							<p className="text-xs leading-relaxed text-slate-300">
								{isBangla ? (
									<>
										আপনি কীভাবে খেলতে চান নির্বাচন করুন —{' '}
										<strong className="text-amber-300">{p1CharDisp.name}</strong> (P1) বনাম{' '}
										<strong className="text-sky-300">{p2CharDisp.name}</strong> (P2):
									</>
								) : (
									<>
										Choose how you want to play with <strong className="text-amber-300">{p1CharDisp.name}</strong> (P1)
										vs <strong className="text-sky-300">{p2CharDisp.name}</strong> (P2):
									</>
								)}
							</p>

							<div className="flex flex-col gap-3">
								<FlatButton
									variant="gold"
									size="lg"
									icon="play"
									onClick={() => {
										audioManager.playSfx('select')
										setShowModePrompt(false)
										onStartQuickBattle('vs-bot')
									}}
									className="w-full justify-center"
								>
									{isBangla ? 'প্লেয়ার বনাম বট (Player vs Bot)' : 'Player vs Bot'}
								</FlatButton>

								<FlatButton
									variant="blue"
									size="lg"
									icon="play"
									onClick={() => {
										audioManager.playSfx('select')
										setShowModePrompt(false)
										onStartQuickBattle('hotseat-open')
									}}
									className="w-full justify-center"
								>
									{isBangla ? '1v1 লোকাল (1v1 Local)' : '1v1 Local'}
								</FlatButton>
							</div>
						</FlatPanel>
					</div>
				</div>
			)}
		</div>
	)
}

