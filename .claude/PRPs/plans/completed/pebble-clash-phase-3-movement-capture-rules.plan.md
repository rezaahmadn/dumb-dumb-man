# Plan: Pebble Clash — Phase 3: Movement + Capture Rules

## Summary

Implement the core draughts rules: quiet moves (adjacent step, flying long-range at ≤threshold), jump-capture chains (forced-maximal, optional), and elimination win. Replaces the Phase 2 `throw` with the real `legalMoves` draughts branch; extends `applyMove` to handle jumps and elimination.

## User Story

As a player, I want to move pebbles one step along a line, jump to capture opponents' pebbles in extended chains, and end the game by eliminating the opponent, so I can play a complete game from start to finish.

## Problem → Solution

`legalMoves` throws on `'draughts'`; `applyMove` rejects all jumps as illegal; no elimination. → `legalMoves` enumerates quiet steps + maximal jump chains; `applyMove` applies jumps, detects elimination + no-move loss.

## Metadata

- **Complexity**: Medium — chain enumeration is recursive but well-bounded.
- **Source PRD**: `.claude/PRPs/prds/pebble-clash.prd.md`
- **PRD Phase**: 3 — "Movement + capture rules"
- **Estimated Files**: 1 UPDATE (rules.ts), 1 UPDATE (test file)
- **Depends on**: Phase 2 (types + initialState complete).

---

## UX Design

**N/A — internal change.** No player-visible behaviour until Phase 6. Rule validation only.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/game/engine/rules.ts` | 53–180 (legalMoves, applyMove) | Functions you extend |
| P0 | `src/game/engine/board.ts` | all | adjacency, edgesFromLines |
| P0 | `.claude/PRPs/prds/pebble-clash.prd.md` | "Technical Approach" (line 189–193) | Phase 3 spec |
| P1 | `src/game/engine/__tests__/clash.test.ts` | all | Test fixture + conventions |
| P1 | `src/game/engine/__tests__/rules.test.ts` | 1–50 | Test patterns |

## External Documentation

None.

---

## Patterns to Mirror

### COMMENT_STYLE
```ts
//  Keyed by board object identity... so the ~3360-node alignment AI solve doesn't rebuild
```
`//` + two spaces, rationale-heavy.

