import { adjacency } from './board';
import type { EngineConfig, GameState, Move, PlayerId, VertexId } from './types';

export function pebbleCount(board: Record<VertexId, PlayerId | null>, player: PlayerId): number {
    return Object.values(board).filter((p) => p === player).length;
}

export function alignedPlayer(cfg: EngineConfig, board: Record<VertexId, PlayerId | null>): PlayerId | null {
    for (const line of cfg.board.lines) {
        const first = board[line[0]];
        if (first !== null && line.every((v) => board[v] === first)) return first;
    }
    return null;
}

export function initialState(cfg: EngineConfig, modeId: string): GameState {
    const board: Record<VertexId, PlayerId | null> = {};
    for (const v of cfg.board.vertices) {
        board[v.id] = null;
    }
    //  Pre-placed modes have no placement phase: seed the board from config
    //  and open in movement. Validated eagerly because a typo'd vertex id in
    //  a mode's transcription is otherwise a silently-missing pebble.
    if (cfg.preplaced) {
        for (const p of [1, 2] as PlayerId[]) {
            for (const id of cfg.preplaced[p]) {
                if (!(id in board)) {
                    throw new Error(`preplaced vertex not on board: ${id}`);
                }
                if (board[id] !== null) {
                    throw new Error(`preplaced vertex occupied twice: ${id}`);
                }
                board[id] = p;
            }
        }
        return {
            modeId,
            phase: 'movement',
            board,
            current: 1,
            placed: { 1: cfg.preplaced[1].length, 2: cfg.preplaced[2].length },
            winner: null,
            history: {}
        };
    }
    return {
        modeId,
        phase: 'placement',
        board,
        current: 1,
        placed: { 1: 0, 2: 0 },
        winner: null,
        history: {}
    };
}

export function legalMoves(cfg: EngineConfig, s: GameState): Move[] {
    if (s.phase === 'gameover') {
        return [];
    }
    if (s.phase === 'placement') {
        return Object.keys(s.board)
            .filter((id) => s.board[id] === null)
            .map((to) => ({ kind: 'place' as const, to }));
    }
    //  phase === 'movement'
    if (cfg.movement === 'draughts') {
        //  Draughts rules: quiet one-step (or flying long-range if ≤threshold),
        //  plus maximal jump chains (optional capture). Return both.
        const adj = adjacency(cfg.board);
        let moves: Move[] = [];
        const flying = cfg.flyingThreshold !== undefined && pebbleCount(s.board, s.current) <= cfg.flyingThreshold;
        const seen = new Set<string>();

        //  Quiet moves: adjacent empty (or long-range if flying)
        if (flying) {
            //  Flying: slides along every line until an occupied cell
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
        } else {
            //  Non-flying: adjacent empty only (perimeter rule — single-step)
            for (const v of Object.keys(s.board)) {
                if (s.board[v] !== s.current) continue;
                for (const n of adj[v]) {
                    if (s.board[n] === null) moves.push({ kind: 'move', from: v, to: n });
                }
            }
        }

        //  Jump chains (maximal, optional)
        moves.push(...enumerateJumpChains(cfg, s));
        return moves;
    }
    let moves: Move[];
    if ((cfg.movement ?? 'slide') === 'skip') {
        //  skip: slide along a line, can jump over occupied cells to reach empty ones
        moves = [];
        const seen = new Set<string>();
        for (const line of cfg.board.lines) {
            for (let i = 0; i < line.length; i++) {
                if (s.board[line[i]] !== s.current) continue;
                for (const dir of [1, -1]) {
                    for (let j = i + dir; j >= 0 && j < line.length; j += dir) {
                        if (s.board[line[j]] === null) {
                            const key = `${line[i]}>${line[j]}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                moves.push({ kind: 'move', from: line[i], to: line[j] });
                            }
                        }
                    }
                }
            }
        }
    } else if ((cfg.movement ?? 'slide') === 'step') {
        const adj = adjacency(cfg.board);
        moves = [];
        for (const v of Object.keys(s.board)) {
            if (s.board[v] !== s.current) continue;
            for (const n of adj[v]) {
                if (s.board[n] === null) moves.push({ kind: 'move', from: v, to: n });
            }
        }
    } else {
        //  movement: slide along a line, any distance, stop at any empty vertex
        //  strictly before the first occupied one. Dedupe by (from,to) — a
        //  destination reachable via two lines is one move.
        moves = [];
        const seen = new Set<string>();
        for (const line of cfg.board.lines) {
            for (let i = 0; i < line.length; i++) {
                if (s.board[line[i]] !== s.current) {
                    continue;
                }
                for (const dir of [1, -1]) {
                    for (let j = i + dir; j >= 0 && j < line.length; j += dir) {
                        if (s.board[line[j]] !== null) {
                            break;
                        }
                        const key = `${line[i]}>${line[j]}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            moves.push({ kind: 'move', from: line[i], to: line[j] });
                        }
                    }
                }
            }
        }
    }
    //  forced pass ONLY in alignment mode when otherwise stuck
    if (moves.length === 0 && (cfg.win ?? 'trap') === 'alignment') {
        return [{ kind: 'pass' }];
    }
    return moves;
}

