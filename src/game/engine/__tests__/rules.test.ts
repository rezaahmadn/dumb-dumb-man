import { describe, expect, it } from 'vitest';
import { WELL_MODE } from '../../modes/well';
import { adjacency, edgesFromLines } from '../board';
import { applyMove, initialState, legalMoves } from '../rules';
import type { GameState, Move, PlayerId, VertexId } from '../types';

const CFG = WELL_MODE.engine;

//  PRD fixture note: vectors list decision-relevant fields; helper fills defaults.
function makeState(partial: Partial<GameState> & { board: Record<VertexId, PlayerId | null> }): GameState {
    return {
        modeId: 'well',
        phase: 'movement',
        current: 1,
        placed: { 1: 2, 2: 2 },
        winner: null,
        ...partial
    };
}

const moveDests = (s: GameState) =>
    legalMoves(CFG, s)
        .filter((m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move')
        .map((m) => m.to)
        .sort();

const sortedEdgeKeys = (edges: [VertexId, VertexId][]) =>
    edges.map((e) => [...e].sort().join('-')).sort();

describe('T1 board sanity', () => {
    it('derives exactly the 7 well edges, no S-E', () => {
        const keys = sortedEdgeKeys(edgesFromLines(CFG.board.lines));
        expect(keys).toEqual(['C-E', 'C-N', 'C-S', 'C-W', 'E-N', 'N-W', 'S-W']);
        expect(keys).not.toContain('E-S');
    });

    it('adjacency matches the PRD trap-math table', () => {
        const adj = adjacency(CFG.board);
        const sorted = Object.fromEntries(
            Object.entries(adj).map(([k, v]) => [k, [...v].sort()])
        );
        expect(sorted).toEqual({
            C: ['E', 'N', 'S', 'W'],
            N: ['C', 'E', 'W'],
            E: ['C', 'N'],
            S: ['C', 'W'],
            W: ['C', 'N', 'S']
        });
    });
});

describe('T2 placement start', () => {
    it('initial state gives P1 exactly 5 place moves', () => {
        const moves = legalMoves(CFG, initialState(CFG, 'well'));
        expect(moves).toHaveLength(5);
        expect(moves.every((m) => m.kind === 'place')).toBe(true);
    });
});

describe('trap vectors', () => {
    it('T3: blue trapped when E is empty and blue sits on S+W', () => {
        const s = makeState({ board: { C: 1, N: 1, E: null, S: 2, W: 2 }, current: 2 });
        expect(legalMoves(CFG, s)).toEqual([]);
    });

    it('T4: E→C traps blue — gameover, red wins, current is the trapped player', () => {
        const s = makeState({ board: { E: 1, N: 1, S: 2, W: 2, C: null }, current: 1 });
        const next = applyMove(CFG, s, { kind: 'move', from: 'E', to: 'C' });
        expect(next.phase).toBe('gameover');
        expect(next.winner).toBe(1);
        expect(next.current).toBe(2);
    });

    it('T7: placement sequence S,C,W,N traps P1 on the transition — P2 wins', () => {
        let s = initialState(CFG, 'well');
        for (const to of ['S', 'C', 'W', 'N']) {
            s = applyMove(CFG, s, { kind: 'place', to });
        }
        expect(s.phase).toBe('gameover');
        expect(s.winner).toBe(2);
        expect(s.current).toBe(1);
    });
});

describe('slide rule (engine-general fixtures, unreachable in mode-1 play)', () => {
    it('T5: lone pebble at S reaches C, E, N, W — N deduped across lines', () => {
        const s = makeState({
            board: { S: 1, C: null, N: null, E: null, W: null },
            placed: { 1: 1, 2: 0 }
        });
        expect(moveDests(s)).toEqual(['C', 'E', 'N', 'W']);
    });

    it('T6: red at S fully blocked by blue at C and W', () => {
        const s = makeState({
            board: { S: 1, C: 2, W: 2, N: null, E: null },
            placed: { 1: 1, 2: 2 }
        });
        expect(legalMoves(CFG, s)).toEqual([]);
    });
});

describe('placement rules', () => {
    it('alternates players and counts placements', () => {
        const s0 = initialState(CFG, 'well');
        const s1 = applyMove(CFG, s0, { kind: 'place', to: 'C' });
        expect(s1.current).toBe(2);
        expect(s1.placed).toEqual({ 1: 1, 2: 0 });
        expect(s1.board.C).toBe(1);
        expect(s1.phase).toBe('placement');
    });

    it('transitions to movement after all placements when no trap', () => {
        let s = initialState(CFG, 'well');
        for (const to of ['C', 'N', 'W', 'S']) {
            s = applyMove(CFG, s, { kind: 'place', to });
        }
        expect(s.phase).toBe('movement');
        expect(s.current).toBe(1);
        expect(s.winner).toBeNull();
    });

    it('rejects placement on an occupied vertex', () => {
        const s0 = initialState(CFG, 'well');
        const s1 = applyMove(CFG, s0, { kind: 'place', to: 'C' });
        expect(() => applyMove(CFG, s1, { kind: 'place', to: 'C' })).toThrow(/illegal/);
    });
});

describe('movement rules', () => {
    it('rejects moving the opponent pebble', () => {
        const s = makeState({ board: { E: 1, N: 1, S: 2, W: 2, C: null } });
        expect(() => applyMove(CFG, s, { kind: 'move', from: 'S', to: 'C' })).toThrow(/illegal/);
    });

    it('rejects sliding through an occupied vertex', () => {
        const s = makeState({
            board: { S: 1, C: 2, W: 2, N: null, E: null },
            placed: { 1: 1, 2: 2 }
        });
        expect(() => applyMove(CFG, s, { kind: 'move', from: 'S', to: 'N' })).toThrow(/illegal/);
    });

    it('continues the game when the mover leaves an escape', () => {
        let s = initialState(CFG, 'well');
        for (const to of ['C', 'S', 'N', 'W']) {
            s = applyMove(CFG, s, { kind: 'place', to });
        }
        expect(s.phase).toBe('movement');
        s = applyMove(CFG, s, { kind: 'move', from: 'C', to: 'E' });
        expect(s.phase).toBe('movement');
        expect(s.current).toBe(2);
        expect(s.winner).toBeNull();
    });
});

describe('state integrity', () => {
    it('legalMoves of a gameover state is empty', () => {
        const s = makeState({
            board: { C: 1, N: 1, E: null, S: 2, W: 2 },
            phase: 'gameover',
            winner: 1,
            current: 2
        });
        expect(legalMoves(CFG, s)).toEqual([]);
    });

    it('applyMove does not mutate the input state', () => {
        const s = makeState({ board: { E: 1, N: 1, S: 2, W: 2, C: null } });
        const snapshot = structuredClone(s);
        applyMove(CFG, s, { kind: 'move', from: 'E', to: 'C' });
        expect(s).toEqual(snapshot);
    });
});
