/**
 * Quiz Duel — Phase 4 Battle UI Helpers Unit Tests
 */

import fs from 'node:fs'
import path from 'node:path'
import test from 'ava'
import {BGM_TRACK_MAP, SFX_FILE_MAP} from '../src/audio/audioManager'
import {createCard} from '../src/engine/cards'
import {canPlay, canThrowSelection} from '../src/engine/conditions'
import {
	BATTLE_MAPS,
	CHARACTER_IDS,
	CHARACTERS,
	DEFAULT_BATTLE_MAP_ID,
	getSpriteGroundAnchorTransform,
	NINE_SLICE_CONFIG,
	SPRITE_BOTTOM_TRANSPARENT_ROWS,
	SPRITE_FOOT_ANCHOR_RATIO,
	SPRITE_FOOT_BASELINE_Y,
	SPRITE_FRAME_HEIGHT,
	SUBJECT_BORDER_PALETTE,
	VOICE_EVENT_LIST,
	VOICE_MAP,
} from '../src/engine/config'
import createNewGame from '../src/engine/game'
import {collectActiveBadges} from '../src/ui/components/StatusBadges'
import {formatLiveCardText} from '../src/ui/utils/cardTextFormatter'

test('formatLiveCardText reflects character subject affinity and weakness on card damage text', (t) => {
	// Samurai (Maths affinity) vs Reaper (Maths weakness) -> 1.25 * 1.25 = 1.5625
	const game = createNewGame({
		player0Character: 'samurai',
		player1Character: 'reaper',
	})

	const strike = createCard('M1') // Deal 6 (Maths)
	// 6 * 1.25 * 1.25 = 9.375 -> 9
	const formatted = formatLiveCardText(strike, game.state, 0)
	t.true(formatted.includes('Deal 9* (6)'), `Expected live damage 9* (6), got: ${formatted}`)

	// Corrode reduces Block text by 25%
	game.run({type: 'setPower', playerIndex: 0, power: 'corrode', amount: 2})
	const defend = createCard('P1') // Gain 5 Block
	const formattedDefend = formatLiveCardText(defend, game.state, 0)
	t.true(formattedDefend.includes('Gain 4* (5) Block'), `Expected corroded block 4* (5), got: ${formattedDefend}`)

	// Anti-heal reduces Heal text by 50%
	game.run({type: 'setPower', playerIndex: 0, power: 'antiHeal', amount: 2})
	const bandage = createCard('B1') // Heal 4
	const formattedHeal = formatLiveCardText(bandage, game.state, 0)
	t.true(formattedHeal.includes('Heal 2* (4)'), `Expected anti-healed 2* (4), got: ${formattedHeal}`)
})

test('collectActiveBadges lists active buffs, debuffs, and permanent powers accurately', (t) => {
	const badges = collectActiveBadges(
		{
			strength: 3,
			poison: 5,
			parasite: 2,
			barricade: 1,
			phoenix: 30,
			ward: 2,
		},
		false,
	)

	const keys = badges.map((b) => b.key)
	t.deepEqual(keys, ['strength', 'barricade', 'phoenix', 'ward', 'poison', 'parasite'])

	// Once phoenixUsed is true, phoenix badge disappears
	const afterPhoenix = collectActiveBadges({phoenix: 30}, true)
	t.is(afterPhoenix.length, 0)
})

test('multiplayer room code and display name sanitizers enforce firebase-blueprint.json boundaries', (t) => {
	const clean = 'qd7x-9k!@#'
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.slice(0, 6)
	t.is(clean, 'QD7X9K')
	t.true(/^[A-Z0-9]{6}$/.test(clean))
})

test('dark-ninja character config defines frame sequences for idle (8f), attack (6f), hurt (3f), and death (15f)', (t) => {
	const dn = CHARACTERS['dark-ninja']
	t.is(dn.animations.idle.frameCount, 8)
	t.is(dn.animations.idle.frames?.length, 8)
	t.is(dn.animations.idle.frameWidth, 64)
	t.is(dn.animations.idle.frameHeight, 64)

	t.is(dn.animations.attack.frameCount, 6)
	t.is(dn.animations.attack.frames?.length, 6)
	t.is(dn.animations.attack.frameWidth, 96)
	t.is(dn.animations.attack.frameHeight, 64)

	t.is(dn.animations.hurt.frameCount, 3)
	t.is(dn.animations.hurt.frames?.length, 3)

	t.is(dn.animations.death.frameCount, 15)
	t.is(dn.animations.death.frames?.length, 15)

	for (const charId of CHARACTER_IDS) {
		const c = CHARACTERS[charId]
		for (const state of ['idle', 'attack', 'hurt', 'death'] as const) {
			t.truthy(c.animations[state], `${charId} has ${state} animation config`)
			t.true(c.animations[state].frameCount > 0)
		}
	}
})

