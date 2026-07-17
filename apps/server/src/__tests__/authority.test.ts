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
