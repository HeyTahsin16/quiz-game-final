import {useLanguage} from '../../i18n/LanguageContext'
import {FlatBanner, FlatButton, FlatPanel, FlatWell} from '../components/FlatUi'

export interface CreditsScreenProps {
	onBackToMenu: () => void
}

interface AssetCreditItem {
	title: string
	author: string
	url: string
}

const ASSET_CREDITS: AssetCreditItem[] = [
	{
		title: 'Samurai 2D Pixel Art',
		author: 'xzany',
		url: 'https://xzany.itch.io/samurai-2d-pixel-art',
	},
	{
		title: 'Free Knight 2D Pixel Art',
		author: 'xzany',
		url: 'https://xzany.itch.io/free-knight-2d-pixel-art',
	},
	{
		title: 'Dark Ninja 2D Pixel Art Character Animation',
		author: 'zzzhen-z',
		url: 'https://zzzhen-z.itch.io/dark-ninja-2d-pixel-art-character-animation',
	},
	{
		title: 'Reaper Animated Pixel Art',
		author: 'samuellee',
		url: 'https://samuellee.itch.io/reaper-animated-pixel-art',
	},
	{
		title: 'Ultimate UI SFX Pack',
		author: 'JDSherbert',
		url: 'https://jdsherbert.itch.io/ultimate-ui-sfx-pack',
	},
	{
		title: 'Tiny RPG Dragon Regalia GUI',
		author: 'Tiopalada',
		url: 'https://tiopalada.itch.io/tiny-rpg-dragon-regalia-gui',
	},
]

const TEAM_CREDITS = [
	{roleEn: 'Lead Developer', roleBn: 'প্রধান ডেভেলপার (Lead Developer)', name: 'Tahsinnotfound'},
	{roleEn: 'Developer', roleBn: 'ডেভেলপার (Developer)', name: 'ifiwerenahiyan'},
	{roleEn: 'Beta Tester', roleBn: 'বেটা টেস্টার (Beta Tester)', name: 'Herman13'},
]

export function CreditsScreen({onBackToMenu}: CreditsScreenProps) {
	const {isBangla} = useLanguage()

	return (
		<div className="mx-auto max-w-[980px] space-y-6 px-6 py-8">
			<FlatPanel variant="gold" wellVariant="dark" wellClassName="p-6 md:p-8 space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
					<div>
						<FlatBanner variant="offset-bl">
							{isBangla ? 'কৃতজ্ঞতা ও স্বীকৃতি' : 'CREDITS & ATTRIBUTIONS'}
						</FlatBanner>
						<h1 className="mt-3 font-pixel text-xl text-white">
							{isBangla
								? 'Quiz Duel — 1v1 কৌশলগত STEM কার্ড ব্যাটলার'
								: 'Quiz Duel — 1v1 Tactical STEM Card Battler'}
						</h1>
					</div>
					<FlatButton variant="cream" size="sm" icon="arrow" onClick={onBackToMenu}>
						{isBangla ? 'প্রধান মেনু' : 'Main Menu'}
					</FlatButton>
				</div>

				{/* Development & Testing Team */}
				<div className="space-y-3">
					<FlatBanner variant="offset-bl" className="px-2 py-0.5 text-[10px]">
						{isBangla ? 'ডেভেলপমেন্ট টিম' : 'DEVELOPMENT TEAM'}
					</FlatBanner>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						{TEAM_CREDITS.map((member) => (
							<FlatWell key={member.roleEn} variant="gold-dark" className="space-y-1 p-4">
								<div className="font-mono text-[11px] uppercase tracking-wider text-amber-300/90">
									{isBangla ? member.roleBn : member.roleEn}
								</div>
								<div className="font-pixel text-sm text-white">{member.name}</div>
							</FlatWell>
						))}
					</div>
				</div>

				{/* Asset Attributions */}
				<div className="space-y-3">
					<FlatBanner variant="offset-bl" className="px-2 py-0.5 text-[10px]">
						{isBangla ? 'অ্যাসেট স্বীকৃতি' : 'ASSET ATTRIBUTIONS'}
					</FlatBanner>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						{ASSET_CREDITS.map((asset) => (
							<FlatWell key={asset.url} variant="blue-dark" className="flex flex-col justify-between gap-2 p-4">
								<div className="space-y-0.5">
									<div className="font-pixel text-xs text-sky-300">{asset.title}</div>
									<div className="font-mono text-[11px] text-slate-400">
										{isBangla ? `নির্মাতা: ${asset.author}` : `by ${asset.author}`}
									</div>
								</div>
								<a
									href={asset.url}
									target="_blank"
									rel="noopener noreferrer"
									className="break-all font-mono text-xs text-amber-300 underline decoration-amber-400/50 underline-offset-2 transition-colors hover:text-amber-200"
								>
									{asset.url}
								</a>
							</FlatWell>
						))}
					</div>
				</div>
			</FlatPanel>
		</div>
	)
}

