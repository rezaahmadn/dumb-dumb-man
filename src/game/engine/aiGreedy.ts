//  engine/ imports NOTHING outside engine/ (no phaser, no react, no modes/).
//  Deliberately independent of ai.ts / solveMovementGraph: that solver
//  enumerates every board layout (kCombinations over all vertices) and is
//  combinatorially infeasible above a handful of pebbles per side. This file
//  must NEVER import solveMovementGraph — a guard test in aiGreedy.test.ts
//  asserts that statically.
import { applyMove, legalMoves, pebbleCount } from './rules';
import type { EngineConfig, GameState, Move, PlayerId } from './types';

function opponentOf(p: PlayerId): PlayerId {
    return p === 1 ? 2 : 1;
}

//  Capture count of a move: hop count for a jump, 0 otherwise. Chains are
//  already enumerated maximal by legalMoves (Phase 3).
function captureCount(m: Move): number {
    return m.kind === 'jump' ? m.hops.length : 0;
}

//  One-ply score: captures dominate (weight 1000) over material (10) over
//  opponent mobility (1), so no combination of the latter two can ever
//  outweigh one extra capture — matches "AI takes available capture: 100%"
//  from the PRD's Success Metrics.
function scoreMove(cfg: EngineConfig, s: GameState, m: Move): number {
    const captures = captureCount(m);
    const child = applyMove(cfg, s, m);
    const material = pebbleCount(child.board, s.current) - pebbleCount(child.board, opponentOf(s.current));
    //  legalMoves on a gameover state returns [] (rules.ts), so this is 0
    //  when the move just won the game — correct value for "no replies".
    const opponentMobility = child.phase === 'gameover' ? 0 : legalMoves(cfg, child).length;
    return captures * 1000 + material * 10 - opponentMobility;
}

//  Deterministic, no RNG: iterates legalMoves in its own fixed order, keeps
//  the FIRST max-scoring move (strict '>'), mirroring chooseMove's tie-break
//  in ai.ts.
export function chooseMoveGreedy(cfg: EngineConfig, s: GameState): Move {
    const moves = legalMoves(cfg, s);
    let best = moves[0];
    let bestScore = -Infinity;
    for (const m of moves) {
        const score = scoreMove(cfg, s, m);
        if (score > bestScore) {
            bestScore = score;
            best = m;
        }
    }
    return best;
}
