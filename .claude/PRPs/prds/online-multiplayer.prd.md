# Online Multiplayer

## Problem Statement

Two people who want to play Pebble Trap together must physically share one device — hotseat is the only human-vs-human option the app offers (`apps/web/src/ui/OpponentSelect.tsx:13-18` exposes exactly two buttons: Solo vs AI, Hotseat). Anyone not in the same room as their opponent is limited to playing the AI. The cost of not solving it: the game's only social mode requires co-location, which is the one thing the internet fixed thirty years ago.

## Evidence

- **Confirmed by code**: `OpponentSelect` offers only `'human' | 'ai'`. The `'human'` path is same-device hotseat — `BoardScene` runs one local `GameState` and alternates `state.current` between taps (`apps/web/src/game/scenes/BoardScene.ts:213-269`). There is no network layer anywhere in the repo.
- **Confirmed by project history — this is a deferral coming due, not a whim.** Online multiplayer was explicitly scoped *out* of all three prior PRDs, and the first records it as a deliberate choice rather than an oversight:
  - `pebble-trap.prd.md:34` — "Online multiplayer — hotseat only (**user decision**)."
  - `three-in-a-row.prd.md:63` — "Online multiplayer — hotseat + local AI only."
  - `pebble-clash.prd.md:32` — "**Networked / online multiplayer** — hotseat + local AI only, matching existing modes."
  - `pebble-clash.prd.md:68` names "players wanting online multiplayer" as an explicit *non-user* — "not targeted in v1."

  Three PRDs naming the same excluded feature is the closest thing to a demand signal this project has. It was wanted from the start and postponed on purpose.
- **Confirmed by code**: the engine was built in anticipation of it. `packages/engine/src/index.ts:1-7` states it is *"the shared rule source an authoritative server would import so both sides agree on what a legal move is."* The architecture was shaped around a server that did not exist yet.
- **Assumption — not validated**: that anyone *beyond the author* wants this. Asked who has the problem, the answer was "anyone"; asked why alternatives fail, "i don't know"; asked why now, "i want it". No user research, no request log, no analytics. This is a **builder-motivated feature on a hobby project** whose stated purpose is exercising ECC workflows (commit `3a38852`).
- **Honest framing**: the justification is "the architecture invites it, it was deferred three times, and the author wants it now." Legitimate on a personal project. Not evidenced external demand, and this PRD does not dress it up as such.

## Proposed Solution

Add `apps/server` — a Node + socket.io process that imports `@pebble/engine` and holds the only authoritative `GameState` per room. Players create a 4-character room code; a second player joins with it; the server rolls sides randomly, then relays validated moves. Clients never apply their own moves — they send intent and render whatever state the server echoes back. A shared `packages/protocol` package types every message so client and server cannot drift.

Availability is probed at runtime: the client pings `/health` before rendering the menu. Server reachable → the Online button appears. Unreachable, or `VITE_SERVER_URL` never configured → the button is never rendered, and the game works exactly as today. The network layer is strictly additive.

Chosen because server-authoritative-with-echo makes desync **structurally impossible** rather than merely unlikely — one `GameState` exists in the system, not two that must be kept in agreement. **This property is not free**: the client currently constructs its own state in two places (`BoardScene.ts:78` in `create()`, `:114` in `restartGame()`), and both must be neutralized on the online path or the claim is false. See Phase 7.

## Key Hypothesis

We believe **a server-validated room-code multiplayer mode** will **let two people play across a network without sharing a device** for **anyone who wants to play this game with a remote friend**.

We'll know we're right when **two clients complete a full game across a network with zero desync, the server rejects 100% of forged move attempts, and a mid-game disconnect + rejoin resumes the exact position**.

This tests *whether the thing works*, not *whether anyone wants it*. The demand hypothesis is untested and, on a hobby project, deliberately so.

## What We're NOT Building

- **Matchmaking / public room lists** — room codes shared out-of-band cover "play with a friend". Matchmaking solves "play with a stranger," a different product.
- **Accounts, auth, persistent identity** — a session envelope in `localStorage` scoped to one room is all rejoin needs.
- **Ranked play, ELO, leaderboards** — requires identity, just excluded.
- **Spectators** — 2 seats. Third joiner gets "Room is full".
- **Chat** — out-of-band voice already exists wherever the code was shared.
- **Room persistence across server restart** — in-memory. A deploy kills live games. Accepted; see Technical Risks.
- **Turn timers** — see Open Questions; a real gap, knowingly deferred.
- **Shareable room URLs** — no client-side router today.
- **Horizontal scaling** — single instance. Multi-instance socket.io needs a Redis adapter and sticky sessions.
- **A `apps/web` test harness** — the repo has "zero React/Phaser test coverage **by design**" (`single-player-ai-phase-2-wiring.plan.md:212-219`). Not overturned by this feature. Consequence owned honestly in Verification Reality below.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Forged moves rejected | 100% | `apps/server` vitest suite. **The non-vacuous form**: take `legalMoves(cfg, s)[0]` — a move legal for `s.current` **right now** — and submit it from the *other* seat. Assert rejection. See Phase 1. |
| State unchanged after rejection | Byte-identical | `expect(positionKey(cfg, after)).toBe(positionKey(cfg, before))`. Note `positionKey` is 2-arity (`packages/engine/src/ai.ts:5`). |
| Server tests actually execute | Non-zero count printed | `pnpm -r test` output shows `@pebble/server` with a test count. **A count of zero is a failure**, not a pass — see Technical Risks. |
| Rejoin fidelity | Exact position restored | Server-side test: disconnect mid-game, rejoin within grace, assert returned `GameState` deep-equals server's. |
| Side-roll fairness | ~50/50 over 1000 rolls | Unit test with injected RNG. |
| Desync across a completed game | 0 | **Human playtest, two browsers.** Not machine-verifiable — see Verification Reality. |
| Offline regression | 0 new failures | `pnpm typecheck` green (covers `apps/web` + `packages/engine`) **plus human playtest** of vs-AI and hotseat with `VITE_SERVER_URL` unset. `pnpm test` alone is **not** evidence here — `apps/web` has no `test` script, so `pnpm -r test` runs only `@pebble/engine`, the one package this feature never touches. |