### MOVE_ENUMERATION
```ts
moves = [];
const seen = new Set<string>();
for (const line of cfg.board.lines) {
    for (let i = 0; i < line.length; i++) {
        if (s.board[line[i]] !== s.current) continue;
        for (const dir of [1, -1]) {
            for (let j = i + dir; j >= 0 && j < line.length; j += dir) {
                if (s.board[line[j]] !== null) break;
                const key = `${line[i]}>${line[j]}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    moves.push({ kind: 'move', from: line[i], to: line[j] });
                }
            }
        }
    }
}
```
Enumerate lines, both directions, dedup by key, break on occupied.

### BOARD_MANIPULATION
```ts
const board = { ...s.board };
...
board[m.from] = null;
board[m.to] = s.current;
```
Spread-copy, mutate in place, never mutate original.

---

## Files to Change

| File | Action |
|---|---|
| `src/game/engine/rules.ts` | UPDATE: add `pebbleCount`, replace draughts throw with full branch + `enumerateJumpChains` helper, extend `applyMove` for jumps + elimination |
| `src/game/engine/__tests__/clash.test.ts` | UPDATE: add D1–D6 test blocks |

## NOT Building

- Phase 4 (AI dispatch), Phase 5 (mode def), Phase 6 (scene) — all downstream.

---

## Step-by-Step Tasks

### Task 1: Add `pebbleCount` helper

```ts
export function pebbleCount(board: Record<VertexId, PlayerId | null>, player: PlayerId): number {
    return Object.values(board).filter((p) => p === player).length;
}
```

**VALIDATE**: `npm run typecheck` green.

### Task 2: Implement `enumerateJumpChains` helper (before `legalMoves`)

Recursive chain enumeration per line direction. Working board copy removes jumped pebbles to prevent re-capture. Returns maximal chains sorted by length descending, stable on order.

**Key logic:**
- For each player pebble, for each line, for each direction: find adjacent opponent + empty beyond.
- Recursively extend: can we jump again from the landing?
- Dedup on `{ from, hops }`.
- Return chains with `kind: 'jump'`.

**VALIDATE**: `npm run typecheck` green. Behaviour tested in Task 5.

### Task 3: Replace draughts throw in `legalMoves`

Delete the `if (cfg.movement === 'draughts') throw ...` guard. Replace with:

**Quiet moves:**
- Adjacent empty only if NOT flying.
- Long-range slides if flying (≤3 pebbles). Perimeter lines (length 3) single-step only.
- Dedup by `seen` set.

**Jump chains:**
- Call `enumerateJumpChains`, push all results.

**Return** both quiet + jump moves (optional capture).

**VALIDATE**: `npm run typecheck` green.

### Task 4: Extend `applyMove` for jumps + elimination

After `if (m.kind === 'move')` block, add:
```ts
} else if (m.kind === 'jump') {
    for (const hop of m.hops) {
        board[hop.over] = null;
    }
    const lastHop = m.hops[m.hops.length - 1];
    board[m.from] = null;
    board[lastHop.to] = s.current;
}
```

Before the existing trap check, add elimination win:
```ts
if (m.kind !== 'pass' && (cfg.win ?? 'trap') === 'elimination') {
    const opponentCount = pebbleCount(board, s.current === 1 ? 2 : 1);
    if (opponentCount === 0) {
        return { ...next, phase: 'gameover', winner: s.current };
    }
}
```

The existing trap check (line 160, gated on `win !== 'alignment'`) will handle no-move loss unchanged.

**VALIDATE**: `npm run typecheck` green.

### Task 5: Write test vectors D1–D6

Append to `clash.test.ts`:

- **D1**: Quiet moves return adjacent empty
- **D2**: Single jump emits + applies correctly (removes captured, lands mover)
- **D3**: Elimination win when opponent reaches 0
- **D4**: No-move loss detected (no legal moves available)
- **D5**: Regression — well/morris modes still work
- **D6**: Open questions (Q1, Q2) — documented TBD

Test uses `FIXTURE` (3-vertex line: a, b, c) and variants.

**VALIDATE**: `npm test` — 10+ new tests pass.

---

## Testing Strategy

| Test | Expected | Edge Case? |
|---|---|---|
| D1 quiet | Moves include adjacent | no |
| D2 jump | Jump emitted + applied | **yes** |
| D3 elimination | Winner set when opponent = 0 | **yes** |
| D4 no-move | Moves = [] when trapped | **yes** |
| D5 regression | Existing modes work | **yes** |
| D6 Q1/Q2 | Documented TBD | yes |

---

## Validation Commands

```bash
npm run typecheck
npm test 2>&1 | tail -5
```

EXPECT: zero type errors, 60+ tests passing.

---

## Acceptance Criteria

- [ ] `legalMoves` draughts: quiet moves (step + flying), maximal jump chains
- [ ] Quiet and jump both returned (optional capture)
- [ ] `applyMove` handles jump: removes `hops[].over`, lands at last `hops[].to`
- [ ] Elimination win detected
- [ ] No-move loss covered by existing trap check
- [ ] D1–D5 tests pass
- [ ] All green: typecheck + test suite

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Infinite recursion in chains | M | Working board copy, no revisiting capture |
| Perimeter rule (Q2) wrong | M | Document heuristic, config seam for Phase 5+ |
| Edge case off-by-one | L | Test at threshold (==3, <3, >3) |

---

*Next: Phase 4 (greedy AI). Then Phase 5 (mode def + board). Then Phase 6 (scene rendering).*
