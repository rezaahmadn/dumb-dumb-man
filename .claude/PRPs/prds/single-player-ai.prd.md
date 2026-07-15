# Single-Player Mode: Simple AI Opponent (Pebble Trap)

Adds a Solo mode where one human plays against a computer-controlled second player. Extends the shipped `pebble-trap` game (all 5 phases complete) and its threefold-repetition draw rule (complete). Normative spec, written so a smaller model can implement without guessing.

## Problem Statement

Pebble Trap is hotseat-only today — two humans, one device. A solo player with no one to hand the device to cannot play at all. Cost of not solving: the game is unusable for anyone alone with the app open.

## Evidence

- User request (this conversation): "make the game playable in single player... by adding a simple AI."
- Original PRD explicitly named this as future work, not an afterthought: "AI opponent — deferred; game tree is tiny (~5 vertices), a perfect solver is easy later" (`pebble-trap.prd.md:35`); "Opponent | hotseat only | +AI | user choice; AI trivial to add later" (`pebble-trap.prd.md:365`); "Non-Users: ... Solo players (until AI mode ships)" (`pebble-trap.prd.md:70`) — solo players were always meant to convert into users once AI shipped.
- Technical grounding (this PRD, via codebase exploration): engine is pure, tested, and fully decoupled from Phaser/React (`src/game/engine/rules.ts`, `src/game/engine/types.ts` — zero imports outside `engine/`), and the movement-phase state space is exactly 60 positions (proven by exhaustive search, `draw-by-repetition.prd.md:15`). This makes "simple AI" mean something precise here: a small, fully-correct solver, not a heuristic guess.

## Proposed Solution

A pure, engine-adjacent solver module computes the game-theoretic value (WIN/LOSS/DRAW) of any reachable position via graph search over the finite state space, and picks an optimal move. It reuses `legalMoves`/`applyMove` as its only transition functions — it never re-derives trap or draw rules. The engine (`types.ts`, `rules.ts`) is untouched; "AI-ness" is a caller-side concept (like input handling), matching the existing architecture where the engine knows nothing about who or what is playing.

Chosen over a random-move or heuristic bot because the state space is exhaustively small — an optimal solver is not more complex to build than a heuristic one here, and it's the approach the original PRD itself anticipated ("perfect solver is easy").

## Key Hypothesis

We believe a graph-search-based bot, layered on the existing pure engine with no engine changes, will let a single player complete a full game with no second human present.
We'll know we're right when a solo player can pick Solo mode, play a full game (placement → movement → trap or draw) against the bot with zero illegal AI moves and zero UI stalls, verified by an in-browser playtest plus an exhaustive vitest suite that checks every AI move against the computed optimum.

## What We're NOT Building

- Difficulty levels or a deliberately weakened bot — v1 ships one strength (optimal play). Optimal is the simplest *correct* baseline for a provably tiny game; tuning down is a fast-follow if optimal play turns out to make the game one-sided (see Technical Risks) — not a v1 blocker.
- Choice of color/turn order — human is always red (player 1, first mover), AI is always blue (player 2). Matches `initialState`'s existing default (`rules.ts:12`); least new state.
- Undo / take-back vs. the AI — no undo exists in hotseat today either; not introduced here.
- Bot personality, avatar, taunts, adjustable "thinking time," or move hints for the human.
- Online play, additional board modes — already out of scope per the original PRD (`pebble-trap.prd.md:183`), unaffected by this change.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Legal-move guarantee | AI move is always ∈ `legalMoves(cfg, state)` | exhaustive vitest sweep over all reachable states |
| Optimal play | AI's chosen move always matches the computed game-theoretic value (never picks a WIN-forfeiting or DRAW-forfeiting move when a better one exists) | vitest comparing chosen move's value to max over `legalMoves` |
| Solved-graph invariant | Movement-phase label table = 8 WIN nodes (all win-in-one) / 0 LOSS nodes / 48 DRAW nodes, opening position = DRAW | vitest assertion against these exact counts (also guards against a future regression silently changing game balance) |
| No regression | Existing engine tests (T1–T12 + sanity) stay green, unchanged | `vitest` |
| Solo game playable end-to-end | Full game (placement → movement → trap/draw) completable vs. AI with no console errors, no stuck turns | in-browser manual playtest |
| Responsive feel | AI move lands within ~1s of the human's move (compute is near-instant; delay is intentional, not lag) | in-browser manual playtest |