**Metrics honesty**: these measure correctness, not success. There is no "games played" or "retention" target because there is no user base and no analytics. Inventing a number would be theater.

## Open Questions

- [ ] **Stalling has no remedy.** The 60s grace covers *disconnect*, not *inaction*. A connected player who never moves blocks the game forever; the opponent's only escape is to leave. Turn timer in v1, or is "leave the room" acceptable between friends? Deferring, but naming it.
- [ ] **Where does the server deploy?** Netlify is static-only. Fly / Railway / Render all work; none chosen. **Blocks Phase 12 planning.** Until then `VITE_SERVER_URL` is unset in prod, the button never renders, and the feature ships dark — correct, graceful, and worth saying out loud.
- [ ] **CORS origin.** Needs the real Netlify domain plus a localhost origin for dev.
- [ ] **Health probe cadence.** `App.tsx:43-48` (`toMenu` → `opponentType = null`) remounts `OpponentSelect`, so a probe-per-mount re-fires on every return to menu. Probe-per-mount is simplest; cache per session if noisy. **Must be decided at Phase 5 plan time, not left open** — an unresolved question inside a phase is exactly what breaks a low-tier executor.
- [ ] **`'probing'` UI.** The hook has three states and only `'up'` renders the button. For ~1.5s the menu shows two buttons, then a third appears and shifts layout. Spinner, reserved space, or accept the shift? Decide at Phase 5.

---

## Users & Context

**Primary User**
- **Who**: Someone who already knows this game exists — realistically the author and their friends — who wants to play a specific person not in the room.
- **Current behavior**: Plays the AI alone, or waits until physically next to the other person and uses hotseat.
- **Trigger**: "Want to play?" over chat or voice, with the other person elsewhere.
- **Success state**: Both look at the same board on their own devices; it feels like hotseat except the opponent is elsewhere.

**Job to Be Done**
When **I want to play this game with a specific person who isn't next to me**, I want to **send them a short code that drops us into the same board**, so I can **play them without either of us traveling**.

**Non-Users**
- Strangers seeking a random opponent — no matchmaking, and a room code is useless without someone to send it to.
- Competitive players wanting rank — no identity, no ladder.
- Anyone offline — deliberately served by the *existing* modes, which this must not touch.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Server holds the only `GameState`; clients send intent, render echo | The entire anti-cheat and anti-desync story. |
| Must | `applyMoveForSeat` — turn ownership enforced in the only exported mutator | **The one check the engine does not give free**, made structurally unskippable rather than documented. See Architecture Notes. |
| Must | Neutralize both client-side state constructors on the online path | `BoardScene.ts:78` and `:114`. Without this, "one `GameState`" is false. |
| Must | `hydrateState(state)` — render an arbitrary position with no move | Prerequisite for rejoin and rematch. Neither can work without it. |
| Must | Create room → 4-char code; join by code | The core loop. |
| Must | Runtime `/health` probe gates the Online button | Your requirement: never show a button that crashes. |
| Must | Offline modes untouched | Non-negotiable. |
| Must | Random side roll, server-decided, client-animated | Your requirement. Also the only fairness mechanism, since red always moves first. |
| Must | Opponent-disconnected notification | Your requirement. Silence on disconnect is the worst failure mode in networked games. |
| Must | Rejoin same room within 60s grace | Your requirement. Mobile networks drop constantly. |
| Must | Rematch with mutual accept + fresh roll | Your requirement. Fresh roll each game or red's first-move edge compounds. |
| Must | Exit confirmation in online mode — **on both Menu *and* "Play again"** | Your requirement, plus a hole found in review: "Play again" is currently an unguarded local-state-fork button. |
| Should | All three modes online | Server reads `MODES[modeId]` and is mode-agnostic. Restricting to one costs *more*. |
| Should | Room-full rejection | Correctness. Cheap. |
| Could | "Opponent reconnecting…" indicator | Nice signal; grace timer works without it. |
| Won't | Turn timers | Deferred; named in Open Questions. |
| Won't | Matchmaking, accounts, ranked, spectators, chat, room URLs, web test harness | See "What We're NOT Building". |

### MVP Scope

Two browsers, one server. A creates a room in any mode and reads the code aloud. B joins. Server rolls sides, both watch it animate, board opens. Every move round-trips through the server, which rejects anything out-of-turn or illegal. Either player disconnecting shows the other a notice and a 60s window to return. Game ends, both accept rematch, sides reroll. With the server down, none of this UI exists and the game is exactly what it is today.

### User Flow

```
MainMenu (pick mode)
  → OpponentSelect  [probe /health → Online button appears or does not]
      → Solo / Hotseat  ── unchanged local path, no network code touched
      → Online
          → OnlineLobby: [Create Room] | [Join with code ____]
              Create → show code "K7QP", "waiting for opponent…"
              Join   → validate code
          → both present → server rolls
          → RollScreen: ~2s animation → "You are RED" / "You are BLUE"
          → BoardScene (online): tap sends intent → server validates → echo → render
          → gameover → [Rematch] (both accept → reroll → new game) | [Menu] (confirm)
```

---

