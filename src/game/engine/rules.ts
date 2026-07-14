import type { EngineConfig, GameState, Move, PlayerId, VertexId } from './types';

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
        winner: null
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
    //  movement: slide along a line, any distance, stop at any empty vertex
    //  strictly before the first occupied one. Dedupe by (from,to) — a
    //  destination reachable via two lines is one move.
    const moves: Move[] = [];
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
    return moves;
}

export function applyMove(cfg: EngineConfig, s: GameState, m: Move): GameState {
    const legal = legalMoves(cfg, s).some((lm) =>
        lm.kind === 'place'
            ? m.kind === 'place' && lm.to === m.to
            : m.kind === 'move' && lm.from === m.from && lm.to === m.to
    );
    if (!legal) {
        throw new Error(`illegal move: ${JSON.stringify(m)}`);
    }

    const board = { ...s.board };
    let placed = s.placed;
    if (m.kind === 'place') {
        board[m.to] = s.current;
        placed = { ...s.placed, [s.current]: s.placed[s.current] + 1 };
    } else {
        board[m.from] = null;
        board[m.to] = s.current;
    }

    //  placement ends after 2 × pebblesPerPlayer total placements — never hardcode 4
    const phase =
        s.phase === 'placement' && placed[1] + placed[2] < 2 * cfg.pebblesPerPlayer
            ? 'placement'
            : 'movement';

    const next: GameState = {
        ...s,
        board,
        placed,
        phase,
        current: s.current === 1 ? 2 : 1,
        winner: null
    };

    //  trap check runs after EVERY move, including the final placement (PRD T7):
    //  gameover keeps current = trapped player, winner = mover
    if (next.phase === 'movement' && legalMoves(cfg, next).length === 0) {
        return { ...next, phase: 'gameover', winner: s.current };
    }
    return next;
}
