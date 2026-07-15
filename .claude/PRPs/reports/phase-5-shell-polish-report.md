# Implementation Report: Phase 5 — Shell & Polish (Pebble Trap)

## Summary
Menu-first shell added: a React main menu that lists the `MODES` registry, `modeId` threaded React→Phaser via the game registry, full menu → game → win → menu navigation (Menu button both during play and on the win overlay), and an asset-manifest stub establishing the sprite seam. The PRD Key Hypothesis was proven in-browser: a temporary 2nd registry entry appeared in the menu and played identically, with the `git diff` confined to `registry.ts` — zero edits to `BoardScene` or `engine/`. This completes all 5 PRD phases.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium — matched, zero fix iterations (accumulated Phaser gotchas held) |
| Files Changed | 9 (2 create, 7 update) | 8 (2 create, 6 update) — `theme.ts` needed no change; menu styling lived entirely in CSS |
| Confidence | high | held — no runtime surprises; the `game.registry` timing (verified via docs pre-write) worked first try |

## Tasks Completed

| # | Task | Status |
|---|---|---|
| 1 | `render/assets.ts` (manifest stub) | done |
| 2 | `main.ts` — StartGame stashes modeId in registry | done |
| 3 | `Boot.ts` — reads modeId, starts BoardScene with it | done |
| 4 | `PhaserGame.tsx` — modeId prop → StartGame | done |
| 5 | `ui/MainMenu.tsx` — lists MODES | done |
| 6 | `ui/Hud.tsx` — onMenu, [Play again][Menu], during-play Menu | done |
| 7 | `App.tsx` — screen state, menu/back wiring | done |
| 8 | `style.css` — menu + button styles | done |
| — | `theme.ts` | not needed (planned as conditional; CSS sufficed) |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | Pass | `tsc --noEmit` zero errors |
| Unit Tests | Pass | 17/17 unchanged — engine untouched |
| Build | Pass | vite prod build clean |
| No bare `Phaser.` runtime refs | Pass | grep shows only type positions (`Phaser.Scene`, `Phaser.Game`, `Phaser.Types.Core.GameConfig`) — no repeat of the phase-4 `Geom.Circle` bug |
| Browser — menu render | Pass | title + one "Well Board" button from registry, zero console errors |
| Browser — menu → game | Pass | modeId threaded; well board loads with top-left Menu button |
| Browser — during-play Menu | Pass | returns to menu; re-entry is a clean fresh board |
| Browser — win overlay | Pass | [Play again] and [Menu] both present and styled |
| Browser — overlay Menu → menu | Pass | closes the full loop, zero console errors |
| Browser — GENERICITY PROOF | Pass | temp 2nd registry entry (`well2`) → menu listed 2 buttons; tapping the 2nd played identically (placed at N, turn advanced); `git diff` touched ONLY `registry.ts`; reverted, registry clean |
| Browser — mobile menu | Pass | title + button centered (flexbox center; game-canvas portrait FIT already proven phases 1/3/4) |

## Files Changed

| File | Action |
|---|---|
| `src/game/render/assets.ts` | CREATED (asset manifest seam — documented, not yet consumed) |
| `src/ui/MainMenu.tsx` | CREATED (React menu over `Object.values(MODES)`) |
| `src/App.tsx` | UPDATED (`modeId: string|null` screen state, menu/back/restart wiring) |
| `src/PhaserGame.tsx` | UPDATED (optional `modeId` prop → StartGame) |
| `src/game/main.ts` | UPDATED (`StartGame(parent, modeId)` → `game.registry.set('modeId', ...)`) |
| `src/game/scenes/Boot.ts` | UPDATED (reads registry modeId, starts BoardScene with it) |
| `src/ui/Hud.tsx` | UPDATED (`onMenu`, two-button overlay, during-play Menu button) |
| `public/style.css` | UPDATED (menu layer/box/title/buttons + hud-menu-button + overlay-actions) |

## Deviations from Plan
- `theme.ts` untouched — the plan flagged it as conditional ("only if a shared constant is needed"); menu styling lived entirely in CSS, so no change was warranted. 8 files instead of 9.
- No runtime bugs this phase — the standing `Phaser.` grep gate (learned in phases 1/3/4) meant I added no bare runtime `Phaser.` refs in the first place. First phase with zero browser-caught defects.

## Issues Encountered
None. `game.registry.set` after `new Game()` landing before `Boot.create` (the one timing risk flagged in the plan) worked as the docs predicted — board loaded with the correct mode on the first try.

## Tests Written
None — shell/UI phase (per plan's Testing Strategy). Engine's 17 tests are the regression gate; the browser script, especially the genericity proof, was the functional test and directly validated the PRD Key Hypothesis.

## Project Status
**All 5 PRD phases complete.** The game is fully playable end to end: menu → pick mode → place → move → trap → win → restart or menu. The multi-mode architecture is proven, not just asserted.

## Next Steps
- [ ] Commit: `feat: add mode-select menu and menu navigation`
- [ ] Open a PR (`/ecc:prp-pr`) for the full `feat/phase-1-scaffold` branch (all 5 phases)
- [ ] Resolve the working-title name ("Pebble Trap")
- [ ] Capture Mode 2 / Mode 3 rules in their own PRD when the ideas firm up — adding them is now a `modes/` folder + registry entry, proven zero-scene-edit

---
*Generated: 2026-07-15*
