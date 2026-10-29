import {useState} from 'react'
import {audioManager} from '../../audio/audioManager'
import {useLanguage} from '../../i18n/LanguageContext'
import {FlatBanner, FlatButton, FlatPanel, FlatWell} from '../components/FlatUi'

export interface TitleScreenProps {
	onStartSelect: () => void
	onOpenCollection: () => void
	onOpenSettings: () => void
	onOpenCredits: () => void
}

export function TitleScreen({onStartSelect, onOpenCollection, onOpenSettings, onOpenCredits}: TitleScreenProps) {
	const {lang, isBangla, setLang} = useLanguage()
	const [isLangMenuOpen, setIsLangMenuOpen] = useState<boolean>(false)

	return (
		<div className="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-[#0e1320] px-4 py-2">
			{/* Atmospheric Pixel-Art Moon Arena Backdrop */}
			<div
				style={{
					backgroundImage: 'url("/assets/maps/moon.png")',
					backgroundSize: 'cover',
					backgroundPosition: 'center 72%',
				}}
				className="pixelated pointer-events-none absolute inset-0 opacity-35"
			/>
			<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b0f1a]/80 via-[#0e1320]/55 to-[#0b0f1a]/90" />

			{/* Single Centered Main Menu Box (Fits completely within mobile landscape without scrolling) */}
			<div className="relative z-10 w-full max-w-[380px]">
				<FlatPanel
					variant="silver"
					wellVariant="dark"
					wellClassName="flex flex-col items-stretch gap-2.5 p-4 sm:gap-3.5 sm:p-6"
				>
					<div className="mb-0.5 text-center sm:mb-1">
						<FlatBanner variant="offset-bl">{isBangla ? 'প্রধান মেনু' : 'MAIN MENU'}</FlatBanner>
					</div>

					<FlatButton
						variant="cream"
						size="lg"
						icon="play"
						onClick={() => {
							audioManager.playSfx('select')
							onStartSelect()
						}}
						className="w-full justify-center py-2 text-xs sm:py-3 sm:text-sm"
					>
						{isBangla ? 'খেলুন' : 'PLAY'}
					</FlatButton>

					<FlatButton
						variant="gold"
						size="lg"
						icon="point"
						onClick={() => {
							audioManager.playSfx('click')
							onOpenCollection()
						}}
						className="w-full justify-center py-2 text-xs sm:py-3 sm:text-sm"
					>
						{isBangla ? 'সংগ্রহ' : 'COLLECTION'}
					</FlatButton>

					<FlatButton
						variant="blue"
						size="lg"
						icon="stripe"
						onClick={() => {
							audioManager.playSfx('click')
							onOpenSettings()
						}}
						className="w-full justify-center py-2 text-xs sm:py-3 sm:text-sm"
					>
						{isBangla ? 'সেটিংস' : 'SETTINGS'}
					</FlatButton>

					<FlatButton
						variant="silver"
						size="lg"
						icon="arrow"
						onClick={() => {
							audioManager.playSfx('click')
							onOpenCredits()
						}}
						className="w-full justify-center py-2 text-xs sm:py-3 sm:text-sm"
					>
						{isBangla ? 'ক্রেডিটস' : 'CREDITS'}
					</FlatButton>
				</FlatPanel>
			</div>

			{/* Bottom-Left Translation Button holding English & Bangla */}
			<div className="absolute bottom-4 left-4 z-30 flex flex-col items-start gap-2 sm:bottom-6 sm:left-6">
				{isLangMenuOpen && (
					<FlatWell variant="dark" className="flex flex-col gap-1.5 p-2 shadow-2xl">
						<div className="px-1 font-pixel text-[9px] text-amber-300">
							{isBangla ? 'ভাষা নির্বাচন করুন' : 'SELECT LANGUAGE'}
						</div>
						<div className="flex items-center gap-1.5">
							<FlatButton
								variant={lang === 'en' ? 'gold' : 'dark'}
								size="sm"
								icon={lang === 'en' ? 'check' : undefined}
								onClick={() => {
									audioManager.playSfx('click')
									setLang('en')
									setIsLangMenuOpen(false)
								}}
							>
								English
							</FlatButton>
							<FlatButton
								variant={lang === 'bn' ? 'gold' : 'dark'}
								size="sm"
								icon={lang === 'bn' ? 'check' : undefined}
								onClick={() => {
									audioManager.playSfx('click')
									setLang('bn')
									setIsLangMenuOpen(false)
								}}
							>
								বাংলা (Bangla)
							</FlatButton>
						</div>
					</FlatWell>
				)}

				<div className="flex items-center gap-1.5">
					<FlatButton
						variant="gold"
						size="sm"
						icon="point"
						onClick={() => {
							audioManager.playSfx('click')
							setIsLangMenuOpen((prev) => !prev)
						}}
					>
						{isBangla ? 'ভাষা / Translation: বাংলা' : 'Translation: English / বাংলা'}
					</FlatButton>
				</div>
			</div>
		</div>
	)
}
