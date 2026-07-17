import { describe, expect, it } from 'vitest';
import { WELL_MODE } from '../modes/well';
import { applyMove, initialState, legalMoves } from '../rules';
import { chooseMove, solveMovementGraph } from '../ai';
import type { GameState, Move } from '../types';

const CFG = WELL_MODE.engine;

const sameMove = (a: Move, b: Move): boolean =>
    a.kind === b.kind &&
    (a.kind === 'place' && b.kind === 'place'
        ? a.to === b.to
        : a.kind === 'move' && b.kind === 'move'
          ? a.from === b.from && a.to === b.to
          : false);

describe('T-AI1 solved movement graph', () => {
    it('labels exactly 56 live nodes as {WIN:8, LOSS:0, DRAW:48}', () => {
        const labels = solveMovementGraph(CFG);
        expect(labels.size).toBe(56);

        const tally = { WIN: 0, LOSS: 0, DRAW: 0 };
        for (const label of labels.values()) tally[label]++;
        expect(tally).toEqual({ WIN: 8, LOSS: 0, DRAW: 48 });
    });
});

describe('T-AI2 chooseMove always returns a legal move', () => {
    it('every chosen move is legal at the moment it is chosen', () => {
        let s: GameState = initialState(CFG, 'well');
        for (let ply = 0; ply < 200 && s.phase !== 'gameover'; ply++) {
            const chosen = chooseMove(CFG, s);
            expect(legalMoves(CFG, s).some((lm) => sameMove(lm, chosen))).toBe(true);
            s = applyMove(CFG, s, chosen);
        }
    });
});

describe('T-AI3 self-play always ends in a draw', () => {
    it('optimal play from both sides reaches gameover with winner null within 200 plies', () => {
        let s: GameState = initialState(CFG, 'well');
        let plies = 0;
        while (s.phase !== 'gameover' && plies < 200) {
            const chosen = chooseMove(CFG, s);
            s = applyMove(CFG, s, chosen);
            plies++;
        }
        expect(s.phase).toBe('gameover');
        expect(s.winner).toBeNull();
    });
});

describe('T-AI4 deterministic', () => {
    it('returns the same move for two deep-equal fixtures', () => {
        const s1 = initialState(CFG, 'well');
        const s2 = initialState(CFG, 'well');
        expect(chooseMove(CFG, s1)).toEqual(chooseMove(CFG, s2));
    });
});
