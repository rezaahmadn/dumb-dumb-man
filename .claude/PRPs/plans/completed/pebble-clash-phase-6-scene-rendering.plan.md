# Plan: Pebble Clash — Phase 6: Scene Rendering

## Summary

Make Pebble Clash actually playable in the browser: spawn pebble objects for the 32 pre-placed pebbles in `BoardScene.create()` (today, objects only spawn on a `'place'` move, which pre-placed pebbles never fire), and replace the Phase 2 `if (move.kind === 'jump') return;` guard with real jump rendering — a hop-by-hop tween plus `destroy()` of each captured pebble. Also distinguish jump-landing highlights from quiet-move highlights.

## User Story

As a player, I want to see all 32 pebbles when I open Pebble Clash, see distinct highlights for capture vs. quiet moves when I select a pebble, and watch captured pebbles disappear as my pebble hops over them.

## Problem → Solution

`create()` never seeds pebble objects for a preplaced/movement-start mode; `syncPebbles` early-returns on `jump`; `renderHighlights` has one highlight style. → `create()` spawns a circle per occupied vertex; `syncPebbles` animates each hop and destroys captured pebbles; highlights split into two sets with distinct styling.

## Metadata

- **Complexity**: Medium — mechanical, but touches shared mutable scene state carefully.
- **Source PRD**: `.claude/PRPs/prds/pebble-clash.prd.md`
- **PRD Phase**: 6 — "Scene rendering"
- **Estimated Files**: 2 UPDATE (`BoardScene.ts`, `theme.ts`) — no new files; no `BoardScene.test.ts` exists in this codebase, so Phase 7's manual playthrough is this phase's real validation.
- **Depends on**: Phase 3 (rules), Phase 5 (registered mode + real board, needed to test in-browser).

---

## UX Design

### Before
```
┌─────────────────────────────┐
│  (Pebble Clash selected)     │
│  [board lines only,          │
│   no pebbles visible]        │
└─────────────────────────────┘
```

### After
```
┌─────────────────────────────┐
│  ●●●●●  <- 16 blue (P2)      │
│  ●●●●●                       │
│  · · · · ·  <- empty centre  │
│  ○○○○○  <- 16 red (P1)       │
│  ○○○○○                       │
│  [tap: quiet dest = white,   │
│   jump landing = distinct]   │
└─────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After |
|---|---|---|
| Opening Pebble Clash | Empty board (bug) | 32 pebbles visible |
| Selecting a pebble | N/A | Quiet vs jump destinations distinct |
| Tapping a jump landing | N/A | Hop animation, captures destroyed |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/game/scenes/BoardScene.ts` | 60–83 (`create`) | Where pre-placed seeding goes |
| P0 | `src/game/scenes/BoardScene.ts` | 307–361 (`syncPebbles`) | `'place'` branch → extracted helper; `jump` guard → replaced |
| P0 | `src/game/scenes/BoardScene.ts` | 216–232 (`selectVertex`, `clearSelection`) | Single `legalDestinations` set → two sets |
| P0 | `src/game/scenes/BoardScene.ts` | 407–425 (`renderHighlights`) | Single highlight loop → branch on quiet vs jump |
| P0 | `src/game/scenes/BoardScene.ts` | 169–214 (`onVertexTap`) | Destination resolution → recognize jump-landing taps |
| P1 | `src/game/render/theme.ts` | all | Add `jumpHighlightColor` |

## External Documentation

None — uses only Phaser APIs already used in this file.

---

## Patterns to Mirror

### PEBBLE_SPAWN (extract into shared helper)
```ts
// SOURCE: src/game/scenes/BoardScene.ts:310-329
        if (move.kind === 'place')
        {
            const pos = this.vertexPos[move.to];
            const circle = this.add.circle(pos.x, pos.y, THEME.pebbleRadius, THEME.pebble[player]);
            circle.setDepth(1);
            circle.setData('vertexId', move.to);
            circle.setInteractive(
                new Geom.Circle(THEME.pebbleRadius, THEME.pebbleRadius, THEME.tapRadius),
                Geom.Circle.Contains
            );
            this.wirePebbleEvents(circle);
            this.pebbleObjects[move.to] = circle;
            return;
        }
```

### TWEEN_PATTERN
```ts
// SOURCE: src/game/scenes/BoardScene.ts:353-360
        this.tweens.add({
            targets: circle,
            x: dest.x,
            y: dest.y,
            duration: THEME.moveTweenMs,
            ease: 'Quad.easeInOut'
        });
```

### ALLMAN_BRACES
This file opens braces on their own line (unlike `engine/`). Preserve in every edit.

---

## Files to Change

| File | Action |
|---|---|
| `src/game/scenes/BoardScene.ts` | UPDATE — spawn, jump render, highlight split, tap resolution |
| `src/game/render/theme.ts` | UPDATE — add `jumpHighlightColor` |

## NOT Building

- **AI dispatch / board data / registration** — already done Phases 4–5.
- **Chain "step-through" UI** — PRD "Could", deferred. v1 auto-resolves the full chain on one tap.
- **New scene tests** — no `BoardScene.test.ts` exists; don't introduce that pattern for one file. Manual playtest is the validation (Phase 7).

