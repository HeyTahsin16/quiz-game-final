import {useMemo, useState} from 'react'
import {audioManager} from '../../audio/audioManager'
import {CATALOG_CARDS} from '../../content/cards'
import {buildCharacterDeck} from '../../content/decks'
import {QUESTION_BANK} from '../../content/questions'
import {
	CHARACTER_LIST,
	CHARACTERS,
	type CharacterId,
	RARITY_LIST,
	type Rarity,
	SUBJECT_BORDER_PALETTE,
	SUBJECT_LIST,
	type Subject,
} from '../../engine/config'
import {translateAttributeSummary} from '../../i18n/attributeTranslations'
import {translateCardText} from '../../i18n/cardTranslations'
import {getCharacterDisplay, RARITY_LABELS_BN, SUBJECT_LABELS_BN, useLanguage} from '../../i18n/LanguageContext'
import {localizeQuestion} from '../../i18n/questionTranslations'
import {FlatBanner, FlatButton, FlatPanel, FlatWell} from '../components/FlatUi'
import {MathText} from '../components/MathText'
import {NineSliceCard} from '../components/NineSliceCard'
import {PixelSprite} from '../components/PixelSprite'

export interface CollectionScreenProps {
	onBackToMenu?: () => void
}

export interface AttributeEntry {
	badge: string
	name: string
	category: 'mechanic' | 'permanent' | 'buff' | 'debuff'
	summary: string
}

