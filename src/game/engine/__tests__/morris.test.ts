import { describe, expect, it } from 'vitest';
import { MORRIS_MODE } from '../../modes/morris';
import { WELL_MODE } from '../../modes/well';
import { adjacency } from '../board';
import { chooseMove } from '../ai';
import { alignedPlayer, applyMove, initialState, legalMoves } from '../rules';
import type { GameState, Move, PlayerId, VertexId } from '../types';

const CFG = MORRIS_MODE.engine;

//  PRD fixture note: vectors list decision-relevant fields; helper fills defaults.
function makeState(partial: Partial<GameState> & { board: Record<VertexId, PlayerId | null> }): GameState {
    return {
        modeId: 'morris',
        phase: 'movement',
        current: 1,
        placed: { 1: 3, 2: 3 },
        winner: null,
        history: {},
        ...partial
    };
}

const moveDests = (s: GameState) =>
    legalMoves(CFG, s)
        .filter((m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move')
        .map((m) => `${m.from}>${m.to}`)
        .sort();

const keyOf = (s: GameState) =>
    CFG.board.vertices.map((v) => s.board[v.id] ?? '.').join('') + '|' + s.current;

describe('A1 board sanity', () => {
    it('adjacency matches the PRD table — centre degree 8, others degree 3', () => {
        const adj = adjacency(CFG.board);
        const sorted = Object.fromEntries(
            Object.entries(adj).map(([k, v]) => [k, [...v].sort()])
        );
        expect(sorted).toEqual({
            TL: ['C', 'L', 'T'],
            T: ['C', 'TL', 'TR'],
            TR: ['C', 'R', 'T'],
            L: ['BL', 'C', 'TL'],
            C: ['B', 'BL', 'BR', 'L', 'R', 'T', 'TL', 'TR'],
            R: ['BR', 'C', 'TR'],
            BL: ['B', 'C', 'L'],
            B: ['BL', 'BR', 'C'],
            BR: ['B', 'C', 'R']
        });
        expect(sorted.C).toHaveLength(8);
        for (const id of ['TL', 'T', 'TR', 'L', 'R', 'BL', 'B', 'BR']) {
            expect(sorted[id]).toHaveLength(3);
        }
    });
});

describe('A2 placement start', () => {
    it('initial state gives P1 exactly 9 place moves', () => {
        const moves = legalMoves(CFG, initialState(CFG, 'morris'));
        expect(moves).toHaveLength(9);
        expect(moves.every((m) => m.kind === 'place')).toBe(true);
    });
});

describe('A3 win on placement', () => {
    it('P1 completes the top row on their 3rd placement (5th overall) — immediate gameover', () => {
        let s = initialState(CFG, 'morris');
        for (const to of ['TL', 'BL', 'T', 'BR', 'TR']) {
            s = applyMove(CFG, s, { kind: 'place', to });
        }
        expect(s.phase).toBe('gameover');
        expect(s.winner).toBe(1);
        expect(s.current).toBe(2);
    });
});

describe('A4 no premature win', () => {
    it('two non-aligned placements never trigger a win', () => {
        let s = initialState(CFG, 'morris');
        for (const to of ['TL', 'T']) {
            s = applyMove(CFG, s, { kind: 'place', to });
        }
        expect(s.phase).toBe('placement');
        expect(s.winner).toBeNull();
    });
});

describe('A5 single-step movement, no sliding', () => {
    it('legal 3/3/3 board yields exactly 6 P1 moves; L→R is NOT legal', () => {
        const s = makeState({
            board: { TL: 2, T: 2, TR: 1, L: 1, C: null, R: null, BL: null, B: 1, BR: 2 },
            current: 1
        });
        expect(moveDests(s)).toEqual(
            ['B>BL', 'B>C', 'L>BL', 'L>C', 'TR>C', 'TR>R'].sort()
        );
        expect(moveDests(s)).not.toContain('L>R');

        const adj = adjacency(CFG.board);
        for (const m of legalMoves(CFG, s)) {
            if (m.kind === 'move') {
                expect(adj[m.from]).toContain(m.to);
            }
        }
    });
});

describe('A6 win on move', () => {
    it('C→T completes the top row — gameover, winner 1', () => {
        const s = makeState({
            board: { TL: 1, TR: 1, C: 1, L: 2, R: 2, B: 2, T: null, BL: null, BR: null },
            current: 1
        });
        //  P2 {L,R,B} is not itself a line — sanity check before the move
        expect(alignedPlayer(CFG, s.board)).toBeNull();

        const next = applyMove(CFG, s, { kind: 'move', from: 'C', to: 'T' });
        expect(next.phase).toBe('gameover');
        expect(next.winner).toBe(1);
        expect(next.current).toBe(2);
    });
});

describe('A7 forced pass (synthetic)', () => {
    it('all three P1 pebbles fully surrounded — legalMoves is exactly [pass]', () => {
        const s = makeState({
            board: { T: 1, TR: 1, R: 1, TL: 2, C: 2, BR: 2, L: null, B: null, BL: null },
            current: 1
        });
        expect(legalMoves(CFG, s)).toEqual([{ kind: 'pass' }]);
    });
});

describe('A8 pass semantics', () => {
    it('applying pass flips current, leaves board unchanged, records history', () => {
        const s = makeState({
            board: { T: 1, TR: 1, R: 1, TL: 2, C: 2, BR: 2, L: null, B: null, BL: null },
            current: 1,
            history: {}
        });
        const next = applyMove(CFG, s, { kind: 'pass' });
        expect(next.phase).toBe('movement');
        expect(next.current).toBe(2);
        expect(next.board).toEqual(s.board);
        expect(Object.keys(next.history ?? {})).toHaveLength(1);
    });
});

describe('A9 draw by threefold repetition', () => {
    it('a 4-ply cycle (two independent 1-cell shuffles) repeating 3x ends in a draw', () => {
        //  P1 shuffles TL<->T (via the empty T cell); P2 shuffles BR<->B (via
        //  the empty B cell) — independent empty cells let each side's
        //  shuffle round-trip in 2 plies instead of Mode-1's 6 (only 1 empty
        //  cell there forced a longer cycle). Neither shuffle ever aligns:
        //  P1={TL,L,R}/{T,L,R}, P2={TR,C,BR}/{TR,C,B} — verified against the
        //  8 lines during planning, none matches these triples.
        const start = makeState({
            board: { TL: 1, T: null, TR: 2, L: 1, C: 2, R: 1, BL: null, B: null, BR: 2 },
            current: 1
        });
        expect(alignedPlayer(CFG, start.board)).toBeNull();

        const startKey = keyOf(start);
        let s: GameState = { ...start, history: { [startKey]: 1 } };

        const cycle: Move[] = [
            { kind: 'move', from: 'TL', to: 'T' },
            { kind: 'move', from: 'BR', to: 'B' },
            { kind: 'move', from: 'T', to: 'TL' },
            { kind: 'move', from: 'B', to: 'BR' }
        ];

        for (const move of cycle) {
            s = applyMove(CFG, s, move);
        }
        expect(s.board).toEqual(start.board);
        expect(s.phase).toBe('movement');

        for (const move of cycle) {
            s = applyMove(CFG, s, move);
        }
        expect(s.phase).toBe('gameover');
        expect(s.winner).toBeNull();
    });
});

describe('A10 AI takes an immediate win', () => {
    it('chooseMove returns C→T, completing the top row', () => {
        const s = makeState({
            board: { TL: 1, TR: 1, C: 1, L: 2, R: 2, B: 2, T: null, BL: null, BR: null },
            current: 1
        });
        const chosen = chooseMove(CFG, s);
        expect(chosen).toEqual({ kind: 'move', from: 'C', to: 'T' });

        const next = applyMove(CFG, s, chosen);
        expect(next.phase).toBe('gameover');
        expect(next.winner).toBe(1);
    });
});

describe('A11 AI blocks an immediate loss', () => {
    it('chooseMove occupies TL, the only cell that stops P2\'s L→TL win next turn', () => {
        //  P2={T,TR,L} threatens L→TL (completes the top row TL-T-TR).
        //  TL's other neighbours (T, itself part of the line) can't be the
        //  blocker, and the only P1 piece adjacent to TL is C — so C→TL is
        //  the unique move that removes the threat. Verified during
        //  planning: none of P1's 6 legal moves creates an immediate P1
        //  win, and all 5 non-blocking moves leave TL open for P2.
        const s = makeState({
            board: { T: 2, TR: 2, L: 2, C: 1, R: 1, B: 1, TL: null, BL: null, BR: null },
            current: 1
        });
        expect(alignedPlayer(CFG, s.board)).toBeNull();

        const chosen = chooseMove(CFG, s);
        const afterP1 = applyMove(CFG, s, chosen);
        expect(afterP1.phase).not.toBe('gameover');

        const p2HasImmediateWin = legalMoves(CFG, afterP1).some((m) => {
            if (m.kind !== 'move') return false;
            const afterP2 = applyMove(CFG, afterP1, m);
            return afterP2.phase === 'gameover' && afterP2.winner === 2;
        });
        expect(p2HasImmediateWin).toBe(false);
    });
});

describe('A12 Mode 1 untouched', () => {
    it('WELL_MODE sets neither win nor movement — defaults preserved', () => {
        expect(WELL_MODE.engine.win).toBeUndefined();
        expect(WELL_MODE.engine.movement).toBeUndefined();
    });

    it('T4 spot-check: E→C still traps blue under WELL_MODE', () => {
        const wellCfg = WELL_MODE.engine;
        const s: GameState = {
            modeId: 'well',
            phase: 'movement',
            board: { E: 1, N: 1, S: 2, W: 2, C: null },
            current: 1,
            placed: { 1: 2, 2: 2 },
            winner: null,
            history: {}
        };
        const next = applyMove(wellCfg, s, { kind: 'move', from: 'E', to: 'C' });
        expect(next.phase).toBe('gameover');
        expect(next.winner).toBe(1);
        expect(next.current).toBe(2);
    });
});
