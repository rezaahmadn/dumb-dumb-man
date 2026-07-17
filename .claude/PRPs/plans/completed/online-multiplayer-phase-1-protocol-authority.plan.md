# Plan: Online Multiplayer — Phase 1: Protocol + Server Scaffold + Authority

## Summary

Create two new workspace packages: `@pebble/protocol` (the typed wire contract shared by server and web) and `@pebble/server` (a Node + socket.io process that boots, answers `GET /health`, and owns `applyMoveForSeat` — the only function permitted to mutate game state). No socket handlers are wired yet; that is Phase 2. This phase exists to fix the wire contract and to make the turn-ownership check structurally impossible to skip.

## User Story

As a **player of an online game**, I want **the server to reject moves I am not entitled to make**, so that **my opponent cannot move on my behalf or play out of turn**.

(Phase 1 delivers no user-visible behavior. It delivers the guarantee everything else rests on.)

## Problem → Solution

`applyMove` validates *that a move is legal* but never *who sent it* — it applies whatever it is handed as `state.current` → a single `applyMoveForSeat` gate that checks the seat **before** calling `applyMove`, is the only exported mutator, and is enforced as such by a test.

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/online-multiplayer.prd.md`
- **PRD Phase**: 1 — Protocol + server scaffold + authority
- **Verification class**: **Machine** (per PRD "Verification Reality") — the executor runs `pnpm -r test` and knows whether it worked. No playtest, no browser.
- **Estimated Files**: 10 created, 0 modified

---

## UX Design

**N/A — internal change.** No user-facing surface. `apps/web` is not touched by this phase; the Online button does not exist until Phase 5.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | `packages/engine/src/rules.ts` | 279-306 | `applyMove`. Read `:279-288` (validates the move, throws) and `:292-306` (applies it as `s.current`, never checking who asked). **The entire reason this phase exists is the gap between those two blocks.** |
| **P0** | `packages/engine/src/rules.ts` | 57-70 | `legalMoves` generates moves **only for `s.current`**. This is why the obvious out-of-turn test passes without the check — see GOTCHA-1. |
| **P0** | `packages/engine/src/index.ts` | 1-22 | Public engine surface. Everything imported below comes from here. Note `:1-7` states the engine exists to be imported by exactly this server. |
| **P1** | `packages/engine/package.json` | 1-21 | The package shape to mirror: `"type": "module"`, `"exports"` to raw `./src/*.ts`, `"private": true`, version `1.1.0`. |
| **P1** | `packages/engine/tsconfig.json` | 1-10 | The tsconfig to mirror, including the `lib: ["ES2020"]` no-DOM boundary and *why* it exists. |
| **P1** | `packages/engine/vitest.config.ts` | 1-13 | The vitest config to mirror. **Read its comment** — it documents a real past bug where a too-narrow glob made tests silently never run. Same trap here; see GOTCHA-4. |
| **P1** | `packages/engine/src/types.ts` | 28-47 | `GameState` and `Move` shapes — these travel over the wire, so the protocol types reference them. |
| **P2** | `packages/engine/src/__tests__/clash.test.ts` | 1-45 | Test file conventions: import style, fixture-as-const, `describe('C1 …')` labeled groups. |
| **P2** | `packages/engine/src/board.ts` | 1-8 | Engine code style (K&R braces). **The server mirrors the engine, not `apps/web`** — see PATTERN `BRACE_STYLE_ENGINE`. |
| **P2** | `tsconfig.base.json` | 1-22 | Shared compiler options every package extends. Note `noUnusedLocals: true` — an unused import is a **build failure**, not a warning. |

## External Documentation

All of the below was **empirically verified against this exact repo structure** during planning (a throwaway pnpm workspace reproducing raw-TS exports + tsx). Do not re-research; do not second-guess.

| Topic | Source | Key Takeaway |
|---|---|---|
| tsx + raw-TS workspace deps | [tsx typescript docs](https://github.com/privatenumber/tsx/blob/master/docs/typescript.md) | **tsx transforms `.ts` anywhere, including inside `node_modules`.** Verified via `--preserve-symlinks` (path forced to stay inside node_modules) — still passes. The "tsx skips node_modules" belief is **`ts-node`'s** behavior, not tsx's. tsx's node_modules mention is only about *watch-mode ignoring*. |
| tsx extensionless imports | same | tsx *"behaves more like a bundler, allowing extensionless/index module specifiers."* This is load-bearing — see GOTCHA-2. |
| tsx version | npm `latest` | **4.23.1**, `engines: node >=18`, bundles esbuild ~0.28. |
| Node native type stripping | [Node TypeScript modules](https://nodejs.org/docs/latest-v24.x/api/typescript.html) | *"Node.js refuses to handle TypeScript files inside folders under a `node_modules` path."* → `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. See GOTCHA-2. |
| `moduleResolution: "bundler"` + `exports` → `.ts` | verified via `tsc --traceResolution` | Resolves `@pebble/engine` → `packages/engine/src/index.ts` and **really typechecks across the boundary** (a deliberate cross-package type error was caught). |
| socket.io version | npm `latest` | **4.8.3** (server and client). |
| socket.io typed server | [socket.io typescript](https://socket.io/docs/v4/typescript/) | `new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, opts)`. All 4 generics required to reach `SocketData`. |
| socket.io + http.Server | [server-initialization](https://socket.io/docs/v4/server-initialization/) | Options are the **2nd** arg. `listen()` on the **httpServer**, never on `io`. |
| socket.io CORS | [handling-cors](https://socket.io/docs/v4/handling-cors/) | `{ cors: { origin: string[], methods: ['GET','POST'] } }`. |
| socket.io ESM exports | [wrapper.mjs](https://github.com/socketio/socket.io/blob/main/packages/socket.io/wrapper.mjs) | Only **`Server`, `Namespace`, `Socket`** exist as runtime values. Everything else is type-only — see GOTCHA-3. |

---

## Patterns to Mirror

### BRACE_STYLE_ENGINE (K&R — the server mirrors the ENGINE, not the web app)
// SOURCE: packages/engine/src/board.ts:3-7
```ts
//  Edges are the consecutive pairs of each line, deduplicated (unordered).
export function edgesFromLines(lines: VertexId[][]): [VertexId, VertexId][] {
    const seen = new Set<string>();
    const edges: [VertexId, VertexId][] = [];
    for (const line of lines) {
```
**Rule**: opening brace on the SAME line, 4-space indent, comments prefixed `//` + **two** spaces. `apps/web` uses Allman braces (`function App()\n{`) — **do not copy that here.** The server is pure Node TypeScript and belongs to the engine's stylistic family.

### PACKAGE_SHAPE
// SOURCE: packages/engine/package.json:1-21
```json
{
  "name": "@pebble/engine",
  "description": "Pure game rules, board maths, AI and mode definitions. No phaser, no react, no DOM.",
  "version": "1.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "exports": {
    ".": "./src/index.ts",
    "./modes": "./src/modes/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```
**Rule**: `private: true`, `type: "module"`, version `1.1.0` (match the workspace), raw `./src/*.ts` in `exports` (**no build step, no dist — this is deliberate**), `typecheck` script on every package, `test` script on every package that has tests.

### TSCONFIG_SHAPE
// SOURCE: packages/engine/tsconfig.json:1-10
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    //  ES2020 only — NO "DOM". This is the boundary that keeps the engine
    //  portable: a browser-only global (window, document) fails typecheck
    //  here rather than at server runtime.
    "lib": ["ES2020"]
  },
  "include": ["src"]
}
```
**Rule**: extend the base, set `lib: ["ES2020"]` with no DOM, `include: ["src"]`.

### VITEST_CONFIG_SHAPE
// SOURCE: packages/engine/vitest.config.ts:1-13
```ts
import { defineConfig } from 'vitest/config';

//  Engine tests are pure TS — node environment, no react plugin, no jsdom.
//  include is src/**, not src/engine/** : the previous root-level config
//  globbed only the engine dir, so modes/__tests__/clash-board.test.ts
//  silently never ran. Keep this glob broad enough to catch every package test.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts']
    }
});
```
**Rule**: `environment: 'node'`, `include: ['src/**/*.test.ts']` — broad enough that a test in any subdirectory runs.

