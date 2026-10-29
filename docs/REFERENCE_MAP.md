# Quiz Duel — Reference Architecture Map

Quiz Duel ports and extends the functional state/action engine from [`oskarrough/slaytheweb`](https://github.com/oskarrough/slaytheweb) (`AGPL-3.0-or-later`, archived in `reference/slaytheweb/`):

| Reference File (`reference/slaytheweb/`) | Quiz Duel Port (`src/engine/`) | Adaptations |
| --- | --- | --- |
| `src/game/utils.js` | `src/engine/utils.ts` | TypeScript port of `Queue`, `clamp`, `range`, `pick`, `shuffle`, plus deterministic `mulberry32` PRNG and `seededShuffle`. |
| `src/game/powers.js` | `src/engine/powers.ts` | Extended for 1v1 PvP powers (`strength`, `tempStrength`, `weak`, `vulnerable`, `poison`, `parasite`, `corrode`, `antiHeal`, `noLifeSteal`, `ward`, `stun`, `stunImmune`, `reflect`, `apparition`, `phoenix`, `barricade`, `juggernaut`, `doubleTap`, `demonForm`, `metallicize`, `noxiousFumes`, `envenom`, `selfRepair`, `regen`). |
| `src/game/conditions.js` | `src/engine/conditions.ts` | Persistent mana pool check, `onlySubjectInHand` (Clash), and multi-card `canThrowSelection` validation. |
| `src/game/cards.js` | `src/engine/cards.ts` | 80-card STEM catalog (`maths`, `physics`, `chemistry`, `biology`), `+40%` / cost-reduction upgrades, single damage pipeline (`previewCardDamage`), and per-match bound question choices (`boundChoices`, `boundCorrectIndex`). |
| `src/game/actions.js` | `src/engine/actions.ts` | Symmetric 2-player `GameState`, `throwsThisTurn` tracking, multi-card `throwCards` queue, `resolveQuizAnswer` (Normal/Uncommon nullified on correct; Epic/Legendary 35% reduced scaling including `lifeSteal` % and `loseHp`), and Round 25+ Fatigue. |
| `src/game/action-manager.js` | `src/engine/action-manager.ts` | Deterministic action queue (`enqueue`, `dequeue`, `undo`, `redo`) and `replayActionLog` for Firestore multiplayer verification. |
| `src/game/game.js` | `src/engine/game.ts` | Match factory binding `ActionManager` and `createNewState`. |
