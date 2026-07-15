# Plan: Draw by Threefold Repetition — Phase 2 (HUD Draw Display)

## Summary
Fix a real bug the PRD flagged in advance: `Hud.tsx`'s current gameover check (`isOver && game.winner !== null`) renders NOTHING for a draw (`isOver:true, winner:null`) — no turn line, no overlay, blank screen. Refactor to one unconditional `isOver` overlay that branches win-text vs "Draw!" inside. Neutral draw styling comes for free (no color override → inherits the UI's default cream). Phase 1 (engine) is complete and merged; this is the only remaining PRD phase.

## User Story
As a player, when a game ends in a draw (repetition), I want to see "Draw!" and be able to restart or go to the menu, exactly like a win.

## Problem → Solution
`isOver && winner!==null` (blank screen on draw) → `isOver && (winner!==null ? Win : Draw)` (exactly one overlay always renders on gameover).

## Metadata
- **Complexity**: Small
- **Source PRD**: `.claude/PRPs/prds/draw-by-repetition.prd.md`
- **PRD Phase**: 2 — HUD draw display
- **Estimated Files**: 1 (UPDATE)

## UX Design

### Before (the bug)
```
Draw reached → isOver=true, winner=null
  !isOver && (...)         → false, turn line hidden
  isOver && winner!==null  → false, overlay hidden
  RESULT: blank screen, no buttons, soft-locked
```

### After
```
Draw reached → isOver=true, winner=null
┌─────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░  Draw!  ░░░░░░░░│   <- neutral cream, no player color
│░░░░░░░░[Play again]░░░░░│
│░░░░░░░░░░[Menu]░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After |
|---|---|---|
| Draw reached | blank screen, soft-locked | "Draw!" overlay, [Play again][Menu] |
| Win reached | overlay (unchanged) | overlay (unchanged, same code path) |

---

## Mandatory Reading
| Priority | File | Why |
|---|---|---|
| P0 | `.claude/PRPs/prds/draw-by-repetition.prd.md` — "Architecture Notes" (HUD paragraph) | exact normative refactor, already specified |
| P0 | `src/ui/Hud.tsx` (current, read below) | file being fixed |
| P1 | `src/game/render/theme.ts` (current, read below) | `PLAYER_COLOR_CSS`/`PLAYER_NAME` — unchanged, still used for the win case |
| P1 | `public/style.css` — `.hud-overlay-text` rule | confirms no new CSS needed (draw reuses it, inherits `#hud-box`'s default `color: #e8e2d0`) |

## External Documentation
None needed.

---