### TEST_STRUCTURE
// SOURCE: packages/engine/src/__tests__/clash.test.ts:1-44
```ts
import { describe, expect, it } from 'vitest';
import { applyMove, initialState, legalMoves, pebbleCount } from '../rules';
import type { EngineConfig, GameState } from '../types';

const FIXTURE: EngineConfig = {
    pebblesPerPlayer: 1,
    win: 'elimination',
    // ...
};

describe('C1 preplaced seeding', () => {
    it('seeds both players onto the board and leaves the rest empty', () => {
        const s = initialState(FIXTURE, 'clash');
        expect(s.board).toEqual({ a: 1, b: null, c: 2 });
    });
});
```
**Rule**: named imports from `'vitest'`, tests in `src/__tests__/*.test.ts`, fixtures as module-level consts, `describe` groups labeled with a short id (`C1`, `C2`…). This plan uses `A1`/`A2` for authority.

### ENGINE_IMPORT_STYLE (values and types imported separately)
// SOURCE: packages/engine/src/ai.ts:1-3
```ts
//  engine/ imports NOTHING outside engine/ (no phaser, no react, no modes/).
import { alignedPlayer, applyMove, legalMoves } from './rules';
import type { EngineConfig, GameState, Move, PlayerId, VertexId } from './types';
```
**Rule**: runtime values via `import {}`, types via `import type {}`. Required — `isolatedModules: true` is on in `tsconfig.base.json:12`.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `packages/protocol/package.json` | CREATE | New shared package. Mirrors PACKAGE_SHAPE. |
| `packages/protocol/tsconfig.json` | CREATE | Mirrors TSCONFIG_SHAPE. |
| `packages/protocol/src/index.ts` | CREATE | The full wire contract. Fixing it now is what lets Phase 2 (server) and Phase 5 (client) proceed in parallel without drift. |
| `apps/server/package.json` | CREATE | New server package. **Must include `"test": "vitest run"`** — see GOTCHA-4. |
| `apps/server/tsconfig.json` | CREATE | Mirrors TSCONFIG_SHAPE, plus `types: ["node"]`. |
| `apps/server/vitest.config.ts` | CREATE | Mirrors VITEST_CONFIG_SHAPE. |
| `apps/server/src/authority.ts` | CREATE | `applyMoveForSeat` — the sole mutator and the entire point of this phase. |
| `apps/server/src/index.ts` | CREATE | http.Server + `/health` + socket.io attached. No handlers yet. |
| `apps/server/src/__tests__/authority.test.ts` | CREATE | The non-vacuous turn-check tests. |
| `apps/server/src/__tests__/sole-mutator.test.ts` | CREATE | Structural guard: no file but `authority.ts` may reference `applyMove`. |

