# Implementation Report: Phase 1 — Scaffold (Pebble Trap)

## Summary
Official `phaserjs/template-react-ts` imported into the repo, demo game + telemetry stripped, resolution locked to 720×1280 portrait (Scale.FIT + autoCenter), PRD folder skeleton laid down with normative type stubs, vitest wired. Verified in a real browser: 9:16 pillar on wide desktop windows, width-fit with top/bottom letterbox on phone viewports, zero console errors.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| Confidence | 9/10 | held — 2 runtime bugs found+fixed via browser validation |
| Files Changed | ~16 | 18 (incl. 2 unplanned branding edits) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Import template | done | rsync with `--exclude screenshot.png` instead of cp |
| 2 | Install + baseline | done | HTTP 200 on :8080 before any edits |
| 3 | De-telemetry + scripts | done | `log.js` deleted; scripts: dev/build/test/typecheck |
| 4 | Strip demo | done | 4 scenes + 3 assets gone; grep for refs = clean |
| 5 | Portrait lock | done | 2 deviations — see below |
| 6 | Folder skeleton + stubs | done | PRD-verbatim types |
| 7 | Vitest wiring | done | vitest ^4.1.10, standalone config, sanity green |
| 8 | Validation sweep | done | all levels pass |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | Pass | `tsc --noEmit` zero errors |
| Unit Tests | Pass | 1/1 (sanity; real vectors arrive phase 2) |
| Build | Pass | vite prod build → dist/ |
| Browser (wide 1600×900) | Pass | canvas 453×806, aspect 0.5625, centered both axes (measured via getBoundingClientRect) |
| Browser (phone 390×844 emulated) | Pass | canvas fills width, 75px letterbox top/bottom, aspect 0.5625 |
| Console | Pass | zero errors/warnings after fixes |

## Files Changed

Created: `src/game/scenes/BoardScene.ts`, `src/game/engine/types.ts`, `src/game/modes/types.ts`, `src/game/modes/registry.ts`, `src/game/render/theme.ts`, `vitest.config.ts`, `src/game/engine/__tests__/sanity.test.ts`, `public/assets/.gitkeep`, `src/game/modes/well/.gitkeep` (+ template import: ~20 files).
Updated: `package.json` (name, description, scripts, +vitest), `src/game/main.ts`, `src/App.tsx`, `src/game/scenes/Boot.ts`, `public/style.css`, `index.html` (title).
Deleted: `log.js`, `src/game/scenes/{Preloader,MainMenu,Game,GameOver}.ts`, `public/assets/{logo,star,bg}.png`.

## Deviations from Plan

1. **`Phaser is not defined` at runtime** — Phaser 4 ESM build sets NO global `Phaser` object. Plan's config used `Phaser.Scale.FIT` (runtime ref). Typecheck passed (`Phaser.Types.*` is type-only), browser crashed. Fix: `import { Scale } from 'phaser'` → `Scale.FIT`. **Standing gotcha for phases 3-5: never reference bare `Phaser.*` in runtime positions — import every value; `Phaser.Types.*` in type positions is fine.**
2. **Double centering** — plan's CSS flex-centered `#game-container` while Phaser `autoCenter` also set margins → canvas shifted right (x=860 instead of 573). Fix: dropped flex centering; Phaser owns centering. Measured centered afterwards.
3. Branding edits not in plan: `package.json` name→`pebble-trap` + description, `index.html` title→`Pebble Trap`.
4. Import via `rsync --exclude screenshot.png` (plan said `cp`; avoids demo screenshot in repo).
5. Template also ships `.editorconfig`, `.eslintrc.cjs`, `.gitignore` — kept (gitignore covers node_modules/dist).
6. Browser windows clamp at ~500px min width on this display — narrow-viewport check done via Chrome device emulation (390×844, dpr 3) instead of window resize.

## Issues Encountered
Both runtime bugs (deviations 1–2) were invisible to typecheck/build and caught ONLY by the real-browser validation step. Keep browser validation in every phase.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `src/game/engine/__tests__/sanity.test.ts` | 1 | vitest wiring only |

## Next Steps
- [ ] Phase 2 (Engine — rules + vectors T1–T7) and Phase 3 (Board render) — parallel-eligible per PRD
- [ ] Commit when user says so (suggested: `feat: scaffold portrait phaser shell`)

---
*Generated: 2026-07-14*