---

## Step-by-Step Tasks

### Task 1: Extract pebble-spawning into a shared helper, call from `create()`

```ts
    //  Shared by syncPebbles (on a 'place' move) and create() (seeding a
    //  preplaced/movement-start mode's initial 32 pebbles) — extracted so
    //  pre-placed pebbles get IDENTICAL setup to placed ones.
    private spawnPebbleAt (vertexId: VertexId, player: PlayerId)
    {
        const pos = this.vertexPos[vertexId];
        const circle = this.add.circle(pos.x, pos.y, THEME.pebbleRadius, THEME.pebble[player]);
        circle.setDepth(1);
        circle.setData('vertexId', vertexId);
        circle.setInteractive(
            new Geom.Circle(THEME.pebbleRadius, THEME.pebbleRadius, THEME.tapRadius),
            Geom.Circle.Contains
        );
        this.wirePebbleEvents(circle);
        this.pebbleObjects[vertexId] = circle;
        return circle;
    }
```

Replace the `'place'` branch in `syncPebbles`:
```ts
        if (move.kind === 'place')
        {
            this.spawnPebbleAt(move.to, this.state.current);
            return;
        }
```

In `create()`, after `this.state = initialState(this.mode.engine, this.mode.id);`:
```ts
        //  Preplaced/movement-start modes (Pebble Clash) never fire a
        //  'place' move — seed their pebble objects directly from state.
        //  Placement-start modes (well, morris) begin all-null here, so
        //  this loop is a no-op for them.
        for (const v of this.mode.engine.board.vertices)
        {
            const occupant = this.state.board[v.id];
            if (occupant !== null)
            {
                this.spawnPebbleAt(v.id, occupant);
            }
        }
```

- **MIRROR**: PEBBLE_SPAWN, ALLMAN_BRACES.
- **GOTCHA**: Insert after `this.state = initialState(...)` and after `this.pebbleObjects = {}` is reset — check the existing `create()` order before inserting.
- **VALIDATE**: `npm run typecheck` green. `npm run dev`: well/morris unaffected; Pebble Clash shows 32 pebbles.

### Task 2: Render jump moves — hop-by-hop tween, destroy captured pebbles

Replace `if (move.kind === 'jump') return;` with:
```ts
        if (move.kind === 'jump')
        {
            const circle = this.pebbleObjects[move.from];
            delete this.pebbleObjects[move.from];
            if (!circle)
            {
                return;
            }
            //  Destroy every captured pebble immediately — simplest correct
            //  v1. syncPebbles runs BEFORE applyMove (see the comment above
            //  this method), so this is purely visual and doesn't affect
            //  game state either way.
            for (const hop of move.hops)
            {
                this.pebbleObjects[hop.over]?.destroy();
                delete this.pebbleObjects[hop.over];
            }
            const lastHop = move.hops[move.hops.length - 1];
            this.pebbleObjects[lastHop.to] = circle;
            circle.setData('vertexId', lastHop.to);
            //  Chain the tween through every intermediate landing — this is
            //  what makes a multi-hop capture read as "hopping", not
            //  "sliding" straight to the end.
            this.tweens.chain({
                targets: circle,
                tweens: move.hops.map((hop) => {
                    const dest = this.vertexPos[hop.to];
                    return { x: dest.x, y: dest.y, duration: THEME.moveTweenMs, ease: 'Quad.easeInOut' };
                })
            });
            return;
        }
```

- **MIRROR**: TWEEN_PATTERN, extended to a chain.
- **GOTCHA (ordering)**: `syncPebbles` runs BEFORE `applyMove` — `this.state.board` still shows captured pebbles as occupied when this runs. Don't read `this.state.board` to decide what to destroy; use `move.hops[].over` directly.
- **GOTCHA (Phaser API)**: `this.tweens.chain(...)` may differ or not exist in the installed Phaser 4.0.0 — verify against `node_modules/phaser` types before implementing. Fallback: nested `onComplete` callbacks, tweening to `hops[0].to` then the next on completion. Either satisfies "hops, not a straight slide."
- **VALIDATE**: `npm run typecheck` green. Browser test deferred to Phase 7 (needs a live jump, which needs Phases 3+4+5 all playable).

### Task 3: Split highlights into quiet vs. jump-landing sets

```ts
    private legalDestinations: Set<VertexId> = new Set();
    private legalJumpDestinations: Set<VertexId> = new Set();
```

```ts
    private selectVertex (id: VertexId, moves: Move[])
    {
        this.selected = id;
        this.legalDestinations = new Set(
            moves
                .filter((m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.from === id)
                .map((m) => m.to)
        );
        this.legalJumpDestinations = new Set(
            moves
                .filter((m): m is Extract<Move, { kind: 'jump' }> => m.kind === 'jump' && m.from === id)
                .map((m) => m.hops[m.hops.length - 1].to)
        );
        this.renderHighlights();
    }

    private clearSelection ()
    {
        this.selected = null;
        this.legalDestinations = new Set();
        this.legalJumpDestinations = new Set();
        this.renderHighlights();
    }
```

