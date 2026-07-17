import { describe, expect, it } from 'vitest';
import { initialState, legalMoves } from '../../rules';
import { CLASH_MODE } from '../clash';
import { MODES } from '../registry';

describe('E1 board fidelity — matches the traditional Sixteen Soldiers position', () => {
    it('has exactly 37 vertices', () => {
        expect(CLASH_MODE.engine.board.vertices).toHaveLength(37);
    });

    it('has exactly 20 lines', () => {
        //  Was 24: four apex-diagonal pairs (g02, g42) merged into four
        //  single continuous lines — see comment in clash/index.ts.
        expect(CLASH_MODE.engine.board.lines).toHaveLength(20);
    });

    it('has no duplicate vertex ids', () => {
        const ids = CLASH_MODE.engine.board.vertices.map((v) => v.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('preplaces exactly 16 pebbles for each player', () => {
        expect(CLASH_MODE.engine.preplaced![1]).toHaveLength(16);
        expect(CLASH_MODE.engine.preplaced![2]).toHaveLength(16);
    });

    it('no vertex is claimed by both players', () => {
        const p1 = new Set(CLASH_MODE.engine.preplaced![1]);
        const overlap = CLASH_MODE.engine.preplaced![2].filter((id) => p1.has(id));
        expect(overlap).toEqual([]);
    });

    it('leaves exactly the 5 centre-row vertices empty', () => {
        const allVertexIds = new Set(CLASH_MODE.engine.board.vertices.map((v) => v.id));
        const occupied = new Set([...CLASH_MODE.engine.preplaced![1], ...CLASH_MODE.engine.preplaced![2]]);
        const empty = [...allVertexIds].filter((id) => !occupied.has(id)).sort();
        expect(empty).toEqual(['g20', 'g21', 'g22', 'g23', 'g24']);
    });

    it('every preplaced/line id refers to a real board vertex', () => {
        const allVertexIds = new Set(CLASH_MODE.engine.board.vertices.map((v) => v.id));
        for (const id of [...CLASH_MODE.engine.preplaced![1], ...CLASH_MODE.engine.preplaced![2]]) {
            expect(allVertexIds.has(id)).toBe(true);
        }
        for (const line of CLASH_MODE.engine.board.lines) {
            for (const id of line) expect(allVertexIds.has(id)).toBe(true);
        }
    });
});

describe('E2 mode registration', () => {
    it('is registered under id "clash"', () => {
        expect(MODES['clash']).toBe(CLASH_MODE);
    });
});

describe('E3 initial state — real board', () => {
    it('seeds 32 pebbles total and opens in movement phase', () => {
        const s = initialState(CLASH_MODE.engine, 'clash');
        expect(s.phase).toBe('movement');
        expect(Object.values(s.board).filter((v) => v !== null)).toHaveLength(32);
    });

    it('every legal opening move is a quiet step — no jumps at turn one', () => {
        //  Both sides are separated by the empty centre row at the opening
        //  position, so no jump should be legal turn one. This is the first
        //  point where Phase 3's rules and Phase 5's real board data run
        //  together — a failure here is almost certainly a board
        //  transcription bug, not a rules bug (rules are already tested).
        const moves = legalMoves(CLASH_MODE.engine, initialState(CLASH_MODE.engine, 'clash'));
        expect(moves.every((m) => m.kind === 'move')).toBe(true);
        expect(moves.length).toBeGreaterThan(0);
    });
});
