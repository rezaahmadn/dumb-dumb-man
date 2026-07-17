# Plan: Pebble Clash — Phase 7: Verify

## Summary

No new code. Run the full automated suite, then manually play Pebble Clash to a terminal state twice — once hotseat, once vs AI — confirming elimination and no-move wins both display correctly and Restart works. This is the PRD's closing gate.

## User Story

As the project owner, I want confidence that a full Pebble Clash game — hotseat and vs AI — plays start to finish with correct captures, chains, and win detection, before calling the mode done.

## Problem → Solution

Phases 2–6 are each individually tested but never played together as one continuous game. → A scripted verification pass (automated + manual) exercising the whole stack, cross-referencing any failure back to the phase most likely responsible.

## Metadata

- **Complexity**: Small — no source changes.
- **Source PRD**: `.claude/PRPs/prds/pebble-clash.prd.md`
- **PRD Phase**: 7 — "Verify"
- **Estimated Files**: 0 changed (a found bug routes to a new plan against the owning phase, not scope here).
- **Depends on**: Phases 2–6 all complete.

---

## UX Design

**N/A.** Observes existing UX.

---

## Mandatory Reading

| Priority | File | Why |
|---|---|---|
| P0 | PRD — "Success Metrics" table | Pass/fail bar for this phase |
| P0 | PRD — "User Flow" (7 steps) | Exact sequence to walk through manually, twice |
| P1 | Prior phase reports in `.claude/PRPs/reports/pebble-clash-phase-*-report.md` | Cross-check known risks if something fails |

## External Documentation

None.

## Files to Change

None expected.

## NOT Building

Any fix. This plan documents bugs precisely enough to route to the right phase, not fix them inline.

---

## Step-by-Step Tasks

### Task 1: Full automated suite

```bash
npm run typecheck
npm test
```
EXPECT: zero type errors; every test file green — `rules.test.ts`, `morris.test.ts`, `sanity.test.ts`, `ai.test.ts` (zero regression), `clash.test.ts` (Phase 2/3 vectors), `aiGreedy.test.ts` (Phase 4), `clash-board.test.ts` (Phase 5).

**VALIDATE**: Record final test/file counts in the report (Task 4).

### Task 2: Manual hotseat playthrough

```bash
npm run dev
```

1. Main menu → tap Pebble Clash.
2. Opponent select → Hotseat.
3. Confirm 32 pebbles pre-placed, centre row empty, matches `docs/pebble-clash-board.png` visually.
4. Play alternating moves until a capture appears — confirm jump-landing highlight is visually distinct, tap it, confirm captured pebble(s) vanish and mover visibly hops (not slides). If a chain is available, confirm it auto-resolves as one turn.
5. Continue until one side reaches 0 pebbles OR has no legal move.
6. Confirm HUD shows correct winner, `phase === 'gameover'`.
7. Tap Restart — confirm board resets to the full 32-pebble opening position, not empty (this is the clash-specific regression risk; well/morris restart to empty).

**VALIDATE**: Note any deviation from the PRD's User Flow precisely — which step, what happened instead.

### Task 3: Manual vs-AI playthrough

Repeat Task 2 steps 1–7, selecting Solo (vs AI) at step 2.

Additional checks:
- [ ] AI moves after `THEME.aiMoveDelayMs` (400ms), not instantly, not hung
- [ ] AI takes an available capture when offered (Phase 4's G1 guarantee, now on the real 37-vertex board)
- [ ] Game reaches terminal state without hanging (PRD flags "retrograde AI accidentally invoked at k=16" as High likelihood/impact if Phase 4's dispatch is wrong)

**VALIDATE**: If AI hangs, check `BoardScene.maybeScheduleAiMove` dispatch reads `win === 'elimination'` and routes to `chooseMoveGreedy`.

### Task 4: Write the verification report

Create `.claude/PRPs/reports/pebble-clash-phase-7-verify-report.md`:

```markdown
# Pebble Clash — Phase 7 Verification Report

| Metric | Target | Result |
|--------|--------|--------|
| Full game completes (hotseat) | Reaches gameover, one side at 0 | PASS/FAIL — details |
| Full game completes (vs AI) | AI plays legal moves to terminal state | PASS/FAIL — details |
| AI takes available capture | 100% when offered | PASS/FAIL — details |
| Chain capture correctness | Maximal chain removes every jumped pebble | PASS/FAIL — details |
| Regression | npm test + typecheck green | PASS/FAIL — test count |
| Board fidelity | 16/side, centre empty, matches image | PASS/FAIL — visual check |

## Issues Found
[None, or a precise list: symptom, reproduction, which phase likely owns the fix]

## Open Questions Still Unresolved
[Carry forward Q1, Q2, Q4, Q5, Q6 — note if the playthrough gave evidence toward resolving any]
```

**VALIDATE**: Every metric row has PASS/FAIL and evidence, not just a checkmark.

### Task 5: Update the PRD

Mark Phase 7 complete in the PRD's phase table, link the report, and if all metrics passed, update the footer status line.

---

## Testing Strategy

This phase IS the testing strategy — Task 1's automated run plus Tasks 2–3's manual checklists.

### Edge Cases Checklist (carried forward from PRD)
- [ ] Elimination win
- [ ] No-move loss (Q5) — if reachable in real play, confirm it triggers; if not, note it's covered by Phase 3's D4 unit test instead
- [ ] Flying movement at ≤3 pebbles — if a game runs long enough, confirm long-range slides appear; otherwise note unit-test-only coverage
- [ ] Restart re-seeds 32 pebbles, not empty board

---

## Validation Commands

```bash
npm run typecheck
npm test
npm run dev   # manual playthrough, Tasks 2-3
```

---

## Acceptance Criteria

- [ ] `npm run typecheck` zero errors
- [ ] `npm test` all green, zero regressions
- [ ] Hotseat playthrough reaches gameover correctly
- [ ] Vs-AI playthrough reaches gameover correctly, no hang, AI takes offered captures
- [ ] Restart re-seeds the full board
- [ ] Verification report written with real PASS/FAIL evidence
- [ ] PRD updated to reflect Phase 7 completion

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Playthrough surfaces a real bug from an earlier phase | M | Task 4 routes findings to the owning phase, not patched here |
| AI hangs on the real board despite Phase 4's guard | L if Phase 4 followed plan | Task 3's dispatch-site check is the fast diagnostic |
| Visual board mismatch vs source image | L (Phase 5 E1 already caught structural errors) | Compare directly against `docs/pebble-clash-board.png` |

## Notes

No haiku-specific gotchas — pure execution. If Tasks 2–3 find a bug, the fix belongs in a NEW plan scoped to the owning phase, not an ad hoc edit here.

---

*Final phase in the Pebble Clash PRD. On completion, all 7 PRD phase rows should read `complete`.*