**No existing file is modified.** `pnpm-workspace.yaml` already globs `apps/*` and `packages/*` (verified) — it needs no change. Root `package.json` needs no change: `pnpm -r test` and `pnpm -r typecheck` pick up new packages automatically.

## NOT Building

- **Any socket event handler** — `room:create`, `room:join`, `move`, etc. are **Phase 2**. This phase defines their *types* and attaches socket.io, but wires **zero** `io.on('connection')` logic.
- **Room storage** (`Map<RoomCode, Room>`), room-code generation, the grace timer — Phase 2 and Phase 8.
- **The random side roll** — Phase 6. `roll:result` is *typed* here, not implemented.
- **Anything in `apps/web`** — the client net layer is Phase 5. Do not touch `apps/web`.
- **Root `package.json` scripts** — no `dev:server` convenience script. Keep the diff minimal.
- **A build step / dist output for any package** — raw TS is deliberate and load-bearing. Do **not** "fix" `packages/engine` to emit JS; it would break `apps/web`'s Vite path for zero benefit.
- **ESLint config changes** — lint is not in CI (`.github/workflows/deploy-netlify.yml:36-43` runs typecheck, test, build only).

---

## Step-by-Step Tasks

### Task 1: Create `packages/protocol/package.json`
- **ACTION**: Create the file.
- **IMPLEMENT**:
```json
{
  "name": "@pebble/protocol",
  "description": "Wire contract shared by @pebble/server and @pebble/web. Typed socket events and payloads, so the two sides cannot drift.",
  "version": "1.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pebble/engine": "workspace:*"
  },
  "devDependencies": {
    "typescript": "~5.7.2"
  }
}
```
- **MIRROR**: PACKAGE_SHAPE.
- **GOTCHA**: No `test` script — this package has no tests, and adding an empty one makes `pnpm -r test` fail on "no test files found". Its correctness is proven by `typecheck` and by its consumers compiling.
- **VALIDATE**: File exists and is valid JSON.

### Task 2: Create `packages/protocol/tsconfig.json`
- **ACTION**: Create the file.
- **IMPLEMENT**:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    //  ES2020 only, no DOM — same boundary as the engine. This package is
    //  imported by BOTH a browser bundle and a Node process, so it must
    //  assume neither.
    "lib": ["ES2020"]
  },
  "include": ["src"]
}
```
- **MIRROR**: TSCONFIG_SHAPE.
- **VALIDATE**: File exists.

### Task 3: Create `packages/protocol/src/index.ts`
- **ACTION**: Create the full wire contract.
- **IMPLEMENT**:
```ts
//  Wire contract shared by @pebble/server and @pebble/web. Defined once, in a
//  package both sides depend on, so a payload shape cannot drift between them.
//
//  Almost everything here is a type. The two runtime constants (the room-code
//  alphabet and the health path) are values precisely because both sides must
//  agree on them at runtime, not just at compile time.
import type { GameState, Move, PlayerId } from '@pebble/engine';

export type RoomCode = string;
export type SessionToken = string;

//  Room codes get read aloud over voice chat, so the alphabet drops every
//  glyph pair that sounds or looks alike: 0/O and 1/I/L. 31 symbols, length
//  4 => 31^4 = 923,521 combinations. Collisions are still possible and the
//  generator (Phase 2) must retry on one; this is not a uniqueness guarantee.
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

//  Plain HTTP, not a socket handshake: the client probes this before it will
//  render the Online button, and a probe must be cheaper than a connection.
export const HEALTH_PATH = '/health';
export interface HealthResponse {
    ok: true;
}

export type JoinFailure = 'bad-code' | 'room-not-found' | 'room-full';
export type RejoinFailure = 'bad-code' | 'room-not-found' | 'bad-token';
export type MoveRejection =
    | 'room-not-found'
    | 'not-a-player'
    | 'not-your-turn'
    | 'illegal-move'
    | 'game-over';
export type RoomClosedReason = 'opponent-left' | 'grace-expired' | 'server-shutdown';

//  What a client must persist to survive a reload. The token alone is not
//  enough: modeId is needed at Phaser boot time, before a rejoin round-trip
//  can complete. See PRD Phase 10.
export interface SessionEnvelope {
    token: SessionToken;
    code: RoomCode;
    modeId: string;
}

export type CreateAck =
    | { ok: true; code: RoomCode; token: SessionToken }
    | { ok: false; reason: 'server-error' };

export type JoinAck =
    | { ok: true; code: RoomCode; token: SessionToken }
    | { ok: false; reason: JoinFailure };

export type RejoinAck =
    | { ok: true; modeId: string; yourSeat: PlayerId; state: GameState }
    | { ok: false; reason: RejoinFailure };

export type MoveAck = { ok: true } | { ok: false; reason: MoveRejection };

export interface ClientToServerEvents {
    'room:create': (payload: { modeId: string }, ack: (result: CreateAck) => void) => void;
    'room:join': (payload: { code: RoomCode }, ack: (result: JoinAck) => void) => void;
    'room:rejoin': (
        payload: { code: RoomCode; token: SessionToken },
        ack: (result: RejoinAck) => void
    ) => void;
    'room:leave': () => void;
    'rematch:accept': () => void;
    //  Intent, not instruction: the server decides whether this becomes a
    //  move. The ack reports acceptance; the resulting state arrives on
    //  'game:update' to every seat, including the sender.
    move: (payload: { move: Move }, ack: (result: MoveAck) => void) => void;
}