//  Recursively extend jump chains from a landing vertex across ALL lines.
//  Working board (which has captured opponent removed) lets us check for subsequent
//  hops without re-capturing. Returns all maximal chains from this landing.
//  `flying` (≤flyingThreshold pebbles) lets a hop cross any run of EMPTY
//  cells before the opponent, and land on ANY empty cell beyond it (each is
//  a separate branch) — a long-range "flying" capture, not just adjacent.
function extendJumpChain(
    working: Record<VertexId, PlayerId | null>,
    lines: VertexId[][],
    current: PlayerId,
    landing: VertexId,
    hopsToDate: { over: VertexId; to: VertexId }[],
    flying: boolean
): { over: VertexId; to: VertexId }[][] {
    const chains: { over: VertexId; to: VertexId }[][] = [hopsToDate];
    const opponent = current === 1 ? 2 : 1;

    //  Search for next hops on ANY line passing through the landing vertex
    for (const line of lines) {
        const idx = line.indexOf(landing);
        if (idx === -1) continue; //  Landing not on this line

        for (const dir of [1, -1]) {
            if (!flying) {
                const oppIdx = idx + dir;
                const nextIdx = idx + 2 * dir;
                if (oppIdx < 0 || oppIdx >= line.length || nextIdx < 0 || nextIdx >= line.length) {
                    continue;
                }
                if (working[line[oppIdx]] !== opponent) {
                    continue;
                }
                if (working[line[nextIdx]] !== null) {
                    continue;
                }
                const newWorking = { ...working };
                newWorking[line[oppIdx]] = null;
                const nextLanding = line[nextIdx];
                const newHops = [...hopsToDate, { over: line[oppIdx], to: nextLanding }];
                const extended = extendJumpChain(newWorking, lines, current, nextLanding, newHops, flying);
                chains.push(...extended);
                continue;
            }

            //  Flying: skip any run of empty cells to find the first
            //  occupied one. Anything but a lone opponent piece blocks.
            let oppIdx = idx + dir;
            while (oppIdx >= 0 && oppIdx < line.length && working[line[oppIdx]] === null) {
                oppIdx += dir;
            }
            if (oppIdx < 0 || oppIdx >= line.length || working[line[oppIdx]] !== opponent) {
                continue;
            }
            //  Every empty cell beyond the captured piece is a distinct
            //  landing — a separate chain branch — until blocked.
            for (let landIdx = oppIdx + dir; landIdx >= 0 && landIdx < line.length && working[line[landIdx]] === null; landIdx += dir) {
                const newWorking = { ...working };
                newWorking[line[oppIdx]] = null;
                const nextLanding = line[landIdx];
                const newHops = [...hopsToDate, { over: line[oppIdx], to: nextLanding }];
                const extended = extendJumpChain(newWorking, lines, current, nextLanding, newHops, flying);
                chains.push(...extended);
            }
        }
    }

    return chains;
}

//  Enumerate all maximal jump chains for the current player from any starting
//  pebble. Dedup by stringified hops, sort by chain length descending (long
//  chains are greedier, later Phase 4 AI will score them higher).
function enumerateJumpChains(cfg: EngineConfig, s: GameState): Move[] {
    const chains: Map<string, { from: VertexId; hops: { over: VertexId; to: VertexId }[] }> = new Map();
    const flying = cfg.flyingThreshold !== undefined && pebbleCount(s.board, s.current) <= cfg.flyingThreshold;

    for (const line of cfg.board.lines) {
        for (let i = 0; i < line.length; i++) {
            const start = line[i];
            if (s.board[start] !== s.current) continue;
            //  Working copy for this starting pebble — we'll mark captures
            const working = { ...s.board };
            const allChains = extendJumpChain(working, cfg.board.lines, s.current, start, [], flying);
            //  Filter to chains with at least one hop, dedup on (from, hops)
            for (const hops of allChains) {
                if (hops.length > 0) {
                    const key = JSON.stringify({ from: start, hops });
                    if (!chains.has(key)) {
                        chains.set(key, { from: start, hops });
                    }
                }
            }
        }
    }

    //  Sort by chain length descending, convert to Move array
    return Array.from(chains.values())
        .sort((a, b) => b.hops.length - a.hops.length)
        .map((c) => ({ kind: 'jump' as const, from: c.from, hops: c.hops }));
}

