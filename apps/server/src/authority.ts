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