export interface ServerToClientEvents {
    //  Sent per-socket (each seat learns only its own), once both seats are
    //  filled and the server has rolled.
    'roll:result': (payload: { yourSeat: PlayerId; modeId: string; state: GameState }) => void;
    //  Carries the move as well as the state: the client renders the move
    //  through its existing tween path and would lose every animation if it
    //  had to diff two states. See PRD Architecture Notes.
    'game:update': (payload: { move: Move; state: GameState }) => void;
    //  Stateless render — an arbitrary position with no move that produced
    //  it. Used by rejoin and rematch, which have no move to animate.
    'game:hydrate': (payload: { state: GameState }) => void;
    'opponent:disconnected': (payload: { graceMs: number }) => void;
    'opponent:reconnected': () => void;
    'rematch:pending': () => void;
    'room:closed': (payload: { reason: RoomClosedReason }) => void;
}

//  No server-to-server events: this is a single instance by design (see the
//  PRD's "Won't build: horizontal scaling"). Declared empty rather than
//  omitted because SocketData is socket.io's 4th generic and cannot be
//  reached without passing this one.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface InterServerEvents {}

//  Per-socket server-side scratch space. Populated by Phase 2's handlers.
export interface SocketData {
    code: RoomCode | null;
    token: SessionToken | null;
    seat: PlayerId | null;
}
```
- **MIRROR**: ENGINE_IMPORT_STYLE (`import type` for types), BRACE_STYLE_ENGINE.
- **IMPORTS**: `import type { GameState, Move, PlayerId } from '@pebble/engine';`
- **GOTCHA**: The `move` key is unquoted while the others are quoted — TypeScript requires quotes only for keys containing `:`. Both forms are valid; keep it exactly as written so the file matches this plan.
- **VALIDATE**: `pnpm --filter @pebble/protocol typecheck` → zero errors (run after Task 5's install).

### Task 4: Create `apps/server/package.json`
- **ACTION**: Create the file.
- **IMPLEMENT**:
```json
{
  "name": "@pebble/server",
  "description": "Authoritative socket.io server for online multiplayer. Imports @pebble/engine as the single source of game rules.",
  "version": "1.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pebble/engine": "workspace:*",
    "@pebble/protocol": "workspace:*",
    "socket.io": "^4.8.3",
    "tsx": "^4.23.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "typescript": "~5.7.2",
    "vitest": "^4.1.10"
  }
}
```
- **MIRROR**: PACKAGE_SHAPE.
- **GOTCHA-4 (the one that silently voids this entire phase)**: **`"test": "vitest run"` is not optional.** `pnpm -r test` **silently skips any package without a `test` script**. Omit it and Phase 2's executor can write test files, run `pnpm test`, watch the engine's tests go green, and ship with **zero server tests ever executed** — including the turn check the whole feature rests on. This repo has already been bitten by this exact class of bug: read the comment in `packages/engine/vitest.config.ts` ("*silently never ran*"). `vitest` is pinned to `^4.1.10` to match `packages/engine/package.json:20`.
- **GOTCHA**: `tsx` is a **runtime dependency**, not a devDependency — `start` uses it in production.
- **VALIDATE**: Valid JSON; `"test"` script present.

### Task 5: Create `apps/server/tsconfig.json`, then install
- **ACTION**: Create the file, then run the install that creates the workspace symlinks.
- **IMPLEMENT**:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    //  ES2020 + node types, no DOM — same portability boundary the engine
    //  draws (packages/engine/tsconfig.json). A browser global referenced
    //  here fails typecheck rather than at runtime.
    "lib": ["ES2020"],
    "types": ["node"]
  },
  "include": ["src"]
}
```
Then run:
```bash
pnpm install
```
- **MIRROR**: TSCONFIG_SHAPE.
- **GOTCHA**: `pnpm install` is **required** before any typecheck or test will resolve `@pebble/engine` — the `workspace:*` dependency is what creates the `node_modules` symlink. Nothing below works until this runs.
- **GOTCHA**: Leave `moduleResolution: "bundler"` inherited from the base config. It is not a mistake here: it is what lets `tsc` resolve `@pebble/engine`'s `exports` map to a raw `.ts` file, and it matches tsx's bundler-like runtime resolution. Verified with `tsc --traceResolution`. Do **not** change it to `node16`/`nodenext`.
- **VALIDATE**: `pnpm --filter @pebble/server typecheck` → zero errors (passes trivially; `src/` is empty so far).

### Task 6: Create `apps/server/vitest.config.ts`
- **ACTION**: Create the file.
- **IMPLEMENT**:
```ts
import { defineConfig } from 'vitest/config';

//  Mirrors packages/engine/vitest.config.ts. Server tests are pure TS — node
//  environment, no jsdom. Keep `include` broad (src/**, not src/foo/**): the
//  engine's config carries a comment about a previous glob that was too
//  narrow and made a whole test file silently never run. Same trap here.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts']
    }
});
```
- **MIRROR**: VITEST_CONFIG_SHAPE.
- **VALIDATE**: File exists.

