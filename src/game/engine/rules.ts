import { adjacency } from './board';
import type { EngineConfig, GameState, Move, PlayerId, VertexId } from './types';

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
    let moves: Move[];
    if ((cfg.movement ?? 'slide') === 'step') {
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
        : (m.kind === 'move' && lm.from === m.from && lm.to === m.to)
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