In `renderHighlights`, after the existing quiet-destination loop, add:
```ts
        //  Jump landings drawn distinctly (PRD "Should" item), after quiet
        //  destinations so jump color visually wins on any overlap.
        this.highlightGraphics.fillStyle(THEME.jumpHighlightColor, 0.5);
        for (const dest of this.legalJumpDestinations)
        {
            const d = this.vertexPos[dest];
            this.highlightGraphics.fillCircle(d.x, d.y, THEME.vertexRadius + 6);
        }
```

- **MIRROR**: existing highlight loop shape, ALLMAN_BRACES.
- **GOTCHA (Q4)**: A vertex has at most one jump landing per selected pebble because Phase 3's chain enumeration already deduped to one maximal chain per landing. `Set` collapse is a no-op safety net, not load-bearing logic.
- **VALIDATE**: `npm run typecheck` green.

### Task 4: Resolve a jump-landing tap in `onVertexTap`

Replace the `if (this.selected !== null)` block:
```ts
        if (this.selected !== null)
        {
            const quietMove = moves.find(
                (m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.from === this.selected && m.to === id
            );
            //  Prefer a jump over a quiet move landing on the same vertex —
            //  a capture is the more significant action a tap could mean.
            const jumpMove = moves.find(
                (m): m is Extract<Move, { kind: 'jump' }> => m.kind === 'jump' && m.from === this.selected && m.hops[m.hops.length - 1].to === id
            );
            if (jumpMove)
            {
                this.applyAndSync(jumpMove);
                this.clearSelection();
                return;
            }
            if (quietMove)
            {
                this.applyAndSync(quietMove);
                this.clearSelection();
                return;
            }
        }
```

- **MIRROR**: existing block structure (this REPLACES `BoardScene.ts:193-204`), ALLMAN_BRACES.
- **GOTCHA**: Read the current code before editing so the diff is a clean swap, not a duplicate block.
- **VALIDATE**: `npm run typecheck` green. Manual (Phase 7): tap own pebble → tap jump landing → capture animates and applies.

### Task 5: Add `jumpHighlightColor` to `THEME`

```ts
export const THEME = {
    background: 0x111418,
    boardLine: 0xe8e2d0,
    boardLineWidth: 6,
    vertexDot: 0xe8e2d0,
    pebble: { 1: 0xe53935, 2: 0x1e88e5 },
    pebbleRadius: 34,
    vertexRadius: 12,
    tapRadius: 120,
    moveTweenMs: 200,
    highlightColor: 0xffffff,
    //  Distinct from highlightColor so a jump landing reads as visually
    //  different from a quiet destination.
    jumpHighlightColor: 0xffb300,
    aiMoveDelayMs: 400
} as const;
```

- **MIRROR**: flat-object style, key ordering.
- **GOTCHA**: Amber (`0xffb300`) needs contrast against `pebble[1]` (red) and `pebble[2]` (blue) — adjust during Phase 7 playtesting if hard to distinguish.
- **VALIDATE**: `npm run typecheck` green.

---

## Testing Strategy

**No new unit tests** — no `BoardScene.test.ts` exists in this codebase. Manual validation is this phase's real check.

### Manual Validation
- [ ] `npm run dev`, select Pebble Clash: all 32 pebbles at correct positions, centre row empty.
- [ ] well/morris unaffected.
- [ ] Tap a pebble with a quiet move: white ring + quiet-highlight color on destination.
- [ ] If a capture is available: jump landing shows distinct `jumpHighlightColor`.
- [ ] Tap the jump landing: pebble hops (not slides) through captures; captured pebbles vanish.

---

## Validation Commands

```bash
npm run typecheck
npm test
```
EXPECT: zero errors; all existing tests still green (this phase touches only `BoardScene.ts`/`theme.ts`, neither imported by any `engine/__tests__` or `modes/__tests__` file).

```bash
npm run dev
```
EXPECT: see Manual Validation checklist.

---

## Acceptance Criteria

- [ ] `create()` spawns pebble objects for every occupied vertex on a preplaced mode; well/morris no-op
- [ ] `syncPebbles` renders a `jump`: hop-by-hop animation, captured pebbles destroyed
- [ ] Highlights show quiet vs jump destinations distinctly
- [ ] `onVertexTap` resolves a jump-landing tap correctly, preferring jump over quiet on overlap
- [ ] `npm run typecheck` + `npm test` green (regression only)
- [ ] Manual validation checklist passes

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `this.tweens.chain()` API mismatch in installed Phaser 4.0.0 | **M** | Task 2 GOTCHA: verify against `node_modules/phaser` types; documented fallback (nested `onComplete`) |
| Extracting `spawnPebbleAt` changes `'place'` visual behaviour | L | Pure refactor — same circle, same setup, relocated only |
| Overlapping quiet/jump highlight (shouldn't happen given draughts geometry) | L | Jump drawn after quiet, wins visually if it occurs |

---

*Next: Phase 7 (verify) — full test suite, typecheck, end-to-end manual playthrough hotseat + vs AI.*