### Task 7: Create `apps/server/src/authority.ts` — **the point of this phase**
- **ACTION**: Create the sole mutator.
- **IMPLEMENT**:
```ts
//  THE authority boundary. Every state mutation on this server goes through
//  applyMoveForSeat and nowhere else — enforced by src/__tests__/sole-mutator.test.ts.
//
//  Why this file exists at all: the engine's applyMove validates that a move
//  is LEGAL but never checks WHO sent it. It applies whatever it is handed as
//  state.current (packages/engine/src/rules.ts:292-306). A client that sends
//  its opponent's currently-legal move produces a perfectly legal move applied
//  on the opponent's behalf, and the engine does not blink. The seat check
//  below is the only thing standing between that and a cheat.
import { applyMove } from '@pebble/engine';
import type { EngineConfig, GameState, Move, PlayerId } from '@pebble/engine';
import type { MoveRejection } from '@pebble/protocol';

export type AuthorityResult =
    | { ok: true; state: GameState }
    | { ok: false; reason: MoveRejection };

export function applyMoveForSeat(
    cfg: EngineConfig,
    state: GameState,
    move: Move,
    seat: PlayerId
): AuthorityResult {
    //  Checked before the seat: on a finished game state.current still holds
    //  a value, so a seat check would accept or reject essentially at random
    //  and report a misleading reason.
    if (state.phase === 'gameover') {
        return { ok: false, reason: 'game-over' };
    }
    //  THE CHECK. Must precede applyMove. Do not move it, do not merge it
    //  into the try block, do not "simplify" it away because applyMove looks
    //  like it already validates everything — it validates the move, not the
    //  mover.
    if (seat !== state.current) {
        return { ok: false, reason: 'not-your-turn' };
    }
    try {
        return { ok: true, state: applyMove(cfg, state, move) };
    } catch {
        //  applyMove throws on an illegal move (rules.ts:287). That is the
        //  engine's own guarantee and is inherited free — this catch only
        //  converts it from an exception into a value the caller can ack.
        return { ok: false, reason: 'illegal-move' };
    }
}
```
- **MIRROR**: BRACE_STYLE_ENGINE, ENGINE_IMPORT_STYLE.
- **IMPORTS**: exactly as written above. `applyMove` is a value; `EngineConfig`/`GameState`/`Move`/`PlayerId` and `MoveRejection` are types.
- **GOTCHA**: `catch {}` with no binding is intentional and required — `noUnusedLocals`/`noUnusedParameters` are on (`tsconfig.base.json:18-19`), so `catch (e)` with `e` unused fails the build.
- **GOTCHA**: `applyMove` returns a **new** state and never mutates its input, so the rejection paths cannot corrupt `state`. Test A1.4 asserts this rather than assuming it.
- **VALIDATE**: `pnpm --filter @pebble/server typecheck` → zero errors.

### Task 8: Create `apps/server/src/__tests__/authority.test.ts` — **the non-vacuous test**
- **ACTION**: Create the tests.
- **IMPLEMENT**:
```ts
import { describe, expect, it } from 'vitest';
import { initialState, legalMoves, positionKey } from '@pebble/engine';
import type { PlayerId } from '@pebble/engine';
import { CLASH_MODE, WELL_MODE } from '@pebble/engine/modes';
import { applyMoveForSeat } from '../authority';

const other = (p: PlayerId): PlayerId => (p === 1 ? 2 : 1);

//  Two fixtures on purpose: WELL_MODE opens in the placement phase and
//  CLASH_MODE is preplaced and opens in movement (rules.ts:24-45). They
//  exercise applyMove's two different branches through the same gate.
describe('A1 turn ownership', () => {
    it('applies a legal move from the seat whose turn it is', () => {
        const s = initialState(WELL_MODE.engine, WELL_MODE.id);
        const m = legalMoves(WELL_MODE.engine, s)[0];
        const r = applyMoveForSeat(WELL_MODE.engine, s, m, s.current);
        expect(r.ok).toBe(true);
    });

    //  ===================================================================
    //  THE test this whole phase exists for. Read before touching it.
    //
    //  legalMoves(cfg, s) generates moves ONLY for s.current
    //  (rules.ts:57-70). So legalMoves(cfg, s)[0] is a move that is legal
    //  RIGHT NOW, for the player whose turn it is. Handed to applyMove it
    //  would be applied happily. ONLY the seat check rejects it.
    //
    //  The intuitive alternative -- "take a move the OTHER player could
    //  legally make and submit it out of turn" -- is a WORTHLESS test: such
    //  a move is not in legalMoves(s), so applyMove throws at rules.ts:287
    //  all by itself, and the test passes with NO seat check present. That
    //  is a green check named "rejects out-of-turn moves" that guards
    //  nothing. Do not rewrite this test into that one.
    //  ===================================================================
    it('rejects a CURRENTLY-LEGAL move submitted by the other seat (placement)', () => {
        const s = initialState(WELL_MODE.engine, WELL_MODE.id);
        const m = legalMoves(WELL_MODE.engine, s)[0];
        const r = applyMoveForSeat(WELL_MODE.engine, s, m, other(s.current));
        expect(r).toEqual({ ok: false, reason: 'not-your-turn' });
    });

    it('rejects a CURRENTLY-LEGAL move submitted by the other seat (movement)', () => {
        const s = initialState(CLASH_MODE.engine, CLASH_MODE.id);
        expect(s.phase).toBe('movement');
        const m = legalMoves(CLASH_MODE.engine, s)[0];
        const r = applyMoveForSeat(CLASH_MODE.engine, s, m, other(s.current));
        expect(r).toEqual({ ok: false, reason: 'not-your-turn' });
    });

    it('leaves the input state byte-identical when it rejects', () => {
        const s = initialState(WELL_MODE.engine, WELL_MODE.id);
        const before = positionKey(WELL_MODE.engine, s);
        const m = legalMoves(WELL_MODE.engine, s)[0];
        applyMoveForSeat(WELL_MODE.engine, s, m, other(s.current));
        expect(positionKey(WELL_MODE.engine, s)).toBe(before);
    });

    it('rejects an illegal move from the correct seat', () => {
        const s = initialState(WELL_MODE.engine, WELL_MODE.id);
        const taken = legalMoves(WELL_MODE.engine, s)[0];
        const after = applyMoveForSeat(WELL_MODE.engine, s, taken, s.current);
        expect(after.ok).toBe(true);
        if (!after.ok) return;
        //  Placing on the vertex just taken is illegal for anyone.
        const r = applyMoveForSeat(WELL_MODE.engine, after.state, taken, after.state.current);
        expect(r).toEqual({ ok: false, reason: 'illegal-move' });
    });
});
```
- **MIRROR**: TEST_STRUCTURE (`describe('A1 …')`, named vitest imports, module-level helpers).
- **IMPORTS**: `positionKey` is exported from `@pebble/engine` (`packages/engine/src/index.ts:11`) and takes **two** arguments — `positionKey(cfg, s)` (`packages/engine/src/ai.ts:5`). Calling it with one argument is a type error.
- **GOTCHA-1**: The `legalMoves(cfg, s)[0]` line is the entire value of this file. If you find yourself constructing a move by hand, or picking a move belonging to the non-current player, stop — you are writing the vacuous version the comment block describes.
- **GOTCHA**: `expect(r).toEqual({ ok: false, reason: 'not-your-turn' })` asserts the whole object, so an implementation returning `{ ok: false }` with a wrong or missing reason fails. Do not weaken it to `expect(r.ok).toBe(false)`.
- **GOTCHA**: `if (!after.ok) return;` is discriminated-union narrowing, not defensive padding — `after.state` does not exist on the failure branch.
- **VALIDATE**: `pnpm --filter @pebble/server test` → 5 tests pass.