## Technical Approach

**Feasibility**: **HIGH** for the server, **MEDIUM** for the client — and the split matters.

The server is genuinely easy: the engine was designed for it, `applyMove` already re-validates and throws (`packages/engine/src/rules.ts:279-288`), and every server phase is machine-verifiable. The client is where the risk lives, because the Phaser/React lifecycle was built on assumptions this feature breaks, and because `apps/web` has no automated tests by design.

**The crux — `applyMove` validates the move but not the mover:**

`applyMove` validates *that the move is legal*. It does **not** validate *who sent it*. It applies the move as `s.current`, whoever that is (`rules.ts:292-306`). `legalMoves(cfg, s)` only ever generates moves for `s.current` (`rules.ts:57-168`). So the exploit is counterintuitive:

- A move that is **not** in `legalMoves(state)` → `applyMove` throws at `rules.ts:287` **already**. Not the threat.
- A move that **is** in `legalMoves(state)` — i.e. one of *Red's* legal moves — sent from *Blue's* socket → applied as Red. **The engine does not blink.**

This inverts the obvious test. A test that submits "a move Blue could legally make, while it's Red's turn" passes *with no turn check present*, because `applyMove` rejects it anyway. Such a test is worse than none: it is a green check named `rejects out-of-turn moves` that guards nothing.

**Making it unskippable rather than documented** (Phase 1):
1. `apps/server/src/authority.ts` exports `applyMoveForSeat(cfg, state, move, seat): {ok:true, state} | {ok:false, reason}` — the **only** mutator handlers may call.
2. A test greps `apps/server/src/handlers/` for `applyMove` and fails if found. Omitting the check now requires deleting a test.
3. The test body is inlined verbatim in the plan, not described: `const m = legalMoves(cfg, s)[0]` (legal for seat 1 *now*) then `expect(applyMoveForSeat(cfg, s, m, 2).ok).toBe(false)`. **That literal `legalMoves(...)[0]` line is what makes the test non-vacuous.**
4. It lands in Phase 1, as a pure function with no socket noise.

**Architecture Notes**

- **`packages/protocol`** (new) — shared event names and payload types imported by both sides. The monorepo already shares this way (`@pebble/engine`); typing the wire prevents payload drift and is what makes the server/client phases genuinely parallel.
- **`apps/server`** (new) — socket.io, `Map<RoomCode, Room>` in memory, no DB. **Must ship a `test` script and its own `vitest.config.ts` in Phase 1** — see Technical Risks.
- **Two render paths are needed, not one.**
  - `applyServerUpdate({ move, state })` — the move-driven path. Reuses `syncPebbles(move)` and its tweens.
  - `hydrateState(state)` — the **stateless** path: destroy every `pebbleObjects` entry, respawn from `state.board`. Required by rejoin (a reload has no move) and rematch (a new game has no move). This is the "diff and rebuild" the move-driven design avoids for *ordinary moves* — it is unavoidable for *arbitrary positions*, and it is why `{ move, state }` is an optimization for the common path, not a substitute for full-state rendering.