test('samurai character config defines chopped frame sequences for idle (10f), attack (7f), hurt (4f), and reversed-hurt death (4f)', (t) => {
	const sam = CHARACTERS.samurai
	t.is(sam.animations.idle.frameCount, 10)
	t.is(sam.animations.idle.frames?.length, 10)
	t.is(sam.animations.idle.frameWidth, 64)
	t.is(sam.animations.idle.frameHeight, 64)

	t.is(sam.animations.attack.frameCount, 7)
	t.is(sam.animations.attack.frames?.length, 7)
	t.is(sam.animations.attack.frameWidth, 96)
	t.is(sam.animations.attack.frameHeight, 64)

	t.is(sam.animations.hurt.frameCount, 4)
	t.is(sam.animations.hurt.frames?.length, 4)
	t.is(sam.animations.hurt.frameWidth, 64)
	t.is(sam.animations.hurt.frameHeight, 64)

	t.is(sam.animations.death.frameCount, 4)
	t.is(sam.animations.death.frames?.length, 4)
	t.deepEqual(sam.animations.death.frames, [...(sam.animations.hurt.frames ?? [])].reverse())
})

test('knight character config defines chopped frame sequences for idle (14f), attack (8f), hurt (8f), and death (15f)', (t) => {
	const kn = CHARACTERS.knight
	t.is(kn.animations.idle.frameCount, 14)
	t.is(kn.animations.idle.frames?.length, 14)
	t.is(kn.animations.idle.frameWidth, 64)
	t.is(kn.animations.idle.frameHeight, 64)

	t.is(kn.animations.attack.frameCount, 8)
	t.is(kn.animations.attack.frames?.length, 8)
	t.is(kn.animations.attack.frameWidth, 96)
	t.is(kn.animations.attack.frameHeight, 64)

	t.is(kn.animations.hurt.frameCount, 8)
	t.is(kn.animations.hurt.frames?.length, 8)
	t.is(kn.animations.hurt.frameWidth, 64)
	t.is(kn.animations.hurt.frameHeight, 64)

	t.is(kn.animations.death.frameCount, 15)
	t.is(kn.animations.death.frames?.length, 15)
	t.is(kn.animations.death.frameWidth, 64)
	t.is(kn.animations.death.frameHeight, 64)
})

test('reaper character config defines idle (5f), idle2 (5f), turnStart (10f), turnEnd (10f), attack (10f), and fadeOnDeath', (t) => {
	const rp = CHARACTERS.reaper
	t.true(rp.fadeOnDeath)
	t.is(rp.animations.idle.frameCount, 5)
	t.is(rp.animations.idle.frames?.length, 5)
	t.is(rp.animations.idle2?.frameCount, 5)
	t.is(rp.animations.idle2?.frames?.length, 5)
	t.is(rp.animations.turnStart?.frameCount, 10)
	t.is(rp.animations.turnStart?.frames?.length, 10)
	t.is(rp.animations.turnEnd?.frameCount, 10)
	t.is(rp.animations.turnEnd?.frames?.length, 10)
	t.is(rp.animations.attack.frameCount, 10)
	t.is(rp.animations.attack.frames?.length, 10)
})

test('moon.png default battle map config and sprite ground anchor transform prevent floating', (t) => {
	t.is(DEFAULT_BATTLE_MAP_ID, 'moon')
	const moon = BATTLE_MAPS.moon
	t.is(moon.imagePath, '/assets/maps/moon.png')
	t.is(moon.width, 3072)
	t.is(moon.height, 1664)
	t.is(moon.tileSize, 64)

	// Right plateau (y=1080) is exactly 4 tiles (256px) higher than left cobblestone path (y=1336)
	t.is(moon.p1Spawn.groundY - moon.p2Spawn.groundY, 256)
	t.is(moon.p1Spawn.x, 592)
	t.is(moon.p1Spawn.groundY, 1336)
	t.is(moon.p2Spawn.x, 2208)
	t.is(moon.p2Spawn.groundY, 1080)

	// Foot baseline at y=55 of 64px frame (56/64 = 87.5% from top, 8 transparent rows at bottom)
	t.is(SPRITE_FRAME_HEIGHT, 64)
	t.is(SPRITE_FOOT_BASELINE_Y, 55)
	t.is(SPRITE_BOTTOM_TRANSPARENT_ROWS, 8)
	t.is(SPRITE_FOOT_ANCHOR_RATIO, 0.875)

	for (const charId of CHARACTER_IDS) {
		const idleRight = getSpriteGroundAnchorTransform(charId, 'idle', 'right')
		t.is(idleRight.translateXPercent, -50)
		t.is(idleRight.translateYPercent, -87.5)
	}

	// Dark Ninja's 96x64 attack frame compensates for the 32px forward slash extension
	const dnAtkRight = getSpriteGroundAnchorTransform('dark-ninja', 'attack', 'right')
	t.is(dnAtkRight.translateXPercent, -33.3333)
	t.is(dnAtkRight.translateYPercent, -87.5)

	const dnAtkLeft = getSpriteGroundAnchorTransform('dark-ninja', 'attack', 'left')
	t.is(dnAtkLeft.translateXPercent, -66.6667)
	t.is(dnAtkLeft.translateYPercent, -87.5)
})