### Task 9: Create `apps/server/src/__tests__/sole-mutator.test.ts` — the structural guard
- **ACTION**: Create the test that makes skipping the seat check impossible.
- **IMPLEMENT**:
```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

//  Structural guard, not a style rule. applyMoveForSeat is the only place the
//  turn check lives (see src/authority.ts). If handler code can reach past it
//  to the engine's raw applyMove, the check is bypassable and the server's
//  anti-cheat guarantee is void. A prose warning would not survive a
//  refactor; a failing test does.
const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            //  Tests are exempt: they legitimately reference the engine.
            if (entry.name === '__tests__') continue;
            out.push(...sourceFiles(join(dir, entry.name)));
            continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        //  authority.ts is the one file allowed to call applyMove.
        if (entry.name === 'authority.ts') continue;
        out.push(join(dir, entry.name));
    }
    return out;
}

describe('A2 authority is the sole mutator', () => {
    //  Without this, an empty or mis-pointed scan makes the assertion below
    //  pass by finding nothing -- the same vacuous-green failure this whole
    //  phase is built to prevent.
    it('actually finds source files to scan', () => {
        expect(sourceFiles(SRC).length).toBeGreaterThan(0);
    });

    it('no file outside authority.ts references the engine applyMove', () => {
        //  \b...\b does NOT match applyMoveForSeat: 'e' and 'F' are both word
        //  characters, so there is no boundary between them. This matches the
        //  raw engine call and nothing else.
        const offenders = sourceFiles(SRC).filter((file) =>
            /\bapplyMove\b/.test(readFileSync(file, 'utf8'))
        );
        expect(offenders).toEqual([]);
    });
});
```
- **MIRROR**: TEST_STRUCTURE.
- **GOTCHA**: Use `fileURLToPath(new URL('..', import.meta.url))`, **not** `import.meta.dirname` — the latter needs Node ≥20.11 and behaves inconsistently under some bundler transforms. The URL form is universally safe in ESM.
- **GOTCHA**: The `'actually finds source files to scan'` test is not padding. It stops this guard from degenerating into a test that passes because it scanned an empty list — exactly the disease Task 8's comment block describes.
- **VALIDATE**: `pnpm --filter @pebble/server test` → 7 tests pass total. Then **prove the guard bites**: temporarily add `import { applyMove } from '@pebble/engine';` to `src/index.ts`, re-run, confirm A2 **fails**, then remove it.

### Task 10: Create `apps/server/src/index.ts`
- **ACTION**: Create the entry point: http server, health endpoint, socket.io attached.
- **IMPLEMENT**:
```ts
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { HEALTH_PATH } from '@pebble/protocol';
import type {
    ClientToServerEvents,
    HealthResponse,
    InterServerEvents,
    ServerToClientEvents,
    SocketData
} from '@pebble/protocol';

const PORT = Number(process.env.PORT ?? 3001);

//  The web client is served from a different origin than this process --
//  Netlify is static-only and cannot host a socket server, so cross-origin is
//  the normal case here, not an edge case. 8080 is the vite dev server
//  (apps/web/vite/config.dev.mjs:10). Production origins arrive via env.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8080').split(',');

const httpServer = createServer((req, res) => {
    //  The health probe is a cross-origin fetch, so it needs its own CORS
    //  header: socket.io's cors option covers the socket handshake only and
    //  does nothing for this plain HTTP route.
    const origin = req.headers.origin;
    if (origin !== undefined && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    if (req.url === HEALTH_PATH) {
        const body: HealthResponse = { ok: true };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
        return;
    }
    res.writeHead(404);
    res.end();
});

//  Exported so Phase 2's handlers can register against it. No connection
//  logic here yet: this phase proves the process boots and the authority
//  boundary holds, nothing more.
export const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
});

httpServer.listen(PORT, () => {
    console.log(`[server] listening on :${PORT} — origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