- **Broadcast `{ move, state }`, not `state` alone**, for ordinary moves. `syncPebbles` is move-driven (`BoardScene.ts:368-432`); state-only would lose every tween on every move.
- **Ordering constraint, inherited**: `syncPebbles` reads `this.state.current` to color the moving pebble, so it must run **before** `this.state` is reassigned (`BoardScene.ts:365-367`). The online path must preserve this or pebbles render the wrong color.
- **`applyServerUpdate` must honor `APPLY_AND_SYNC_REUSE`.** The repo has a named pattern (`single-player-ai-phase-2-wiring.plan.md:145`): *"never a second move-application path… Do not write a parallel 'apply AI move' path."* `applyAndSync` is five statements (`BoardScene.ts:456-463`), and the last two are load-bearing: `refreshDraggable()` and `EventBus.emit('game-state-changed', …)`. That emit drives the **entire HUD** (`App.tsx:19` → `Hud.tsx:52-84`). A version that only tweens pebbles and assigns state renders perfectly and freezes the HUD forever — no turn text, no gameover overlay — while "pebbles tween correctly" still passes.
- **The roll assigns seats, not turn order.** `initialState` hardcodes `current: 1` (`rules.ts:41,51`). The roll decides *which socket is player 1 (red)*; red still moves first. Engine untouched.
- **`localPlayer` must be non-optional at every hop — deliberately breaking a repo pattern.** The relay is 7 hops: `App` state → `PhaserGame` prop (`:15`) → `StartGame` arg (`main.ts:24`) → `registry.set` (`main.ts:28`) → `Boot` registry read (`Boot.ts:13`) → `scene.start` data (`Boot.ts:14`) → `init` (`BoardScene.ts:57`). The repo's `SCENE_DATA_DEFAULTING` pattern mandates optional-with-`??`-default. **Following it here guarantees a silent failure**: a missed hop defaults both clients to player 1, Red plays fine, Blue's taps are rejected server-side with no UI feedback, and the game looks alive while being unplayable for one seat. Type it `localPlayer: PlayerId` with **no default** so a missed hop is a compile error. This is a conscious, justified deviation and the plan must say so, or a reviewer will "fix" it back.
- **`opponentType` has 8 union sites, not 5** (verified): `App.tsx:14`, `App.tsx:37`, `OpponentSelect.tsx:3`, `PhaserGame.tsx:15`, `BoardScene.ts:18`, `BoardScene.ts:41`, `Boot.ts:13`, `main.ts:24`. Widening the union makes every missed site a compile error — which is why it stays a union and is never widened to `string`.
- **`App.tsx` is the contended file.** Its render gate (`:56-64`) early-returns until `modeId` and `opponentType` are final — which is the *only* reason `PhaserGame`'s `[ref]`-dep effect (`PhaserGame.tsx:22-50`, game created once, props read at `:27` and **not** in the dep array) works today. Online adds three more gate states (lobby, roll, board) and a new `localPlayer` that must be final *before* mount. Lobby, roll, and board integration would all edit the same `useState` block and the same gate. **This is why the screen state machine is its own phase (3), landing before any of them.**
- **Rematch swaps seats, and `restartGame()` cannot carry that.** `restartGame()` (`BoardScene.ts:104-117`) never re-runs `init()`, so an `init`-set `localPlayer` goes stale forever. Rematch needs `scene.restart(data)` or a keyed remount — and a keyed remount is impossible through a `[ref]`-dep effect. Phase 9 owns this.
- **Local `legalMoves` stays — for highlights only, never for authority.** `onVertexTap` computes `legalMoves` (`:225`) and the whole selection/highlight system depends on it (`selectVertex` `:271-285`, `renderHighlights` `:484-511`). Removing it breaks highlights; keeping it as a *gate* is harmless because the client's state always came from the server. It must never be mistaken for validation. Decided here so no executor has to.
- **Echo-wait lock.** Between emit and echo, `this.state.current` is still the local player, so the board stays live and a double-tap emits two intents (the second silently rejected). Needs an `awaitingEcho` flag set on emit, cleared on echo, checked at the top of `onVertexTap`.
- **Engine is raw TypeScript; Node cannot import it bare.** `packages/engine/package.json:8-11` exports `./src/index.ts`. Use `tsx`. (Node 22's `--experimental-strip-types` skips `node_modules`, where pnpm symlinks workspace packages — not an option.)
- **Declare `VITE_SERVER_URL?: string` in `apps/web/src/vite-env.d.ts`.** Today that file is only `/// <reference types="vite/client" />`, and Vite's `ImportMetaEnv` has an index signature — so `import.meta.env.VITE_SERVER_UR` is `any` → `undefined` → `"undefined/health"` → probe fails → button hidden → **every success signal still passes**. A typo must be a compile error.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Server tests written but never executed** | **H** | `pnpm -r test` **skips packages with no `test` script**. Phase 2 could write `*.test.ts`, run `pnpm test`, see green from the engine's suite, and ship zero server tests — including the turn check the feature rests on. **This repo has already been bitten by exactly this**: `packages/engine/vitest.config.ts` says *"the previous root-level config globbed only the engine dir, so `modes/__tests__/clash-board.test.ts` silently never ran."* Phase 1 must create `apps/server/package.json` with `"test": "vitest run"`, pin `vitest@^4.1.10` to match the engine, add `apps/server/vitest.config.ts`, and **prove a non-zero server test count in `pnpm -r test` output as a success signal**. |
| Turn check written but vacuously tested | **M** | `applyMoveForSeat` as sole mutator + grep-ban test + literal `legalMoves(cfg, s)[0]` test body inlined in the plan. Prose warnings are insufficient; this converts it to a structural constraint. |
| "Play again" forks client state in online mode | **H** if unaddressed | `Hud.tsx:74-76` renders it unconditionally at gameover; `App.tsx:50-54` wires it to `restartGame()` → `initialState()` (`BoardScene.ts:114`). In online mode one client silently resets its own board while the server holds the finished game. Phase 7 must gate it. Found in adversarial review; the original draft gated only the Menu button. |
| `localPlayer` silently defaults to 1 on both clients | **M** | Non-optional at all 7 hops, no `??`. Deliberately breaks `SCENE_DATA_DEFAULTING`; the plan must justify the deviation explicitly. |
| `applyServerUpdate` under-specified → HUD freezes | **M** | Honor `APPLY_AND_SYNC_REUSE`: route through `applyAndSync`'s tail rather than reimplementing two of its five statements. |
| In-memory rooms die on server restart | **H** (certain on deploy) | Accepted for v1. Single instance, hobby scale. Clients get `room:closed`, return to menu. Documented, not hidden. |
| Netlify cannot host the socket server | **H** (certain) | Deploy separately. Until then the probe fails and the button hides — graceful degradation doubles as the ship-dark story. |
| A connected player stalls forever | **M** | No remedy in v1. Opponent can leave. Named in Open Questions. |
| CORS blocks the browser | **M** | Allowlist Netlify origin + localhost in socket.io *and* the health handler. Will bite on first real deploy if forgotten. |
| **Every misconfiguration collapses into one symptom** | **M** | Wrong port, CORS, typo'd env var, wrong health path, wrong JSON shape → all produce *"no Online button"*, indistinguishable from correct degradation. Phase 5 must specify one diagnostic (a `console.info` naming the probed URL and outcome) or debugging is guesswork. |
| Grace-timer leak | **L** | Armed on disconnect, cleared on rejoin, room self-deletes on expiry. Test the `Map` entry is **gone**, not just flagged. |
| Online changes regress offline modes | **L** | 8-site typed union → every unhandled site is a compile error. Never widen to `string`. |

---

## Verification Reality

The request is that Haiku executes these plans. That claim is only honest per-phase, so this PRD splits it:

**Machine-verified — Haiku executes and proves it** (Phases 1, 2, 8, and the roll's RNG test): pure logic, `vitest`, no DOM. The executor runs `pnpm -r test` and knows whether it worked. These carry the entire anti-cheat guarantee, which is the right place for the strongest verification.

**Human-verified — Haiku writes, a person confirms** (Phases 3–7, 9–12): `apps/web` has no test harness, deliberately (`single-player-ai-phase-2-wiring.plan.md:212-219`: *"zero React/Phaser test coverage **by design**"*). Every prior client-side plan in this repo ends in a manual playtest — `single-player-ai-phase-2-wiring.plan.md:562`: *"### Browser Validation … EXPECT, **manually**, in the browser"*. **Haiku cannot run two browsers.** These phases are Haiku-*writable*, not Haiku-*verifiable*, and pretending otherwise would mean shipping on green checks that test nothing.

This split is the reason the plans below are sized the way they are: the human-verified phases are cut small enough that a failed playtest points at one file, not four features.

### Plan-authoring rules (constraints on the *plan*, not notes to the executor)

1. **No discovery steps.** Every path, symbol, and line resolved at plan time. (The first draft of this PRD claimed 5 union sites; there are 8. That is precisely the failure mode.)
2. **Inline the contracts.** Protocol payloads written verbatim in the plan, never referenced by name.
3. **Ordering constraints stated with reasons.** "`syncPebbles` before `this.state =`" is invisible in the code's shape and lives only in a comment (`BoardScene.ts:365-367`). Any plan touching that path restates it.
4. **Name the trap in the imperative.** An executor reading `rules.ts` would reasonably conclude validation is handled. Phase 1's plan must say "check the seat before calling `applyMove`" as an instruction, and Phase 1's structure must make ignoring it impossible.
5. **One phase, one side.** No plan spans server and client. Where a feature needs both (roll, rematch, disconnect), it is split into a server phase and a client phase. Phase 1's contract makes that split safe.
6. **Verification is stated, not assumed.** Every phase declares Machine or Human. A Human phase's success signal is a numbered playtest script a person can follow, not "it works".
7. **No open questions inside a phase.** Anything unresolved (probe cadence, `'probing'` UI) is decided at plan time or the phase does not start.

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently
  DEPENDS: phases that must complete first
  VERIFY: Machine (executor proves it) | Human (playtest required)
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Verify | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|--------|----------|---------|----------|
| 1 | Protocol + server scaffold + **authority** | `packages/protocol` types; `apps/server` boots; `/health`; **test harness proven**; `applyMoveForSeat` + grep-ban | in-progress | **Machine** | with 3, 4 | - | [phase-1](../plans/online-multiplayer-phase-1-protocol-authority.plan.md) |
| 2 | Room lifecycle | Code gen, create/join/rejoin/leave/move handlers, room-full. Rejoin tested here. | pending | **Machine** | with 3, 4 | 1 | - |
| 3 | App screen state machine | Refactor `App.tsx` render gate to an explicit screen union. No network. | pending | Human | with 1, 2, 4 | - | - |
| 4 | `BoardScene.hydrateState` | Stateless full-position render. No network. Prereq for rejoin + rematch. | pending | Human | with 1, 2, 3 | - | - |
| 5 | Client net layer + probe + lobby | `client.ts`, `useServerAvailable`, `vite-env.d.ts`, `OnlineLobby`, session envelope | pending | Human | - | 1, 3 | - |
| 6 | Side roll | Server roll (RNG injectable) + `RollScreen`. Produces `localPlayer`. | pending | Machine (RNG) + Human (UI) | - | 2, 5 | - |
| 7 | BoardScene online integration | 8-site union; `localPlayer` relay; `applyServerUpdate`; echo lock; **gate Play again + Menu** | pending | Human | - | 4, 6 | - |
| 8 | Server grace timer | Arm/clear/expire, room sweep, `room:closed`. Assert `Map` entry gone. | pending | **Machine** | with 7 | 2 | - |
| 9 | Rematch | Mutual accept, re-roll, seat swap via `scene.restart(data)`, replace "Play again" wiring | pending | Human | with 10 | 7 | - |
| 10 | Rejoin | Session envelope restore, App deferred-mount boot path, `hydrateState` on restore | pending | Human | with 9 | 4, 7, 8 | - |
| 11 | Disconnect notices | `opponent:disconnected` / `:reconnected` / `room:closed` → visible UI | pending | Human | - | 7, 8 | - |
| 12 | Deploy + CI | Host, `PORT`, CORS, `VITE_SERVER_URL`, verify CI picks up new packages | pending | Human | with 9–11 | 2 | - |

### Phase Details

**Phase 1 — Protocol + server scaffold + authority** · *Machine-verified*
- **Goal**: A typed wire contract, a Node process that starts, and a turn check that cannot be skipped.
- **Scope**: `packages/protocol/src/index.ts` (event names, payload types, `RoomCode` / `SessionToken` aliases); `apps/server/{package.json, tsconfig.json, vitest.config.ts, src/index.ts, src/authority.ts}`; `"test": "vitest run"` + `vitest@^4.1.10`; `tsx` dev/start; `http.Server` + socket.io; `GET /health` → `200 {"ok":true}`; CORS allowlist; `applyMoveForSeat` as the sole mutator; grep-ban test over `src/handlers/`.
- **Success signal**: `curl localhost:PORT/health` → `{"ok":true}`; `pnpm -r test` prints **a non-zero `@pebble/server` test count**; the seat test using `legalMoves(cfg, s)[0]` from the wrong seat fails closed; the grep-ban test fails if `applyMove` appears under `src/handlers/`.
- **Haiku-executable**: yes. Pure functions, no UI, no design decisions left. The `tsx` risk is pre-resolved with the rejected alternative recorded so it cannot be rediscovered wrongly.

**Phase 2 — Room lifecycle** · *Machine-verified*
- **Goal**: The server is the sole authority over every room.
- **Scope**: `Room` type; `Map<RoomCode, Room>`; 4-char code gen over an alphabet excluding `0/O/1/I/L`, with collision retry; `room:create`, `room:join`, `room:rejoin`, `move`, `room:leave`; broadcast `{ move, state }`; room-full rejection. Handlers call **only** `applyMoveForSeat`.
- **Success signal**: tests prove — in-turn legal move applies; **a currently-legal move from the wrong seat is rejected and `positionKey` is unchanged**; illegal move rejected; unknown room rejected; third joiner gets "Room is full"; **rejoin returns a `GameState` deep-equal to the server's**; all three `modeId`s round-trip.
- **Haiku-executable**: yes. Logic against an already-tested engine, and the one trap is structurally foreclosed by Phase 1.

**Phase 3 — App screen state machine** · *Human-verified*
- **Goal**: Make `App.tsx` able to hold more than two screens before three phases try to edit it at once.
- **Scope**: replace the `modeId === null` / `opponentType === null` early-return ladder (`App.tsx:56-64`) with an explicit screen union (`'menu' | 'opponent' | 'lobby' | 'roll' | 'board'`). No network, no new screens rendered yet — just the machine and the gate.
- **Success signal**: playtest — vs-AI and hotseat reach the board and play to gameover exactly as before; Menu returns to the mode list.
- **Haiku-executable**: writable. Mechanical refactor of one file with no behavior change, which makes the playtest a pure regression check.

**Phase 4 — `BoardScene.hydrateState`** · *Human-verified*
- **Goal**: Render an arbitrary position with no move — the capability rejoin and rematch both need and which no other phase provides.
- **Scope**: `hydrateState(state: GameState)`: destroy every `pebbleObjects` entry, respawn from `state.board` via the existing `spawnPebbleAt`, reset selection, `refreshDraggable`, emit `game-state-changed`. Reuses `create()`'s existing seeding loop shape (`BoardScene.ts:84-91`).
- **Success signal**: playtest — a temporary dev hook hydrating a synthetic mid-game state renders the exact position, and pebbles remain draggable and playable afterward.
- **Haiku-executable**: writable, and testable **offline with no server** — which is why it lands early rather than inside a networked phase.

**Phase 5 — Client net layer + probe + lobby** · *Human-verified*
- **Goal**: Reach the server, and show the Online button only when it is genuinely reachable.
- **Scope**: `apps/web/src/net/client.ts` (typed socket.io wrapper over `@pebble/protocol`); `useServerAvailable.ts` → `'probing' | 'up' | 'down'`, short-circuits to `'down'` if `VITE_SERVER_URL` is unset, cancels on unmount via `AbortSignal.any([controller.signal, AbortSignal.timeout(1500)])` with a `cancelled` guard so a StrictMode abort is never mistaken for a failed probe; declare `VITE_SERVER_URL?: string` in `vite-env.d.ts`; one `console.info` diagnostic naming the probed URL and outcome; third button in `OpponentSelect`, `'up'` only; `OnlineLobby.tsx`; session envelope `{ token, roomCode, modeId }` in `localStorage` (**not just the token** — rejoin needs `modeId` before `PhaserGame` can mount).
- **Plan-time decisions required**: probe cadence, and the `'probing'` UI. Both are listed in Open Questions and **must be closed before this plan is written**.
- **Success signal**: playtest — env unset → menu identical to today, no network request in devtools; server up → button appears, create returns a code, join seats both clients; server killed → button absent, no console errors, one diagnostic line.
- **Haiku-executable**: writable, with the React 19 StrictMode hazards named explicitly. `main.tsx:6-8` wraps `<App/>` in `<React.StrictMode>`, so effects double-invoke — the abort/error conflation is the likeliest silent bug and is why the cleanup shape is specified rather than left to judgment.

**Phase 6 — Side roll** · *Machine (RNG) + Human (UI)*
- **Goal**: Sides randomly and visibly assigned, decided server-side.
- **Scope**: server rolls on second join with injectable RNG; per-socket `roll:result { yourSeat }`; `RollScreen.tsx` cycles red/blue ~2s then reveals; sets `localPlayer` in the `App` machine from Phase 3.
- **Success signal**: seeded-RNG unit test proves ~50/50 over 1000 rolls (machine); playtest — both clients always agree on who is red, and repeated games show both assignments.
- **Haiku-executable**: writable. The animation is theater over a value the server already decided, so no client logic can affect the outcome. Timing constants given in the plan.

**Phase 7 — BoardScene online integration** · *Human-verified*
- **Goal**: Moves round-trip through the server; no client-side state construction survives on the online path.
- **Scope**: widen `opponentType` to `'human' | 'ai' | 'online'` at **all 8 sites**; thread `localPlayer: PlayerId` **non-optional** through all 7 relay hops; replace the `AI_PLAYER` gates (`:220`, `:451`) with a helper respecting `opponentType`; online `onVertexTap` emits intent and never calls `applyMove`; `applyServerUpdate({move, state})` routing through `applyAndSync`'s tail (**all five statements** — `refreshDraggable` and the `EventBus.emit` are what keep the HUD alive); `awaitingEcho` lock; **gate "Play again" and "Menu" behind a confirm in online mode** (`Hud.tsx:56-58, 74-76`).
- **Success signal**: playtest script — two browsers play to gameover; pebbles tween as in hotseat; **HUD turn text updates every move and the gameover overlay appears** (this is what catches a half-written `applyServerUpdate` — "pebbles tween correctly" does not); board inert during opponent's turn *and* while awaiting your own echo; double-tap produces exactly one move; "Play again" in online mode does not reset the local board.
- **Haiku-executable**: writable, and this is **the highest-risk phase**. Its three worst failures are silent: the `localPlayer` default (foreclosed by non-optional typing), the half-written `applyServerUpdate` (foreclosed by `APPLY_AND_SYNC_REUSE`), and the unguarded "Play again" (foreclosed by an explicit scope item). If any phase needs splitting during planning, it is this one.

**Phase 8 — Server grace timer** · *Machine-verified*
- **Goal**: Disconnects are survivable and rooms never leak.
- **Scope**: 60s timer armed on disconnect, cleared on rejoin, room self-deletes on expiry; `room:closed` emitted.
- **Success signal**: tests — rejoin within grace clears the timer and preserves state; expiry **removes the `Map` entry** (assert `map.has(code) === false`, not a flag); a rejoin after expiry is rejected cleanly.
- **Haiku-executable**: yes. Server-only, fake timers, no UI.

**Phase 9 — Rematch** · *Human-verified*
- **Goal**: Both players agree to a fresh game with rerolled sides.
- **Scope**: mutual accept + "waiting for opponent…"; server re-rolls and re-inits; client applies the new seat via `scene.restart(data)` (**not** `restartGame()`, which never re-runs `init()` and would leave `localPlayer` stale forever — `BoardScene.ts:104-117`); rewire the "Play again" button from Phase 7's gate to the rematch flow.
- **Success signal**: playtest — rematch requires both; sides visibly reroll and are sometimes swapped; **after a seat swap, the player who is now Red can actually move** (this is the assertion that catches stale `localPlayer`).
- **Haiku-executable**: writable. The `restartGame()` trap is named with its file:line and reason.

**Phase 10 — Rejoin** · *Human-verified*
- **Goal**: A reload inside the grace window resumes the exact position.
- **Scope**: read session envelope → connect → `room:rejoin` → receive `{ modeId, yourSeat, state }` → **then** mount `PhaserGame` → `hydrateState(state)`. Requires a deferred-mount path in the Phase 3 machine, because `modeId` is needed at `StartGame` time (`main.ts:24`) and `localPlayer` at `Boot.create()` (`Boot.ts:13-14`) — both **before** the component mounts.
- **Success signal**: playtest — reload mid-game within 60s → exact position resumes and play continues; wait 61s → clean return to menu with a message.
- **Haiku-executable**: writable, but it is the subtlest ordering in the feature. Depends on both `hydrateState` (4) and the grace timer (8) already existing and being proven.

**Phase 11 — Disconnect notices** · *Human-verified*
- **Goal**: Never fail silently.
- **Scope**: `opponent:disconnected` / `opponent:reconnected` / `room:closed` → visible UI, not a silent state change.
- **Success signal**: playtest — kill one client → the other sees a notice within ~1s; it clears on reconnect.
- **Haiku-executable**: writable. Three events, three UI states.

**Phase 12 — Deploy + CI** · *Human-verified*
- **Goal**: The server runs somewhere real; CI covers the new packages.
- **Scope**: pick a host; `PORT` from env; CORS allowlist for the Netlify origin; `VITE_SERVER_URL` build var; verify `pnpm -r test` / `pnpm -r typecheck` pick up `@pebble/server` and `@pebble/protocol` (`.github/workflows/deploy-netlify.yml:36-43` already runs both — **verify, don't assume**, and note Phase 1 is what makes the `test` half meaningful).
- **Success signal**: two devices on different networks complete a game; a Netlify build with the var unset still ships a working offline game.
- **Blocked**: host choice is an Open Question and must be answered by a human before this is planned.

### Parallelism Notes

- **1 ∥ 3 ∥ 4** is the real win: server scaffold, the `App.tsx` refactor, and `hydrateState` touch disjoint files and none needs the others. 2 joins once 1 lands.
- **8 ∥ 7**: the grace timer is server-only; the integration is client-only.
- **9 ∥ 10**: both depend on 7, but rematch and rejoin touch different flows.
- **4 ∥ 5 is deliberately NOT claimed.** An earlier draft claimed the roll and the board integration were parallel "disjoint files" — false: both edit `App.tsx`'s state block and render gate, as would the lobby. Phase 3 exists to make that file safe to touch once, early, alone. The remaining phases are mostly sequential, and saying so is more useful than a parallelism table that doesn't survive contact.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Move application | Server-only, wait for echo | Optimistic + reconcile | Desync structurally impossible — one `GameState`, not two. Turn-based game: latency invisible. |
| Turn check placement | `applyMoveForSeat` in Phase 1 as sole mutator, grep-banned elsewhere | Document it in Phase 2's prose | A prose warning is skippable; a deleted test is not. Review showed the obvious test passes vacuously, so the structure must carry the guarantee, not the wording. |
| Verification claim | Split: server = machine, client = human | Claim all phases Haiku-executable; add a web test harness | `apps/web` has no tests by design. Overturning that is a bigger fight than this feature; overclaiming would mean shipping on green checks that test nothing. |
| Full-state render | `hydrateState` as its own early phase | Fold into rejoin; derive from `{move, state}` | Rejoin and rematch have no move to render from. Omitting it was the first draft's real architectural hole. Landing it early makes it verifiable with no server. |
| `App.tsx` refactor | Its own phase, before lobby/roll/board | Let each phase edit the gate | Three phases would edit the same `useState` block and gate. One phase, once, early. |
| `localPlayer` typing | Non-optional at all 7 hops | Follow `SCENE_DATA_DEFAULTING` (`?? 1`) | The repo pattern would silently default both clients to player 1 — game looks alive, unplayable for one seat. Deliberate deviation; plan must justify it or a reviewer reverts it. |
| Local `legalMoves` on online client | Keep, for highlights only | Remove; or treat as validation | Removing breaks the highlight system. Keeping is harmless — client state always came from the server. Never authority. |
| Availability | Runtime `/health` probe | Build-time env only; always show | Survives the server dying *after* deploy. Env-only leaves a button that errors on click — the exact failure the request forbids. |
| Transport | socket.io | Raw `ws` | Rooms, reconnect, acks built in — which is most of the requirement list. |
| Disconnect | 60s grace, then destroy | Instant kill; live forever | Instant kill breaks rejoin. No timeout leaks rooms. |
| Roll semantics | Assigns seats; red always moves first | Randomize who moves first | `initialState` hardcodes `current: 1`. Seat assignment keeps the engine untouched — identical fairness, zero engine risk. |
| Roll authority | Server | Client rolls | A client-rolled side is a client-chosen side, and both must agree on one outcome. |
| Broadcast payload | `{ move, state }` for moves; full state for hydration | `state` only; `move` only | Move-driven keeps tweens on the common path. Full state is unavoidable for arbitrary positions. Both exist for different reasons. |
| Rematch restart | `scene.restart(data)` | `restartGame()` | `restartGame()` never re-runs `init()` (`BoardScene.ts:104-117`), so a swapped `localPlayer` would be stale forever. |
| Wire types | `packages/protocol` | Types in server; hand-duplicated | Monorepo already shares this way. Prevents drift; enables 1∥3∥4. |
| Engine in Node | `tsx` | esbuild bundle; Node type-stripping | Engine exports raw `.ts`. `--experimental-strip-types` skips `node_modules`, where pnpm symlinks workspace packages. `tsx` is one dep, zero config. |
| Mode scope | All three | Clash only | Server is mode-agnostic. Restricting costs *more* — generic code plus a gate. |
| Rematch | Mutual accept + fresh roll | One-clicks-restarts; keep sides | Fresh roll or red's first-move edge compounds. Mutual accept avoids yanking someone off the result screen. |
| Room code | 4 chars, no `0/O/1/I/L` | 6 chars; URL | ~1M combos with collision retry, short enough to say out loud — which is how it gets shared. |
| Full room | Reject | Spectators | 2 seats. Spectating is a separate feature. |
| Turn timer | Not in v1 | Timer + auto-forfeit | Deferred, not overlooked. Between friends, stalling is a social problem before a technical one. |

---

## Research Summary

**Market Context**

Not researched, and honestly: it would not change anything. "Room code + authoritative server for a turn-based 2-player game" is a settled design space — Jackbox-style short codes, server-authoritative state, mutual-accept rematch are all conventional and were chosen on their merits above. A competitive analysis would produce a document, not a decision. If this were a product seeking users, market research would be the *first* step, not a skipped one; it is skipped because this is a hobby project with a named non-market motivation.

**Technical Context**

Read the full codebase (`apps/web`, `packages/engine`, workspace + CI config, all six prior PRDs, and the completed plans). The dominant finding: **this feature was designed for before it was requested.** `packages/engine/src/index.ts:1-7` names the authoritative server as its reason for zero runtime dependencies, and three prior PRDs deferred online play by explicit decision. `applyMove` re-validates and throws (`rules.ts:279-288`) — the server inherits a tested rule engine rather than reimplementing one, which is where networked board games usually go wrong.

**The finding that outranks all others**: `applyMove` validates the move but **not the mover**. It applies whatever it is handed as `s.current`. Every cheat-prevention guarantee except turn ownership is inherited free; turn ownership must be written by hand, before `applyMove` is ever called. Worse, the *obvious test for it passes without it* — because `legalMoves` only generates moves for `s.current`, so the intuitive "opponent's move at the wrong time" case is already rejected by the engine. The real exploit is submitting the *current* player's legal move from the *other* seat. This is why the check is a structural constraint in Phase 1 rather than a warning in Phase 2.

**This PRD was adversarially reviewed and substantially rewritten.** The review refuted the first draft's central claim and found problems the author missed. Load-bearing corrections, all verified against the code before acceptance:

- **`hydrateState` was missing entirely** — rejoin and rematch have no move to render from, and the draft had argued *against* the very capability they require. Now Phase 4.
- **"Play again" was an unguarded local-state fork** (`Hud.tsx:74-76` → `App.tsx:50-54` → `BoardScene.ts:114`) — the draft gated Menu and missed it, which falsified its own "one `GameState`" claim.
- **The Phase 2 turn-check test passed vacuously**, as described above.
- **Phase 1 shipped no server `test` script**, so Phase 2's suite would have gone green on zero executed tests — a bug this repo has already eaten once (`packages/engine/vitest.config.ts`: *"silently never ran"*).
- **The draft's `opponentType` enumeration listed 5 sites; there are 8** — in the same document that made "no discovery steps" its first plan-authoring rule.
- **`applyServerUpdate` was specified as 2 of `applyAndSync`'s 5 statements**, omitting the `EventBus.emit` that drives the entire HUD — a failure whose symptom (frozen HUD) the draft's own success signal would not have caught.
- **The claimed 4∥5 parallelism was false** — both edit `App.tsx`. Hence Phase 3.
- **"Haiku-executable" conflated writable with verifiable.** `apps/web` has no test harness by design and Haiku cannot run two browsers. Now split per-phase.

Three frictions identified in the original grounding remain and are pre-resolved: `AI_PLAYER = 2` hardcoded with a now-obsolete *"never derived dynamically"* comment (`BoardScene.ts:24`); the engine shipping raw TypeScript Node cannot import bare (`packages/engine/package.json:8-11`); Netlify being unable to host a persistent socket process.

---

*Generated: 2026-07-17*
*Status: DRAFT — adversarially reviewed and revised; technically validated against the codebase; demand deliberately unvalidated (hobby project)*
