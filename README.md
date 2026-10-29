# Quiz Duel — Tactical STEM Card Battler

A 1v1 pixel-art tactical STEM card battler built with React, TypeScript, Vite, Tailwind CSS, and Firebase Firestore.

## Gameplay Overview

- **4 Playable Characters**: **Dark Ninja** (Chemistry affinity / Physics weakness), **Samurai** (Maths affinity / Biology weakness), **Knight** (Physics affinity / Chemistry weakness), and **Reaper** (Biology affinity / Maths weakness).
- **80-Card Catalog & Fixed 24-Card Decks**: 20 cards per STEM subject (**Maths** offence, **Physics** defence & offence, **Chemistry** debuffs, **Biology** sustain) across 4 rarities (8 Normal, 6 Uncommon, 4 Epic, 2 Legendary).
- **160-Question STEM Quiz Bank**: Every card in a player's deck is bound at battle start to a unique STEM multiple-choice question with seeded per-match choice shuffling and an anti-copy `<canvas>` quiz modal.
  - **Normal & Uncommon**: Correct answer **nullifies** the thrown card; wrong/timeout resolves **full** effect.
  - **Epic & Legendary**: Correct answer resolves the **reduced** (35% or custom) effect; wrong/timeout resolves **full** effect.
- **Persistent Mana & Turn Flow**: Players start with 80 HP, 5 Mana (max 5), and 5 cards. Gain +1 Mana and draw 1 card at the start of each turn. Skipping a turn without throwing any cards grants +1 bonus Mana.
- **Play Modes**: Local **1P vs Smart Bot**, **2P Pass-and-Play**, and **Firebase Online 1v1 Rooms** (with transactional action-log sync, 30s presence heartbeats, and per-tab seat IDs).

## Quick Start

```bash
npm ci
npm run dev
```

Optional Firebase configuration can be supplied via `.env` (see `.env.example`) or `firebase-applet-config.json`.

## Scripts

- `npm run dev` — Start Vite development server on port 3000
- `npm run typecheck` — Run TypeScript compiler check (`tsc --noEmit`)
- `npm run check` — Run Biome linter & formatter check
- `npm test` — Run AVA test suite
- `npm run sim` — Run 500-battle automated simulation & invariant verifier
- `npm run build` — Typecheck and build production bundle

## Documentation & Attribution

- [`docs/DECKS.md`](docs/DECKS.md) — Character deck recipes and simulation balance summary
- [`docs/ASSETS.md`](docs/ASSETS.md) — Sprite sheets, 9-slice frames, map, BGM, and voice/SFX inventory
- [`docs/REFERENCE_MAP.md`](docs/REFERENCE_MAP.md) — Engine architecture ported from [`oskarrough/slaytheweb`](https://github.com/oskarrough/slaytheweb) (`AGPL-3.0-or-later`)
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — Full third-party code, card design, and asset attributions