```
- **MIRROR**: BRACE_STYLE_ENGINE, ENGINE_IMPORT_STYLE.
- **GOTCHA-3**: `import { Server } from 'socket.io'` — a **named** import. socket.io has **no default export**; its ESM shim re-exports only `Server`, `Namespace`, and `Socket` as runtime values. Anything else from that package (`ServerOptions`, `DefaultEventsMap`, …) is **type-only** and must use `import type`, or you get `SyntaxError: does not provide an export named …` at runtime — which typecheck will not catch.
- **GOTCHA**: Options are socket.io's **2nd** argument: `new Server(httpServer, opts)`. And `listen()` goes on **`httpServer`**, never on `io`.
- **GOTCHA**: All four generics are required. `SocketData` is the 4th, so `InterServerEvents` must be passed even though it is empty.
- **GOTCHA**: `console.log` is the only logging in this repo — do not add a logging library.
- **VALIDATE**: see Task 11.

### Task 11: Prove the whole thing — including that tests actually run
- **ACTION**: Run every validation command and check outputs against the expectations below.
- **IMPLEMENT**: from the repo root:
```bash
pnpm install
pnpm -r typecheck
pnpm -r test
pnpm --filter @pebble/server dev
# in a second terminal:
curl -i http://localhost:3001/health
```
- **GOTCHA-2 (would burn hours)**: The server runs **only** under `tsx`. **Never** `node src/index.ts`. Two independent reasons, both fatal — and Node 24 strips types natively, so the command *looks* like it should work:
  1. Every engine import is extensionless (`from './board'`) or a directory import (`from './clash'` → `clash/index.ts`). Strict Node ESM rejects both: `ERR_MODULE_NOT_FOUND: Cannot find module '.../packages/engine/src/rules'`. tsx resolves them because it behaves like a bundler.
  2. Force resolution to stay inside `node_modules` and Node instead throws `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` — Node deliberately refuses to strip types under `node_modules`.

  If you see either error, the fix is *use tsx*, **not** "add a build step".
- **VALIDATE — every one of these must hold**:
  - `pnpm -r typecheck` → zero errors across `@pebble/engine`, `@pebble/protocol`, `@pebble/server`, `@pebble/web`.
  - `pnpm -r test` output includes a line for **`@pebble/server`** with a **non-zero test count (7)**. **A zero count, or `@pebble/server` not appearing at all, is a FAILURE of this phase**, not a pass — it means the `test` script is missing and Phase 2 would build on nothing. Re-read GOTCHA-4.
  - `pnpm -r test` still shows `@pebble/engine` green (no regression).
  - `curl -i http://localhost:3001/health` → `HTTP/1.1 200 OK`, `Content-Type: application/json`, body exactly `{"ok":true}`.
  - `curl -i http://localhost:3001/nope` → `404`.
  - The temporary `applyMove` import added to `index.ts` in Task 9 makes A2 fail; removing it makes A2 pass again.

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| A1.1 in-turn legal move | `legalMoves(well, s)[0]`, seat = `s.current` | `{ ok: true, state }` | No |
| **A1.2 currently-legal move, wrong seat (placement)** | `legalMoves(well, s)[0]`, seat = `other(s.current)` | `{ ok: false, reason: 'not-your-turn' }` | **THE test** |
| **A1.3 currently-legal move, wrong seat (movement)** | `legalMoves(clash, s)[0]`, seat = `other(s.current)` | `{ ok: false, reason: 'not-your-turn' }` | **THE test, other branch** |
| A1.4 state untouched on reject | `positionKey` before vs after a rejection | identical | Yes |
| A1.5 illegal move, right seat | re-place on an occupied vertex | `{ ok: false, reason: 'illegal-move' }` | Yes |
| A2.1 scan is non-empty | `sourceFiles(SRC)` | `length > 0` | **Anti-vacuity** |
| A2.2 sole mutator | every `.ts` under `src/` except `authority.ts` + `__tests__/` | no `\bapplyMove\b` match | Yes |

### Edge Cases Checklist
- [x] **Move legal for the current player, submitted by the other seat** — A1.2, A1.3. The actual exploit.
- [x] **Move illegal for everyone** — A1.5. Inherited from the engine; asserted anyway to prove the `catch` converts the throw into a value.
- [x] **Move on a finished game** — the `gameover` branch, ahead of the seat check.
- [x] **Rejection leaves state intact** — A1.4.
- [x] **The scan itself finds nothing** — A2.1.
- [ ] Concurrent access — N/A. Node is single-threaded and Phase 1 has no shared mutable state.
- [ ] Network failure — N/A. No socket handlers exist yet (Phase 2).
- [ ] Permission denied — N/A. No auth by design (see PRD "What We're NOT Building").

---

## Validation Commands