const ATTRIBUTE_ENTRIES: AttributeEntry[] = [
	// Core Card Mechanics & Keywords
	{
		badge: 'BLOCK',
		name: 'Block',
		category: 'mechanic',
		summary:
			'Absorbs incoming attack damage before HP is lost. Resets to 0 at the start of your next turn unless preserved by Barricade or Blur.',
	},
	{
		badge: 'DRAW',
		name: 'Draw',
		category: 'mechanic',
		summary:
			'Draws cards from your Draw Pile into your Hand (max 10 cards in hand). When the Draw Pile is empty, your Discard Pile automatically shuffles into a new Draw Pile.',
	},
	{
		badge: 'EXHAUST',
		name: 'Exhaust',
		category: 'mechanic',
		summary:
			'When resolved, the card is moved to the Exhaust Pile for the rest of the battle instead of going to the Discard Pile.',
	},
	{
		badge: 'POWER (P)',
		name: 'Power Card',
		category: 'mechanic',
		summary:
			'Grants a persistent passive ability for the remainder of the duel. Power cards only take effect after being played and automatically Exhaust.',
	},
	{
		badge: 'UPGRADE (+)',
		name: 'Upgraded Card (+)',
		category: 'mechanic',
		summary:
			'Enhanced Frame B version of a card. Every 4 correct STEM quiz answers upgrades a random card in your deck (+damage, +block, +stacks, or reduced Mana cost).',
	},
	{
		badge: 'MANA',
		name: 'Mana',
		category: 'mechanic',
		summary:
			'Action points used to throw cards (refills to 3 Mana at the start of each turn). Cards cost 0–3 Mana to throw.',
	},
	{
		badge: 'STEAL',
		name: 'Life Steal',
		category: 'mechanic',
		summary:
			'Heals your fighter based on unblocked damage dealt to the opponent. Negated while afflicted by Hemostasis (NO-STEAL).',
	},
	{
		badge: 'TRUE DMG',
		name: 'True Damage / HP Loss',
		category: 'mechanic',
		summary: 'Bypasses the target’s Block completely and subtracts directly from HP.',
	},
	{
		badge: 'CURE',
		name: 'Cure',
		category: 'mechanic',
		summary:
			'Biology cleansing mechanic that removes active debuffs (Poison, Parasite, Weak, Vulnerable, Corrode, Anti-heal, Hemostasis, and Strength loss).',
	},
	{
		badge: 'BURST',
		name: 'Poison Burst',
		category: 'mechanic',
		summary: 'Deals immediate damage equal to the opponent’s current Poison stacks.',
	},
	{
		badge: 'AFFINITY',
		name: 'Subject Affinity & Weakness',
		category: 'mechanic',
		summary:
			'Cards matching your champion’s Affinity gain +25% outgoing effect and reduce incoming damage of that subject by 25%. Weakness cards deal -25% outgoing and take +25% incoming.',
	},
	{
		badge: 'DEFENSE',
		name: 'Quiz Defense (Nullify / 35%)',
		category: 'mechanic',
		summary:
			'Answering a thrown card’s STEM quiz correctly within the timer completely nullifies Normal & Uncommon cards, or reduces Epic & Legendary cards to 35% power.',
	},

	// Permanent Powers
	{
		badge: 'STR',
		name: 'Strength',
		category: 'permanent',
		summary:
			'Adds +N damage to every attack hit you deal for the rest of the battle. Can become negative if reduced by debuffs.',
	},
	{
		badge: 'DEMON',
		name: 'Demon Form (P)',
		category: 'permanent',
		summary: 'Gain +N Strength automatically at the start of each of your turns.',
	},
	{
		badge: 'METAL',
		name: 'Metallicize (P)',
		category: 'permanent',
		summary: 'Gain N Block automatically at the end of each of your turns.',
	},
	{
		badge: 'BARRICADE',
		name: 'Barricade (P)',
		category: 'permanent',
		summary: 'Your Block is never removed at the start of your turn for the rest of the battle.',
	},
	{
		badge: 'JUGG',
		name: 'Juggernaut (P)',
		category: 'permanent',
		summary: 'Whenever you gain Block, automatically deal N damage to the opponent.',
	},
	{
		badge: 'FUMES',
		name: 'Noxious Fumes (P)',
		category: 'permanent',
		summary: 'Apply N Poison to the opponent automatically at the start of each of your turns.',
	},
	{
		badge: 'ENVENOM',
		name: 'Envenom (P)',
		category: 'permanent',
		summary: 'Whenever your attack deals unblocked damage, apply N Poison to the opponent.',
	},
	{
		badge: 'REPAIR',
		name: 'Self-Repair (P)',
		category: 'permanent',
		summary: 'Heal N HP automatically at the end of each of your turns.',
	},
	{
		badge: 'PHOENIX',
		name: 'Phoenix (P)',
		category: 'permanent',
		summary: 'Once this battle, if your HP would reach 0, immediately revive at 30% (or 45%+) of your Max HP.',
	},

	// Buffs
	{
		badge: 'FLEX',
		name: 'Temporary Strength',
		category: 'buff',
		summary: 'Gain +N Strength for the current turn only; removed at the end of the turn.',
	},
	{
		badge: 'BLUR',
		name: 'Blur (1-Turn Barricade)',
		category: 'buff',
		summary: 'Your Block is not removed at the start of your next turn.',
	},
	{
		badge: 'COAT',
		name: 'Venomous Coat',
		category: 'buff',
		summary: 'Your next unblocked attack hit applies +N Poison to the opponent.',
	},
	{
		badge: 'WARD',
		name: 'Ward',
		category: 'buff',
		summary: 'Negates and blocks the next N debuff applications targeting you.',
	},
	{
		badge: 'REFLECT',
		name: 'Reflect (Mirror Calculus)',
		category: 'buff',
		summary: 'Until your next turn, reflects P% of attack damage taken back at the attacker.',
	},
	{
		badge: 'APPARITION',
		name: 'Apparition',
		category: 'buff',
		summary: 'Until the start of your next turn, any single hit or HP loss you take is reduced to at most 1 HP.',
	},
	{
		badge: '2X TAP',
		name: 'Double Tap',
		category: 'buff',
		summary: 'Your next Maths attack card played this turn resolves twice.',
	},
	{
		badge: 'REGEN',
		name: 'Regeneration',
		category: 'buff',
		summary: 'Heal N HP at the start of each of your turns for R rounds.',
	},
	{
		badge: 'HIBERNATE',
		name: 'Hibernate (Next Turn Heal)',
		category: 'buff',
		summary: 'Heal N HP at the start of your next turn.',
	},
	{
		badge: 'CHARGE',
		name: 'Next Turn Mana',
		category: 'buff',
		summary: 'Gain +N bonus Mana at the start of your next turn.',
	},
	{
		badge: 'STUN-IMM',
		name: 'Stun Immune',
		category: 'buff',
		summary: 'Cannot be Stunned for N rounds (automatically granted for 2 rounds after recovering from Stun).',
	},

	// Debuffs
	{
		badge: 'POISON',
		name: 'Poison',
		category: 'debuff',
		summary: 'Lose N HP (ignores Block) at the start of your turn, then Poison decreases by 1.',
	},
	{
		badge: 'PARASITE',
		name: 'Parasite',
		category: 'debuff',
		summary:
			'Lose N HP (ignores Block) at the start of your turn, then Parasite increases by 1 each turn! Only a Biology Cure removes it.',
	},
	{
		badge: 'WEAK',
		name: 'Weak',
		category: 'debuff',
		summary: 'Deal 25% less attack damage for N rounds.',
	},
	{
		badge: 'VULN',
		name: 'Vulnerable',
		category: 'debuff',
		summary: 'Take 50% more attack damage for N rounds.',
	},
	{
		badge: 'CORRODE',
		name: 'Corrode',
		category: 'debuff',
		summary: 'Gain 25% less Block from cards for N rounds.',
	},
	{
		badge: 'ANTI-HEAL',
		name: 'Anti-Heal',
		category: 'debuff',
		summary: 'All healing received is reduced by 50% for N rounds.',
	},
	{
		badge: 'NO-STEAL',
		name: 'Hemostasis (No Life Steal)',
		category: 'debuff',
		summary: 'Life Steal effects heal 0 HP for N rounds.',
	},
	{
		badge: 'STUNNED',
		name: 'Stun',
		category: 'debuff',
		summary: 'Your next turn is skipped, then you gain Stun Immune for 2 rounds.',
	},
]