## Open Questions

- [x] ~~Is the game-theoretic value of the opening position a forced WIN for either side, or a DRAW under optimal play?~~ **RESOLVED by adversarial review's exhaustive fixpoint solve**: the opening position is a **DRAW** under optimal play, and in fact the entire 56-node live movement graph has **zero forced-LOSS nodes** (only 8 WIN nodes, all win-in-one, 48 DRAW nodes). This means the "unfair, unwinnable Solo mode" product risk in Technical Risks is defused, not just deferred — the AI can never force a win against a careful human; it can only win if the human blunders into one of the 8 win-in-one traps, or hold to a draw. This should be re-verified as a byproduct of Phase 1's own test suite (see Success Metrics), not just cited from this review.
- [ ] Should AI move selection prefer the fastest forced win / slowest forced loss among equally-valued moves (so a winning AI doesn't stall forever before delivering the trap)? Leaning yes (Should, cheap given values are already computed) — see Core Capabilities / Move selection. Low-stakes in well mode specifically since every WIN is already win-in-one and no LOSS nodes exist, so this clause is close to dead code here; keep it correct (retrograde BFS distance, not DFS depth) in case a future mode needs it for real.
- [ ] Exact UI delay before the AI's move renders (fixed ~400ms vs. none) — cosmetic, left to implementation.

---

## Users & Context

**Primary User**
- **Who**: One person, one device (phone or laptop), same physical context as hotseat play but alone.
- **Current behavior**: Opens the app, cannot start a game without a second human present; gives up or waits for someone else.
- **Trigger**: Wants to play Pebble Trap and no second player is available.
- **Success state**: Picks Solo from a mode-select step, plays a complete game against the bot, sees a win/loss/draw outcome, can restart.

**Job to Be Done**
When I open the game alone with no second player available, I want to play a full round against a computer opponent, so I can still experience Pebble Trap solo.

**Non-Users**
Existing hotseat players who always have a second human present — unaffected; hotseat remains the default/untouched path aside from an added mode-select step.

---

## Solution Detail

### Rules (NORMATIVE — implement exactly)

#### Solver scope
Two disjoint sub-problems, matching the engine's own phase split:

1. **Placement phase** — strictly monotonic (pebble count only increases each ply), therefore **acyclic**. A placement position can never recur (same fact already established in `draw-by-repetition.prd.md:79`: "Placement positions strictly gain pebbles... and can never recur"). Solve with plain finite-depth minimax/negamax over the placement tree (≤4 plies total, branching ≤5) — no memoization needed, no cycle handling needed. The final placement move (the placement→movement transition) can itself end the game — the trap check at `rules.ts:106-110` is gated to run on that transition and on every movement move (`rules.ts:97`), not on intermediate placement plies — this transition is just another terminal leaf for the solver, detected because `applyMove` returns `phase:'gameover'` (this is exactly test vector T7, `rules.test.ts:81-89`).
2. **Movement phase** — the state space is exactly 60 positions (`board layout × side-to-move`, proven in `draw-by-repetition.prd.md:15`; 56 of them are "live" nodes with ≥1 legal move, 4 are trapped terminals), but naive tree search over it is unbounded — two careful players can cycle. Brute-forcing a tree that deep is infeasible, and DFS-with-memoization is a trap of its own: a **naive on-stack-DFS that labels any back-edge to an in-progress ancestor as DRAW is a known-incorrect algorithm for solving graphs with draw-cycles in general** — a node can be memoized with a provisional DRAW before the ancestor it points to has actually resolved, silently corrupting the memo if that ancestor later turns out to be a true LOSS. (This was caught during adversarial review — see status footer. It happens not to bite in well mode specifically only because well mode's solved graph has zero forced-LOSS non-terminal nodes, so the failure case never arises there; that is a fragile, undocumented accident, not something to rely on, and it would silently break for any future mode with a forced-loss position.)

   Solve instead via **retrograde analysis / fixpoint labeling** — the standard, unconditionally-correct algorithm for finite two-player game graphs where unresolved cycles are draws (same technique endgame tablebases use):
   1. Enumerate every live movement position `(board, sideToMove)` (has ≥1 legal move via `legalMoves`). A position where `sideToMove` has 0 legal moves is a terminal **LOSS-for-sideToMove** (a trap outcome) — it is never itself a node `chooseMove` is called on, only a value reachable as some parent's move.
   2. For each live node, compute its moves via `applyMove`: each is either an immediate WIN (`applyMove` returns `phase:'gameover'`, `winner === sideToMove`) or a transition to a successor live node.
   3. Iterate to a fixpoint over all 56 live nodes: label a node **WIN** if it has an immediate-trap move OR a move to a successor labeled **LOSS**; label it **LOSS** if every move leads to a successor labeled **WIN**. Repeat until no label changes in a full pass.
   4. Any node still unlabeled after the fixpoint is **DRAW** — these are exactly the positions from which neither side can force a win, i.e. positions that can be held in an infinite/repeating line, which the engine's real threefold-repetition rule (`draw-by-repetition.prd.md`) is what actually terminates such a line in real play. This is the correct place to invoke that equivalence — not the search algorithm itself.
   5. `chooseMove` reads the precomputed label table (56 nodes — trivial to hold in memory) and picks accordingly (see Move selection below).

   Do not implement this as DFS-with-on-stack-cycle-as-draw, and do not implement it as a fixed-max-depth minimax either (a depth cap can misjudge a position whose true resolution lies deeper than the cap) — fixpoint iteration over the 56-node graph is the same order of code size and is unconditionally correct.

   **Search-time history**: the solver threads a fixed *empty* `history` into any internal `applyMove` calls it makes while building the label table, and relies solely on the fixpoint's own DRAW label for cycles — `applyMove`'s built-in threefold-repetition draw (`rules.ts:116`, gated by `EngineConfig.repetitionLimit`) is not expected to and must not fire during this offline solve; it only matters for the real, live game history during actual play (which the AI never needs to consult — it re-derives the position's label from `(board, sideToMove)` alone).

#### Transition function
The solver's ONLY way to advance a position is `applyMove(cfg, state, move)` and its ONLY way to enumerate options is `legalMoves(cfg, state)`. Never hand-roll trap/draw/legality logic in the AI module — this guarantees the AI can never disagree with the engine about what's legal or terminal, and inherits the T7 (placement-phase trap) and T8/T9 (draw/win-ordering) invariants for free.

#### Value representation
Ternary from the mover's perspective at each node: `WIN | LOSS | DRAW` (derived from `applyMove`'s terminal state: `phase:'gameover'` with `winner === mover` → WIN for the player who just moved, `winner === opponent` → LOSS, `winner === null` → DRAW; a non-terminal child's value is the negamax of its own best continuation).

#### Move selection & tie-breaking (NORMATIVE)
1. Prefer the highest-value legal move: WIN > DRAW > LOSS.
2. Among moves of equal value, prefer (Should, not Must) the one with the shortest distance to WIN, or if all are LOSS, the longest distance to LOSS ("prolong the loss") — but compute this distance correctly: **retrograde BFS layering from the terminal traps** (distance = number of fixpoint iterations until a node first gets labeled, standard for retrograde solvers), NOT DFS-visit-depth — a single DFS's first-seen depth is path-dependent and is not the true shortest distance in a graph with multiple routes to the same node. For well mode specifically this clause is close to moot: adversarial review's exhaustive solve found all 8 WIN nodes in the real graph are win-in-one (an immediately available trapping move), and there are zero LOSS nodes anywhere in the space (see Open Questions / Decisions Log), so "shortest path to WIN" is trivially 1 and "prolong the loss" never triggers. Implement BFS-layering if this Should ships; skippable for a first pass.
3. Among remaining ties, pick deterministically by `legalMoves` array order (first element) — never `Math.random()` — so AI behavior is reproducible in tests. (`Date.now()`/`Math.random()` are also unavailable in this project's own tooling conventions — deterministic tie-break avoids the question entirely.)

#### Where AI-ness lives
`GameState` and `EngineConfig` are NOT modified — no `playerKind`/`isAI` field. "Which side is AI-controlled" is a caller-side concept (UI/session layer), exactly like input handling already is. The solver module takes only `(cfg, state)` and returns a `Move`; it has no notion of "am I player 1 or 2," the caller only invokes it when it's the AI's configured turn.

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `chooseMove(cfg, state): Move` — pure, engine-adjacent, zero Phaser/React imports | the feature; matches `engine/` purity boundary |
| Must | Movement-phase graph search with memoization + on-stack-cycle-as-draw | correctness without infeasible depth |
| Must | Placement-phase finite-depth search (acyclic, no memoization needed) | correctness, simpler than movement phase |
| Must | AI move always legal, always uses `applyMove`/`legalMoves` as sole transition/enumeration | never disagrees with engine |
| Must | Mode-select step (Solo vs. Hotseat) before board mounts | entry point to the feature |
| Must | Turn-gating: board input blocked while it's the AI's turn | prevents human moving for the bot |
| Should | Fastest-win / slowest-loss tie-break | avoids a "won but stalling" bot |
| Should | Short artificial delay before AI move renders + HUD "thinking"/"vs AI" indication | feel, not correctness |
| Could | Difficulty levels / weakened bot | only if playtesting shows optimal play is one-sided/unfun |
| Won't | Color/turn-order choice, undo vs. AI, bot personality | v1 scope cut |

### MVP Scope
Phase 1 (solver + tests) validates correctness headlessly, exactly like the draw-by-repetition precedent. Phase 2 (mode-select + wiring) makes it playable.

### User Flow
Open app → mode-select screen (Solo / Hotseat) → Solo: board mounts with human=red, AI=blue → human moves normally (existing tap/drag flow, untouched) → inside `BoardScene`, immediately after `applyAndSync` runs for the human's move, it checks `this.state.current === aiPlayer && this.state.phase !== 'gameover'`; if true, a short delay elapses, then the same `applyAndSync(move)` path (fed `ai.chooseMove(cfg, this.state)`) applies the AI's chosen move — this is entirely internal to `BoardScene`, not driven by the React-facing `game-state-changed` EventBus emit (that emit is HUD-only, consumed by `App.tsx` for display) → HUD updates, turn returns to human → repeats to trap-win or draw, same end-of-game overlay as hotseat ([Play again] / [Menu]).

---

## Technical Approach

**Feasibility**: HIGH — engine already exposes pure, tested `legalMoves`/`applyMove`/`initialState`; zero engine changes required; the AI is purely additive and slots into the same purity boundary the engine already documents and enforces (`types.ts:1`: "engine/ imports NOTHING outside engine/ — no phaser, no react, no modes/").

**Architecture Notes**
- New module `src/game/engine/ai.ts` (sibling to `rules.ts`), importing only from `./types` and `./rules` (or `./board` if adjacency is useful) — same import discipline as the rest of `engine/`.
- `BoardScene` gains a small turn-gating check: after `applyAndSync`, if the new `this.state.current` equals the configured AI player and `phase !== 'gameover'`, schedule `ai.chooseMove(cfg, this.state)` after a short delay, then call the SAME `applyAndSync` used for human taps/drags — zero duplicated legality logic, zero new terminal-state handling.
- `App.tsx` gains a mode-select step producing an `opponentType: 'human' | 'ai'` (or equivalent) choice, threaded down to `BoardScene` at construction — deliberately named to avoid clashing with the existing `modeId` concept (`App.tsx:12-13`), which already means "which board/ruleset" (e.g. `'well'`), a different axis entirely.
- Human is always player 1 (red), AI is always player 2 (blue) in v1 — `initialState` already starts player 1 to move (`rules.ts:12`), so no engine change is needed to enforce this; it's just which side the caller drives via input vs. via `chooseMove`.

**Files (expected)**
- `src/game/engine/ai.ts` — new: `chooseMove(cfg, state): Move`, placement-phase search, movement-phase memoized graph search.
- `src/game/engine/__tests__/ai.test.ts` — new: legality sweep, optimal-value checks, placement/movement phase coverage, tie-break determinism.
- `src/game/scenes/BoardScene.ts` — turn-gating call to `ai.chooseMove` on the AI's turn, reusing `applyAndSync`.
- `src/App.tsx` — mode-select UI (Solo/Hotseat), threads `opponentType`/AI player number down.
- `src/ui/Hud.tsx` — optional "vs AI" / "thinking..." indicator (Should, not Must).
- `vitest.config.ts` — confirm `include` glob (`src/game/engine/**/*.test.ts`) already covers the new `ai.test.ts`; no change expected.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Naive movement-phase search recurses without bound, or a naive on-stack-DFS memoizes a provisional/wrong DRAW before an ancestor resolves | H if implemented as DFS-with-on-stack-cycle-as-draw (confirmed incorrect in general by adversarial review, with a constructed counterexample) | use retrograde/fixpoint labeling instead (see Rules, Movement phase) — unconditionally correct on a finite graph, no on-stack subtlety; Phase 1 tests assert against the known 60-position space |
| Optimal play makes the game one-sided, Solo mode feels unfair | **RESOLVED, was M — now confirmed LOW.** Adversarial review's exhaustive solve found the opening position is a DRAW and the movement graph has zero forced-LOSS nodes: the AI can never force a win against careful play | Phase 1's own test suite re-confirms this as a byproduct of computing the label table; no weakened-difficulty fast-follow expected to be needed for v1 |
| Placement-phase trap check (a placement move can end the game, `rules.ts:106-110`) treated as a non-terminal node by mistake | M if AI re-derives terminality instead of reading `applyMove`'s returned `phase` | AI only ever calls real `applyMove`; never hand-rolls trap/draw detection |
| AI compute jank stalls UI thread | L — 60-position table is trivial to compute | wrap in `setTimeout`/microtask; also doubles as the intentional "thinking" delay |
| Mode-select naming collides with existing `modeId` (board ruleset) concept | L but confusing if hit | new field named distinctly (`opponentType`, not `mode`), called out explicitly in code and this doc |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | AI solver + tests | `ai.ts` (placement search + movement graph search), `ai.test.ts` (legality + optimality + regression) | complete | - | - | [plan](../plans/completed/single-player-ai-phase-1-solver.plan.md) · [report](../reports/single-player-ai-phase-1-solver-report.md) |
| 2 | Mode-select + wiring | Solo/Hotseat mode-select UI, `BoardScene` turn-gating, `applyAndSync` reuse, optional HUD "vs AI"/thinking indicator | pending | - | 1 | - |

### Phase Details

**Phase 1: AI solver + tests**
- **Goal**: correct, tested, optimal move selection, zero rendering, zero engine changes.
- **Scope**: `src/game/engine/ai.ts` (fixpoint/retrograde solver, not on-stack DFS — see Rules), `src/game/engine/__tests__/ai.test.ts`. Assert the solved-graph invariant (8 WIN / 0 LOSS / 48 DRAW, opening = DRAW) from Success Metrics as a concrete test, not just a comment.
- **Success signal**: `vitest` green including new AI tests; existing engine tests (T1–T12 + sanity) unchanged; no Phaser/React import under `engine/ai.ts`.

**Phase 2: Mode-select + wiring**
- **Goal**: a human can actually play Solo mode in the browser.
- **Scope**: `App.tsx` mode-select step, `BoardScene` AI-turn detection + delayed `applyAndSync` call, optional Hud "vs AI"/"thinking" text.
- **Success signal**: in-browser, pick Solo, play a full game to trap-win or draw against the bot, zero console errors, zero stuck turns; Hotseat path unchanged and still works.

### Parallelism Notes
Sequential — Phase 2 depends on Phase 1's `chooseMove` existing and being correct. Phase 1 is independently valuable/verifiable headlessly, same pattern as the draw-by-repetition precedent.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| AI strength | full optimal solver (graph search) | random-legal-move bot; shallow heuristic | state space is exhaustively small (60 movement positions + tiny placement tree); optimal is the simplest *correct* implementation here, and matches the original PRD's own framing ("perfect solver is easy") |
| AI color/turn order | AI always player 2 (blue), always second | user picks color | matches `initialState`'s existing default; zero engine change; color choice deferred as Could |
| Movement-phase cycle handling | retrograde/fixpoint labeling over the 56-node live graph | fixed max-depth minimax; naive on-stack-DFS-as-draw | depth cap can misjudge positions deeper than the cap; on-stack-DFS is a known-incorrect algorithm in general (constructed counterexample in adversarial review) that only coincidentally avoids misfiring in well mode because well mode has zero forced-LOSS nodes — too fragile to spec normatively, so fixpoint (unconditionally correct) was chosen instead |
| Engine changes | none — `types.ts`/`rules.ts` untouched | add `playerKind`/`isAI` to `GameState`/`EngineConfig` | preserves the documented "engine knows nothing about players' nature" boundary; AI-ness is caller-side, like input handling |
| Difficulty levels | out of v1, single (optimal) strength only | ship tunable difficulty from the start | avoids building/tuning a heuristic for a problem (fairness) that's still unconfirmed; revisit only if playtesting shows it's needed |

---

## Research Summary

**Market Context**
Pebble Trap is a custom placement/movement variant of *umul gonu* — no direct off-the-shelf competitor to benchmark against. Skipped deep market research as low-value for this feature; the relevant precedent is internal (the engine's own prior PRDs), not external products.

**Technical Context**
Engine is pure TS with `initialState`/`legalMoves`/`applyMove` (`src/game/engine/rules.ts`), zero Phaser/React imports, 22/22 tests passing. No AI/bot code exists yet; the original PRD explicitly deferred it as easy future work (`pebble-trap.prd.md:35,183,365`). The completed threefold-repetition feature (`draw-by-repetition.prd.md`) already proved the movement-phase state space is exactly 60 positions and that any infinite line is forced to a real draw within ~120 plies — this PRD's movement-phase solver design leans directly on that proof rather than re-deriving it.

---

*Generated: 2026-07-15*
*Status: REVIEWED — adversarially refuted by an Opus agent 2026-07-15 (exhaustive fixpoint solve of the real 60-position movement graph, cross-checked against an independent iterative-deepening negamax and against the shipped `legalMoves`/`applyMove`). Main finding: the originally-specified on-stack-DFS-as-draw algorithm is a textbook-incorrect way to solve graphs with draw-cycles (constructed counterexample: an ancestor can be memoized with a provisional DRAW before its true LOSS/WIN value is known) — it happened to produce correct moves in well mode ONLY because well mode's solved graph has zero forced-LOSS nodes, an unstated structural accident, not a proof. Replaced with retrograde/fixpoint labeling (unconditionally correct). 4 additional findings applied: "fastest-win/slowest-loss" tie-break corrected from DFS-depth to retrograde-BFS-distance (was unsound in general, harmless here since every WIN is win-in-one); search-time `history` handling during the offline solve made explicit (empty history threaded, `applyMove`'s own repetition-draw never fires during search); "trap check runs after every move" tightened to "on the placement→movement transition and after every movement move," matching `rules.ts:97`; User Flow's AI-turn trigger corrected from the React-facing `game-state-changed` EventBus emit to the actual internal `BoardScene` check after `applyAndSync`, matching Architecture Notes. Bonus finding folded in: the opening position is a proven DRAW and the movement graph has zero forced-LOSS nodes, which resolves Open Question #1 and downgrades the "Solo mode feels unfair" risk from Medium to Low. Survived: all file:line citations, the placement-phase acyclic claim, the placement-move-as-terminal-leaf claim, human=red/AI=blue default, `applyAndSync` reuse viability, the 60-position/56-live/4-terminal count, and tie-break determinism (value ordering + array-order tie-break) — only the distance sub-clause needed correcting. Relates to completed pebble-trap.prd.md and draw-by-repetition.prd.md.*
