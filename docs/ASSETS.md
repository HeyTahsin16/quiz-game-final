# Quiz Duel — Asset Inventory

All runtime assets are served from `/public/assets/`:

- **Character Sprites (`/public/assets/characters/`)**:
  - `dark-ninja/`: 8 idle frames (64×64), 6 attack frames (96×64), 3 hurt frames (64×64), 15 death frames (64×64)
  - `samurai/`: 10 idle frames (64×64), 7 attack frames (96×64), 4 hurt frames (64×64), 4 reversed-hurt death frames (64×64)
  - `knight/`: 14 idle frames (64×64), 8 attack frames (96×64), 8 hurt frames (64×64), 15 death frames (64×64)
  - `reaper/`: 5 idle frames (64×64), 5 idle2 passive frames (64×64), 10 turnStart transition frames (64×64), 10 turnEnd transition frames (64×64), 10 attack frames (64×64), 3 hurt frames (64×64), 10 death frames with opacity fade
- **9-Slice Card Frames (`/public/assets/cards/goldui/`)**:
  - `20240707dragon9SlicesC.png` (Physics / Cyan-Gold)
  - `20240707dragon9SlicesD.png` (Chemistry / Emerald-Gold)
  - `20240707dragon9SlicesE.png` (Biology / Crimson-Gold)
  - `20240707dragon9SlicesF.png` (Maths / Royal Violet-Gold)
- **Flat UI Sprites (`/public/assets/ui/flat/`)**:
  - 9-slice panels, inset wells, white/cream offset title boxes, and interactive buttons
- **Battle Map (`/public/assets/maps/moon.png`)**:
  - 3072×1664 pixel-art Moon battle arena with calibrated ground coordinates (`p1Spawn: (592, 1336)`, `p2Spawn: (2208, 1080)`)
- **Audio (`/public/assets/audio/`)**:
  - `bgm/`: `menu-theme.wav`, `battle-theme.wav`
  - `sfx/`: UI and combat WAV effects (`click`, `hover`, `confirm`, `cancel`, `error`, `popup-open`, `popup-close`, `card-draw`, `card-throw`, `hit`, `heavy-hit`, `shield`, `heal`, `debuff`, `quiz-correct`, `quiz-wrong`, `turn-start`, `victory`, `defeat`)
  - `voices/`: 3 male character voice sets (`voice-dark` Sean Lenhart with Web Audio low-pass muffle, `voice-heroic` Alex Brodie, `voice-stoic` Ian Lampert; Reaper is silent)