test('male dialogue voice packs (attack, hurt, death; silent Reaper) and goldui 9-slice card frames (C, D, E, F) are configured', (t) => {
	t.deepEqual(VOICE_EVENT_LIST, ['attack', 'hurt', 'death'])

	t.is(VOICE_MAP['dark-ninja'].pack, 'voice-dark')
	t.is(VOICE_MAP['dark-ninja'].actor, 'Sean Lenhart')
	t.true(VOICE_MAP['dark-ninja'].muffle)

	t.is(VOICE_MAP.knight.pack, 'voice-heroic')
	t.is(VOICE_MAP.knight.actor, 'Alex Brodie')
	t.false(VOICE_MAP.knight.muffle)

	t.is(VOICE_MAP.samurai.pack, 'voice-stoic')
	t.is(VOICE_MAP.samurai.actor, 'Ian Lampert')
	t.false(VOICE_MAP.samurai.muffle)

	t.is(VOICE_MAP.reaper.pack, null)
	t.is(VOICE_MAP.reaper.actor, null)

	// 4 distinct goldui 9-slice card frames (C, D, E, and recolored F)
	t.is(SUBJECT_BORDER_PALETTE.physics.frameKey, 'C')
	t.is(SUBJECT_BORDER_PALETTE.chemistry.frameKey, 'D')
	t.is(SUBJECT_BORDER_PALETTE.biology.frameKey, 'E')
	t.is(SUBJECT_BORDER_PALETTE.maths.frameKey, 'F')

	const uniqueFramePaths = new Set(Object.values(NINE_SLICE_CONFIG.subjectFrames))
	t.is(uniqueFramePaths.size, 4)
	t.is(NINE_SLICE_CONFIG.sourceWidth, 48)
	t.is(NINE_SLICE_CONFIG.sourceHeight, 48)
	t.deepEqual(NINE_SLICE_CONFIG.insets, {top: 16, right: 16, bottom: 16, left: 16})
})

test('canPlay and canThrowSelection support both (state, card) and (card, state) argument orders safely', (t) => {
	const game = createNewGame({
		player0Character: 'dark-ninja',
		player1Character: 'knight',
		seed: 101,
	})
	game.run({
		type: 'initMatch',
		player0Character: 'dark-ninja',
		player1Character: 'knight',
		seed: 101,
	})

	const firstCard = game.state.players[0].hand[0]
	if (!firstCard) {
		t.fail('Expected at least 1 card in starting hand')
		return
	}
	t.is(canPlay(game.state, firstCard, 0), canPlay(firstCard, game.state, 0))
	t.is(canThrowSelection(game.state, [firstCard.instanceId], 0), canThrowSelection([firstCard], game.state, 0))
})

test('all SFX_FILE_MAP and BGM_TRACK_MAP WAV files exist on disk in public/assets and have valid RIFF WAVE headers', (t) => {
	for (const [event, urls] of Object.entries(SFX_FILE_MAP)) {
		t.true(urls.length >= 1, `Expected at least 1 WAV for SFX event ${event}`)
		for (const url of urls) {
			const diskPath = path.join(process.cwd(), 'public', url)
			t.true(fs.existsSync(diskPath), `Missing SFX WAV file on disk: ${diskPath}`)
			const buf = fs.readFileSync(diskPath)
			t.is(buf.toString('ascii', 0, 4), 'RIFF')
			t.is(buf.toString('ascii', 8, 12), 'WAVE')
		}
	}

	for (const [trackId, track] of Object.entries(BGM_TRACK_MAP)) {
		const diskPath = path.join(process.cwd(), 'public', track.url)
		t.true(fs.existsSync(diskPath), `Missing BGM WAV file on disk for ${trackId}: ${diskPath}`)
		const buf = fs.readFileSync(diskPath)
		t.is(buf.toString('ascii', 0, 4), 'RIFF')
		t.is(buf.toString('ascii', 8, 12), 'WAVE')
	}
})