//  Position = board layout (in fixed vertex order) + side-to-move. Only
//  called on movement-phase states — placement positions strictly gain
//  pebbles and can never recur, so they're never keyed.
function positionKey(cfg: EngineConfig, s: GameState): string {
    return cfg.board.vertices.map((v) => s.board[v.id] ?? '.').join('') + '|' + s.current;
}

export function applyMove(cfg: EngineConfig, s: GameState, m: Move): GameState {
    const legal = legalMoves(cfg, s).some((lm) =>
        lm.kind === 'pass'  ? m.kind === 'pass'
        : lm.kind === 'place' ? (m.kind === 'place' && lm.to === m.to)
        : lm.kind === 'move' ? (m.kind === 'move' && lm.from === m.from && lm.to === m.to)
        : lm.kind === 'jump' ? (m.kind === 'jump' && lm.from === m.from && JSON.stringify(lm.hops) === JSON.stringify(m.hops))
        : false
    );
    if (!legal) {
        throw new Error(`illegal move: ${JSON.stringify(m)}`);
    }

    const board = { ...s.board };
    let placed = s.placed;
    if (m.kind === 'place') {
        board[m.to] = s.current;
        placed = { ...s.placed, [s.current]: s.placed[s.current] + 1 };
    } else if (m.kind === 'move') {
        board[m.from] = null;
        board[m.to] = s.current;
    } else if (m.kind === 'jump') {
        //  Remove all captured pebbles, move current pebble to final landing
        for (const hop of m.hops) {
            board[hop.over] = null;
        }
        const lastHop = m.hops[m.hops.length - 1];
        board[m.from] = null;
        board[lastHop.to] = s.current;
    }
    //  if m.kind === 'pass', board and placed unchanged

    //  placement ends after 2 × pebblesPerPlayer total placements — never hardcode 4
    const phase =
        s.phase === 'placement' && placed[1] + placed[2] < 2 * cfg.pebblesPerPlayer
            ? 'placement'
            : 'movement';

    let next: GameState = {
        ...s,
        board,
        placed,
        phase,
        current: s.current === 1 ? 2 : 1,
        winner: null
    };

    //  alignment win (new, BEFORE trap/repetition block) — gated off pass
    if (m.kind !== 'pass' && (cfg.win ?? 'trap') === 'alignment') {
        const w = alignedPlayer(cfg, board);
        if (w !== null) return { ...next, phase: 'gameover', winner: w };
    }

    //  elimination win — current player wins if opponent has 0 pebbles
    if (m.kind !== 'pass' && (cfg.win ?? 'trap') === 'elimination') {
        const opponentCount = pebbleCount(board, s.current === 1 ? 2 : 1);
        if (opponentCount === 0) {
            return { ...next, phase: 'gameover', winner: s.current };
        }
    }

    if (next.phase === 'movement') {
        //  Record the resulting position — covers ordinary moves and the
        //  placement→movement transition (occurrence 1 for that position).
        const key = positionKey(cfg, next);
        const history = { ...(s.history ?? {}) };
        const repeatCount = (history[key] ?? 0) + 1;
        history[key] = repeatCount;
        next = { ...next, history };

        //  TRAP win — only for trap mode. In alignment mode a stuck player passes instead.
        if ((cfg.win ?? 'trap') !== 'alignment' && legalMoves(cfg, next).length === 0) {
            return { ...next, phase: 'gameover', winner: s.current };
        }

        //  threefold repetition draw — gated by cfg.repetitionLimit (opt-in
        //  per mode). A trapping move is a terminal state reached at most
        //  once per game, so its repeatCount is always < repetitionLimit —
        //  win and draw can never fire on the same move; this is safely 2nd.
        if (cfg.repetitionLimit !== undefined && repeatCount >= cfg.repetitionLimit) {
            return { ...next, phase: 'gameover', winner: null };
        }
    }

    return next;
}