## Patterns to Mirror
### CODE_STYLE
// SOURCE: src/ui/Hud.tsx (current)
Brace-on-own-line for the component function, ternaries inline in JSX attributes (matches the rest of `src/ui/` and `App.tsx`'s style).

---

## Files to Change
| File | Action | Justification |
|---|---|---|
| `src/ui/Hud.tsx` | UPDATE | single conditional restructure — the fix |

## NOT Building
- No new CSS (draw reuses `.hud-overlay`/`.hud-overlay-text`/`.hud-button*` untouched)
- No "reason: repetition" text, no pre-draw hint (PRD Could/deferred)
- No engine changes (phase 1, already complete)

---

## Step-by-Step Tasks

### Task 1: `src/ui/Hud.tsx` — one-overlay-always-on-gameover
- **ACTION**: replace the two independent conditionals (`!isOver && <turn>` stays; `isOver && winner!==null && <overlay>` becomes `isOver && <overlay>` with an internal branch) with the exact block below.
- **IMPLEMENT** (complete file):
```tsx
import { PLAYER_COLOR_CSS, PLAYER_NAME } from '../game/render/theme';
import type { HudSnapshot } from '../game/scenes/BoardScene';

interface HudProps
{
    snapshot: HudSnapshot | null;
    onRestart: () => void;
    onMenu: () => void;
}

function turnText (snapshot: HudSnapshot): string
{
    const { game, pebblesPerPlayer } = snapshot;
    const name = PLAYER_NAME[game.current];
    if (game.phase === 'placement')
    {
        const n = game.placed[game.current] + 1;
        return `${name}: place pebble (${n}/${pebblesPerPlayer})`;
    }
    return `${name}: move a pebble`;
}

export function Hud ({ snapshot, onRestart, onMenu }: HudProps)
{
    if (!snapshot)
    {
        return null;
    }

    const { game } = snapshot;
    const isOver = game.phase === 'gameover';

    return (
        <div id="hud-layer">
            <div id="hud-box">
                <button type="button" className="hud-menu-button" onClick={onMenu}>
                    Menu
                </button>
                {!isOver && (
                    <div className="hud-turn" style={{ color: PLAYER_COLOR_CSS[game.current] }}>
                        {turnText(snapshot)}
                    </div>
                )}
                {isOver && (
                    <div className="hud-overlay">
                        <div
                            className="hud-overlay-text"
                            style={game.winner !== null ? { color: PLAYER_COLOR_CSS[game.winner] } : undefined}
                        >
                            {game.winner !== null ? `${PLAYER_NAME[game.winner]} wins!` : 'Draw!'}
                        </div>
                        <div className="hud-overlay-actions">
                            <button type="button" className="hud-button" onClick={onRestart}>
                                Play again
                            </button>
                            <button type="button" className="hud-button hud-button-secondary" onClick={onMenu}>
                                Menu
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
```
- **GOTCHA**: `isOver` alone now gates the whole overlay block — do NOT reintroduce `winner !== null` on the outer condition, that's the exact bug being fixed. The `winner !== null` check only decides win-text-vs-draw-text and color-vs-no-color INSIDE the block.
- **GOTCHA**: draw gets no inline `style` (color prop omitted via `undefined`), so it inherits `#hud-box { color: #e8e2d0 }` — neutral cream, distinct from both player colors. No CSS change needed.
- **VALIDATE**: `npm run typecheck`

### Task 2: validation sweep + browser proof
```bash
npm run typecheck   # 0
npm test            # 22/22 (engine untouched — this phase touches zero engine files)
npm run build        # clean
git diff --stat -- src/game/engine   # empty — engine untouched this phase too
npm run dev
```
Browser validation (REQUIRED — this exact bug was invisible to typecheck):
1. Fresh tab, menu → Well Board.
2. Reach the T8 start position `{C:null, N:1, E:1, S:2, W:2}` via placement taps in order P1,P2,P1,P2: tap N(red), tap S(blue), tap E(red), tap W(blue). Confirm HUD reads "Red: move a pebble" (this exact position is not a trap — verified in phase 1's T8 fixture).
3. Tap the 6-ply cycle TWICE (12 taps total, same moves proven in phase 1's T8 unit test): select N→tap C, select W→tap N, select C→tap W, select N→tap C, select W→tap N, select C→tap W — then repeat that whole 6-tap sequence once more.
4. After the 12th tap: expect the "Draw!" overlay — neutral cream text (not red/blue), [Play again][Menu] both visible, zero console errors.
5. Tap "Play again" → board clears, back to placement, HUD normal — confirms draw doesn't leave the app in a broken state.
6. Tap "Menu" from a draw overlay → returns to menu cleanly.

---

## Testing Strategy
No new unit tests (pure JSX/CSS branch fix, already covered by engine tests from phase 1). The browser script above is the functional test — it's the first time a draw is exercised through the ACTUAL UI (phase 1 only tested it at the engine level).

## Acceptance Criteria
- [ ] Draw shows "Draw!" overlay with [Play again][Menu] — not a blank screen
- [ ] Draw text is neutral (not red/blue)
- [ ] Win path (existing) unchanged — still shows "{name} wins!" in the player's color
- [ ] `git diff` touches only `src/ui/Hud.tsx`
- [ ] 22/22 engine tests unaffected, typecheck 0, build clean
- [ ] Zero console errors through the full scripted draw + restart + menu flow

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 12-tap browser script mis-keyed (wrong vertex order) | L | L | same moves already proven correct in phase-1's T8 unit test; if the browser board doesn't match, re-check taps against that exact sequence, not the engine |

## Notes
- After validation: commit `fix: display draw outcome in the HUD`.
- This completes the draw-by-repetition PRD (both phases). Report → `.claude/PRPs/reports/draw-by-repetition-phase-2-hud-report.md`; flip PRD phase-2 row to complete.