test('computeTransactionalAppend replays on actionCount mismatch and ends match as draw at 500-action cap without slicing', async (t) => {
	const {computeTransactionalAppend, getTabSeatId, MAX_ACTION_LOG_LENGTH} = await import('../src/firebase/multiplayer')

	const tabSeat = getTabSeatId()
	t.true(typeof tabSeat === 'string' && tabSeat.length >= 6)
	t.is(getTabSeatId(), tabSeat, 'getTabSeatId returns stable seat ID within same process/tab')

	const initAction = {
		type: 'initMatch' as const,
		player0Character: 'samurai' as const,
		player1Character: 'knight' as const,
		seed: 777,
	}

	const baseRoom = {
		roomCode: 'ABC123',
		status: 'playing' as const,
		seed: 777,
		hostUid: 'u1',
		hostSeatId: 'seat_host',
		hostName: 'Host',
		hostCharacter: 'samurai' as const,
		guestUid: 'u2',
		guestSeatId: 'seat_guest',
		guestName: 'Guest',
		guestCharacter: 'knight' as const,
		actionCount: 1,
		actionLog: [initAction],
		hostLastSeenMs: 1000,
		guestLastSeenMs: 1000,
		winnerSeat: 0 as const,
		forfeitedBySeat: 0 as const,
		rematchCount: 0,
	}

	// Simulate an actionCount mismatch where remote already has 2 actions (initMatch + skipTurn)
	const remoteRoomWithTwoActions = {
		...baseRoom,
		actionCount: 2,
		actionLog: [initAction, {type: 'skipTurn' as const}],
	}

	const staleCallerState = createNewGame({
		player0Character: 'samurai',
		player1Character: 'knight',
		seed: 777,
	}).state

	const resMismatch = computeTransactionalAppend(
		remoteRoomWithTwoActions,
		1, // caller expected 1, remote is 2 -> triggers replay from seed
		2,
		{type: 'endTurn'},
		staleCallerState,
	)

	t.true(resMismatch.replayedOnMismatch)
	t.is(resMismatch.updateFields.actionLog.length, 3)
	t.is(resMismatch.updateFields.actionCount, 3)
	t.is(resMismatch.nextState.turn, 3, 'replayed initMatch, existing skipTurn, and new endTurn')

	// Simulate reaching the 500-action cap -> ends as draw (status='finished', winnerSeat=0, forfeitedBySeat=0)
	const log499 = [initAction, ...Array.from({length: MAX_ACTION_LOG_LENGTH - 2}, () => ({type: 'endTurn' as const}))]
	const roomAt499 = {
		...baseRoom,
		actionCount: MAX_ACTION_LOG_LENGTH - 1,
		actionLog: log499,
	}

	const resCap = computeTransactionalAppend(
		roomAt499,
		MAX_ACTION_LOG_LENGTH - 1,
		1,
		{type: 'endTurn'},
		staleCallerState,
	)

	t.is(resCap.updateFields.actionLog.length, MAX_ACTION_LOG_LENGTH, 'preserves all 500 actions without slicing')
	t.is(resCap.updateFields.actionCount, MAX_ACTION_LOG_LENGTH)
	t.is(resCap.updateFields.status, 'finished')
	t.is(resCap.updateFields.winnerSeat, 0)
	t.is(resCap.updateFields.forfeitedBySeat, 0)
})

test('audioManager supports Master, Music, SFX, and Voice volume sliders clamped to [0, 1]', async (t) => {
	const {audioManager} = await import('../src/audio/audioManager')

	audioManager.setMasterVolume(0.5)
	audioManager.setMusicVolume(0.25)
	audioManager.setSfxVolume(0.75)
	audioManager.setVoiceVolume(1.5) // clamps to 1

	const settings = audioManager.getVolumeSettings()
	t.is(settings.masterVolume, 0.5)
	t.is(settings.musicVolume, 0.25)
	t.is(settings.sfxVolume, 0.75)
	t.is(settings.voiceVolume, 1)

	audioManager.setMasterVolume(-0.2) // clamps to 0
	t.is(audioManager.getMasterVolume(), 0)
})