### Static Analysis
```bash
pnpm -r typecheck
```
EXPECT: zero type errors in all four packages.

### Unit Tests
```bash
pnpm --filter @pebble/server test
```
EXPECT: 7 passing.

### Full Test Suite
```bash
pnpm -r test
```
EXPECT: `@pebble/engine` green (no regression) **AND a `@pebble/server` line with a non-zero count**. A missing `@pebble/server` line is a phase failure.

### Server Boot
```bash
pnpm --filter @pebble/server dev
curl -i http://localhost:3001/health
```
EXPECT: `200`, `{"ok":true}`. Never run this with bare `node` — see GOTCHA-2.

### Manual Validation
- [ ] `pnpm -r test` prints a `@pebble/server` line with a **non-zero** test count.
- [ ] Temporarily importing `applyMove` into `src/index.ts` makes A2 **fail**; removing it makes A2 pass.
- [ ] `curl http://localhost:3001/health` → `{"ok":true}`; `/nope` → 404.
- [ ] `git status` shows only the 10 new files — nothing under `apps/web`.

---

## Acceptance Criteria
- [ ] All 11 tasks completed.
- [ ] `pnpm -r typecheck` clean.
- [ ] `pnpm -r test` green **with `@pebble/server` present and non-zero**.
- [ ] `/health` returns `{"ok":true}`; unknown paths 404.
- [ ] `applyMoveForSeat` checks `seat !== state.current` **before** calling `applyMove`.
- [ ] A1.2/A1.3 use `legalMoves(cfg, s)[0]` — a move legal for the *current* player — submitted from the *other* seat.
- [ ] A2 fails when `applyMove` is imported outside `authority.ts` (demonstrated, then reverted).
- [ ] No file under `apps/web` was touched.

## Completion Checklist
- [ ] K&R braces, 4-space indent, `//` + two-space comments (engine style, **not** `apps/web`'s Allman).
- [ ] Values via `import {}`, types via `import type {}` (required by `isolatedModules`).
- [ ] No unused imports or unused catch bindings (`noUnusedLocals`/`noUnusedParameters` are on).
- [ ] `packages/engine` and `apps/web` unmodified.
- [ ] No build step or `dist` added to any package.
- [ ] Every package has a `typecheck` script; every package with tests has a `test` script.
- [ ] Self-contained — no codebase searching needed during implementation.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `test` script omitted → Phase 2 builds on tests that never run | **M** | **Critical** | GOTCHA-4 on Task 4; Task 11 makes "non-zero server test count" an explicit pass condition; repo precedent cited (`packages/engine/vitest.config.ts`). |
| Turn-check test rewritten into the vacuous form | **M** | **Critical** | Comment block in Task 8 explaining why the intuitive test is worthless; `legalMoves(cfg, s)[0]` given literally; `toEqual` on the whole result object. |
| Executor runs `node src/index.ts` and rabbit-holes | **M** | Medium | GOTCHA-2 names both failure modes and their exact error strings. |
| socket.io default-import → runtime SyntaxError typecheck won't catch | **L** | Medium | GOTCHA-3; the exact import line is given. |
| Seat check placed inside/after the try block | **L** | **Critical** | Position called out inline in `authority.ts`'s own comment; A1.2/A1.3 fail if it is moved after `applyMove`. |
| `pnpm install` skipped → nothing resolves | **L** | Low | Task 5 makes it an explicit step; fails loudly and immediately. |

## Notes

**Why this phase is Machine-verified while most later ones are not.** Per the PRD's "Verification Reality": `apps/web` has no test harness *by design* (`single-player-ai-phase-2-wiring.plan.md:212-219`), so client phases end in human playtests. This phase is pure Node logic — the executor runs `pnpm -r test` and *knows*. That is exactly why the anti-cheat guarantee was pulled forward into Phase 1 rather than left in Phase 2 among the socket handlers: it is the one property most worth proving, and this is the only phase that can prove it without a human.

**Why `applyMoveForSeat` lives in `apps/server` and not `packages/engine`.** The engine's contract is "pure rules, no runtime deps, no notion of players-as-clients" (`packages/engine/src/index.ts:1-7`). Seats are a *session* concept, not a *rules* concept — the engine has `PlayerId`, but no idea a `PlayerId` corresponds to a socket. Putting the check in the engine would leak session semantics into the rule layer and change a package `apps/web` depends on. It belongs on the server side of the boundary.

**Why the protocol defines events this phase does not implement.** Fixing the whole contract now is what makes PRD phases 2 (server handlers) and 5 (client net layer) genuinely parallel: both compile against the same types and cannot drift. Same reason `@pebble/engine` is a package rather than living inside `apps/web`.

**Verified during planning, not assumed** (a throwaway spike reproduced this repo's exact structure — raw-TS `exports`, pnpm symlink, tsx):
- tsx **does** transform workspace-symlinked raw TypeScript. It transforms `.ts` anywhere, including inside `node_modules` — proven by forcing the path to stay there with `--preserve-symlinks`. The widespread "tsx skips node_modules" belief is **`ts-node`'s** default, not tsx's.
- `tsc --noEmit` with `moduleResolution: "bundler"` resolves `@pebble/engine` through its `exports` map to raw `.ts` and performs **real** cross-package typechecking (a deliberate cross-boundary type error was caught).
- Because the symlink realpath lands outside `node_modules`, `tsx watch` **does** hot-reload engine edits. Do not add `--preserve-symlinks`; it would still run but would break that.