export function CollectionScreen({onBackToMenu}: CollectionScreenProps) {
	const {lang, isBangla} = useLanguage()
	const [activeTab, setActiveTab] = useState<'cards' | 'decks' | 'questions' | 'attributes'>('cards')
	const [attributeFilter, setAttributeFilter] = useState<'all' | AttributeEntry['category']>('all')
	const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>('all')
	const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all')
	const [showUpgraded, setShowUpgraded] = useState<boolean>(false)
	const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>('dark-ninja')
	const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({})

	const toggleExplanation = (questionId: string) => {
		audioManager.playSfx('click')
		setOpenExplanations((prev) => ({
			...prev,
			[questionId]: !prev[questionId],
		}))
	}

	const filteredCards = useMemo(() => {
		return CATALOG_CARDS.filter((card) => {
			if (subjectFilter !== 'all' && card.subject !== subjectFilter) return false
			if (rarityFilter !== 'all' && card.rarity !== rarityFilter) return false
			return true
		})
	}, [rarityFilter, subjectFilter])

	const characterDeck = useMemo(() => {
		return buildCharacterDeck(selectedCharacter, 1337)
	}, [selectedCharacter])

	const filteredQuestions = useMemo(() => {
		return QUESTION_BANK.filter((q) => {
			if (subjectFilter !== 'all' && q.subject !== subjectFilter) return false
			if (rarityFilter !== 'all' && q.rarity !== rarityFilter) return false
			return true
		})
	}, [rarityFilter, subjectFilter])

	const filteredAttributes = useMemo(() => {
		if (attributeFilter === 'all') return ATTRIBUTE_ENTRIES
		return ATTRIBUTE_ENTRIES.filter((entry) => entry.category === attributeFilter)
	}, [attributeFilter])

	const activeCharMeta = CHARACTERS[selectedCharacter]
	const activeCharDisplay = getCharacterDisplay(selectedCharacter, activeCharMeta, lang)

	return (
		<div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6">
			{/* Top Mode Switcher Bar */}
			<FlatPanel
				variant="silver"
				wellVariant="dark"
				wellClassName="flex flex-wrap items-center justify-between gap-4 p-4"
			>
				<div className="flex flex-wrap items-center gap-2.5">
					{onBackToMenu && (
						<FlatButton variant="cream" size="md" icon="arrow" onClick={onBackToMenu}>
							{isBangla ? 'প্রধান মেনু' : 'Main Menu'}
						</FlatButton>
					)}
					<FlatButton
						variant={activeTab === 'cards' ? 'gold' : 'dark'}
						size="md"
						onClick={() => {
							audioManager.playSfx('click')
							setActiveTab('cards')
						}}
					>
						{isBangla ? `80-কার্ড ক্যাটালগ (${CATALOG_CARDS.length})` : `80-Card Catalog (${CATALOG_CARDS.length})`}
					</FlatButton>
					<FlatButton
						variant={activeTab === 'decks' ? 'gold' : 'dark'}
						size="md"
						onClick={() => {
							audioManager.playSfx('click')
							setActiveTab('decks')
						}}
					>
						{isBangla ? 'চ্যাম্পিয়ন 24-কার্ড ডেক (4)' : 'Champion 24-Card Decks (4)'}
					</FlatButton>
					<FlatButton
						variant={activeTab === 'questions' ? 'gold' : 'dark'}
						size="md"
						onClick={() => {
							audioManager.playSfx('click')
							setActiveTab('questions')
						}}
					>
						{isBangla ? `${QUESTION_BANK.length} STEM প্রশ্ন ব্যাংক` : `${QUESTION_BANK.length} STEM Question Bank`}
					</FlatButton>
					<FlatButton
						variant={activeTab === 'attributes' ? 'gold' : 'dark'}
						size="md"
						onClick={() => {
							audioManager.playSfx('click')
							setActiveTab('attributes')
						}}
					>
						{isBangla ? `অ্যাট্রিবিউটস (${ATTRIBUTE_ENTRIES.length})` : `Attributes (${ATTRIBUTE_ENTRIES.length})`}
					</FlatButton>
				</div>
			</FlatPanel>

			{/* Filter Bar for Cards & Questions */}
			{(activeTab === 'cards' || activeTab === 'questions') && (
				<FlatPanel
					variant="blue"
					wellVariant="blue-dark"
					wellClassName="flex flex-wrap items-center justify-between gap-4 p-4"
				>
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-pixel text-[10px] text-slate-300">{isBangla ? 'বিষয়:' : 'SUBJECT:'}</span>
						<FlatButton
							variant={subjectFilter === 'all' ? 'cream' : 'dark'}
							size="sm"
							onClick={() => {
								audioManager.playSfx('click')
								setSubjectFilter('all')
							}}
						>
							{isBangla ? 'সব (4)' : 'All (4)'}
						</FlatButton>
						{SUBJECT_LIST.map((subj) => (
							<FlatButton
								key={subj}
								variant={subjectFilter === subj ? 'gold' : 'dark'}
								size="sm"
								onClick={() => {
									audioManager.playSfx('click')
									setSubjectFilter(subj)
								}}
							>
								{isBangla ? SUBJECT_LABELS_BN[subj].label : SUBJECT_BORDER_PALETTE[subj].label}
							</FlatButton>
						))}
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<span className="font-pixel text-[10px] text-slate-300">{isBangla ? 'রেয়ারিটি:' : 'RARITY:'}</span>
						<FlatButton
							variant={rarityFilter === 'all' ? 'cream' : 'dark'}
							size="sm"
							onClick={() => {
								audioManager.playSfx('click')
								setRarityFilter('all')
							}}
						>
							{isBangla ? 'সব' : 'All'}
						</FlatButton>
						{RARITY_LIST.map((rar) => (
							<FlatButton
								key={rar}
								variant={rarityFilter === rar ? 'blue' : 'dark'}
								size="sm"
								onClick={() => {
									audioManager.playSfx('click')
									setRarityFilter(rar)
								}}
							>
								{isBangla ? RARITY_LABELS_BN[rar] : rar.toUpperCase()}
							</FlatButton>
						))}
					</div>

					{activeTab === 'cards' && (
						<FlatButton
							variant={showUpgraded ? 'gold' : 'silver'}
							size="sm"
							icon={showUpgraded ? 'check' : 'plus'}
							onClick={() => {
								audioManager.playSfx('click')
								setShowUpgraded((prev) => !prev)
							}}
						>
							{showUpgraded
								? isBangla
									? 'আপগ্রেডেড (+) দেখানো হচ্ছে'
									: 'Showing Upgraded (+)'
								: isBangla
									? 'আপগ্রেডেড (+) দেখান'
									: 'Show Upgraded (+)'}
						</FlatButton>
					)}
				</FlatPanel>
			)}

			{/* TAB 1: 80-Card Catalog Grid */}
			{activeTab === 'cards' && (
				<FlatPanel variant="silver" wellVariant="dark" wellClassName="p-6 space-y-5">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
						<FlatBanner variant="offset-bl">
							{isBangla
								? `80টি কার্ডের মধ্যে ${filteredCards.length}টি দেখানো হচ্ছে (${showUpgraded ? 'FRAME B · আপগ্রেডেড +' : 'FRAME A · বেস'})`
								: `SHOWING ${filteredCards.length} OF 80 CARDS (${showUpgraded ? 'FRAME B · UPGRADED +' : 'FRAME A · BASE'})`}
						</FlatBanner>
						<span className="text-xs text-slate-300">
							{isBangla
								? 'সঠিক কুইজ উত্তরে Normal ও Uncommon কার্ড সম্পূর্ণ বাতিল হয়; Epic ও Legendary কার্ডের প্রভাব কমে 35% হয়।'
								: 'Normal & Uncommon cards nullify on a correct quiz answer; Epic & Legendary cards resolve their 35% reduced effect.'}
						</span>
					</div>

					<div className="flex flex-wrap items-start justify-center gap-5 py-2">
						{filteredCards.map((baseDef) => {
							const def = showUpgraded ? baseDef.upgrade(baseDef) : baseDef
							return (
								<div key={def.id} className="flex flex-col items-center gap-2">
									<NineSliceCard
										id={def.id}
										name={def.name}
										subject={def.subject}
										rarity={def.rarity}
										cost={def.cost}
										text={def.text}
										upgraded={showUpgraded}
										exhaust={def.exhaust}
										power={def.power}
										integerScale={2}
										scaleMultiplier={1.2}
									/>
									{def.reducedText && (
										<div className="w-[154px] text-center font-mono text-[10px] text-amber-300/90">
											{isBangla
												? `কুইজ প্রতিরক্ষায়: ${translateCardText(def.reducedText, lang)}`
												: `Quiz Defended: ${def.reducedText}`}
										</div>
									)}
								</div>
							)
						})}
					</div>
				</FlatPanel>
			)}

			{/* TAB 2: Champion 24-Card Decks */}
			{activeTab === 'decks' && (
				<div className="space-y-6">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{CHARACTER_LIST.map((char) => {
							const isSelected = char.id === selectedCharacter
							const charDisplay = getCharacterDisplay(char.id, char, lang)
							return (
								<FlatPanel
									key={char.id}
									variant={isSelected ? 'gold' : 'silver'}
									wellVariant={isSelected ? 'gold-dark' : 'dark'}
									wellClassName="p-4 flex flex-col justify-center"
								>
									<button
										type="button"
										onClick={() => {
											audioManager.playSfx('select')
											setSelectedCharacter(char.id)
										}}
										className="flex w-full cursor-pointer items-center gap-3.5 text-left"
									>
										<PixelSprite characterId={char.id} integerScale={2} facing="right" />
										<div>
											<div className="font-pixel text-xs" style={{color: char.accentHex}}>
												{charDisplay.name}
											</div>
											<div className="mt-0.5 text-[11px] text-slate-300">{charDisplay.title}</div>
											<div className="mt-1 text-[11px] text-slate-400">
												{isBangla ? 'আসক্তি:' : 'Aff:'} {SUBJECT_BORDER_PALETTE[char.affinity].shortCode} ·{' '}
												{isBangla ? 'দুর্বলতা:' : 'Weak:'} {SUBJECT_BORDER_PALETTE[char.weakness].shortCode}
											</div>
										</div>
									</button>
								</FlatPanel>
							)
						})}
					</div>

					<FlatPanel variant="gold" wellVariant="dark" wellClassName="p-6 space-y-5">
						<div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
							<div>
								<FlatBanner variant="offset-bl">
									{isBangla
										? `${activeCharDisplay.name} · নির্ধারিত 24-কার্ডের শুরুর ডেক`
										: `${activeCharMeta.name.toUpperCase()} · FIXED 24-CARD STARTING DECK`}
								</FlatBanner>
								<p className="mt-2 text-xs text-slate-300">
									{isBangla ? (
										<>
											10 {SUBJECT_LABELS_BN[activeCharMeta.affinity].label} (আসক্তি +25% আউট / -25% ইন) · 2{' '}
											{SUBJECT_LABELS_BN[activeCharMeta.weakness].label} (দুর্বলতা -25% আউট / +25% ইন) · 6 + 6 নিরপেক্ষ |
											10 সাধারণ · 8 অসাধারণ · 4 এপিক · 2 কিংবদন্তি
										</>
									) : (
										<>
											10 {SUBJECT_BORDER_PALETTE[activeCharMeta.affinity].label} (Affinity +25% Out / -25% In) · 2{' '}
											{SUBJECT_BORDER_PALETTE[activeCharMeta.weakness].label} (Weakness -25% Out / +25% In) · 6 + 6
											Neutral | 10 Normal · 8 Uncommon · 4 Epic · 2 Legendary
										</>
									)}
								</p>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-center gap-4 py-2">
							{characterDeck.map((card) => (
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
									scaleMultiplier={1.2}
								/>
							))}
						</div>
					</FlatPanel>
				</div>
			)}

			{/* TAB 3: 320 STEM Question Bank */}
			{activeTab === 'questions' && (
				<FlatPanel variant="silver" wellVariant="dark" wellClassName="p-6 space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
						<FlatBanner variant="offset-bl">
							{isBangla
								? `STEM প্রশ্ন সংগ্রহশালা (${QUESTION_BANK.length}-এর মধ্যে ${filteredQuestions.length}টি)`
								: `STEM QUESTION ARCHIVE (${filteredQuestions.length} OF ${QUESTION_BANK.length})`}
						</FlatBanner>
						<span className="text-xs text-slate-300">
							{isBangla
								? 'যুদ্ধের সময় প্রতিটি ম্যাচের সিড অনুযায়ী উত্তরের অপশনগুলো স্বয়ংক্রিয়ভাবে এলোমেলো (shuffle) করা হয়।'
								: 'During battle, answer choices are deterministically shuffled per match seed.'}
						</span>
					</div>

					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						{filteredQuestions.map((rawQ) => {
							const q = localizeQuestion(rawQ, lang)
							const isExplanationOpen = !!openExplanations[q.id]
							return (
								<FlatWell key={q.id} variant="dark" className="space-y-2.5 p-4">
									<div className="flex items-center justify-between gap-2 text-xs">
										<span className="font-pixel text-[11px]" style={{color: SUBJECT_BORDER_PALETTE[q.subject].highlight}}>
											{q.id} ·{' '}
											{isBangla
												? `${SUBJECT_LABELS_BN[q.subject].label} (${RARITY_LABELS_BN[q.rarity]})`
												: `${SUBJECT_BORDER_PALETTE[q.subject].label.toUpperCase()} (${q.rarity.toUpperCase()})`}
										</span>
										<div className="flex items-center gap-2">
											<span className="font-mono text-xs text-slate-400 tabular-nums">
												{isBangla ? `${q.timerSeconds}s টাইমার` : `${q.timerSeconds}s Timer`}
											</span>
											{q.explanation && (
												<FlatButton
													variant={isExplanationOpen ? 'gold' : 'silver'}
													size="sm"
													onClick={() => toggleExplanation(q.id)}
												>
													{isExplanationOpen
														? isBangla
															? 'ব্যাখ্যা লুকান'
															: 'Hide Explanation'
														: isBangla
															? 'ব্যাখ্যা'
															: 'Explanation'}
												</FlatButton>
											)}
										</div>
									</div>
									<p className="text-base leading-relaxed font-semibold text-white">
										<MathText text={q.prompt} />
									</p>
									<div className="grid grid-cols-2 gap-2 pt-1 text-sm">
										{q.choices.map((choice, idx) => (
											<div
												key={`${q.id}-${idx}`}
												className={`px-2.5 py-1.5 font-mono ${
													idx === q.correctIndex ? 'text-emerald-300 font-bold' : 'text-slate-300'
												}`}
											>
												{String.fromCharCode(65 + idx)}. <MathText text={choice} />
											</div>
										))}
									</div>
									{isExplanationOpen && q.explanation && (
										<div className="mt-2 border-t border-slate-700/80 bg-slate-900/80 px-3.5 py-3 text-sm leading-relaxed text-amber-200">
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
				</FlatPanel>
			)}

			{/* TAB 4: Attributes (Card Mechanics, Permanent Powers, Buffs, & Debuffs) */}
			{activeTab === 'attributes' && (
				<div className="space-y-5">
					<FlatPanel
						variant="blue"
						wellVariant="blue-dark"
						wellClassName="flex flex-wrap items-center justify-between gap-3 p-4"
					>
						<div className="flex flex-wrap items-center gap-2">
							<span className="font-pixel text-[10px] text-slate-300">{isBangla ? 'বিভাগ:' : 'CATEGORY:'}</span>
							<FlatButton
								variant={attributeFilter === 'all' ? 'cream' : 'dark'}
								size="sm"
								onClick={() => {
									audioManager.playSfx('click')
									setAttributeFilter('all')
								}}
							>
								{isBangla ? `সব (${ATTRIBUTE_ENTRIES.length})` : `All (${ATTRIBUTE_ENTRIES.length})`}
							</FlatButton>
							<FlatButton
								variant={attributeFilter === 'mechanic' ? 'gold' : 'dark'}
								size="sm"
								onClick={() => {
									audioManager.playSfx('click')
									setAttributeFilter('mechanic')
								}}
							>
								Card Mechanics (12)
							</FlatButton>
							<FlatButton
								variant={attributeFilter === 'permanent' ? 'gold' : 'dark'}
								size="sm"
								onClick={() => {
									audioManager.playSfx('click')
									setAttributeFilter('permanent')
								}}
							>
								Permanent Powers (9)
							</FlatButton>
							<FlatButton
								variant={attributeFilter === 'buff' ? 'blue' : 'dark'}
								size="sm"
								onClick={() => {
									audioManager.playSfx('click')
									setAttributeFilter('buff')
								}}
							>
								Buffs (11)
							</FlatButton>
							<FlatButton
								variant={attributeFilter === 'debuff' ? 'silver' : 'dark'}
								size="sm"
								onClick={() => {
									audioManager.playSfx('click')
									setAttributeFilter('debuff')
								}}
							>
								Debuffs (8)
							</FlatButton>
						</div>
					</FlatPanel>

					<FlatPanel variant="silver" wellVariant="dark" wellClassName="p-6 space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
							<FlatBanner variant="offset-bl">
								{isBangla
									? `ATTRIBUTES & STATUS EFFECTS (${ATTRIBUTE_ENTRIES.length}-এর মধ্যে ${filteredAttributes.length}টি)`
									: `ATTRIBUTES & STATUS EFFECTS (${filteredAttributes.length} OF ${ATTRIBUTE_ENTRIES.length})`}
							</FlatBanner>
							<span className="text-xs text-slate-300">
								{isBangla
									? 'কার্ড মেকানিক, স্থায়ী পাওয়ার, টার্ন বাফ এবং রাউন্ড-ভিত্তিক ডিবফের সম্পূর্ণ নির্দেশিকা।'
									: 'Complete reference of card keywords, permanent powers, turn buffs, and round-decaying debuffs.'}
							</span>
						</div>

						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							{filteredAttributes.map((attr) => {
								const badgeClass =
									attr.category === 'debuff'
										? 'flat-slot-orange text-white'
										: attr.category === 'permanent'
											? 'flat-slot-gold text-[#141824]'
											: attr.category === 'buff'
												? 'flat-slot-blue text-white'
												: 'flat-slot-dark border border-amber-400/50 text-amber-300'

								const categoryLabel =
									attr.category === 'mechanic'
										? 'CARD MECHANIC'
										: attr.category === 'permanent'
											? 'PERMANENT POWER (P)'
											: attr.category === 'buff'
												? 'BUFF'
												: 'DEBUFF'

								return (
									<FlatWell key={`${attr.category}-${attr.badge}`} variant="dark" className="space-y-2 p-4">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div className="flex items-center gap-2.5">
												<span className={`inline-flex items-center px-2 py-0.5 font-pixel text-[10px] ${badgeClass}`}>
													{attr.badge}
												</span>
												<span className="font-pixel text-xs text-white">{attr.name}</span>
											</div>
											<span className="font-mono text-[10px] tracking-wider text-slate-400">{categoryLabel}</span>
										</div>
										<p className="text-xs leading-relaxed text-slate-200">
											{translateAttributeSummary(attr.badge, attr.summary, lang)}
										</p>
									</FlatWell>
								)
							})}
						</div>
					</FlatPanel>
				</div>
			)}
		</div>
	)
}
