//  Public surface of @pebble/engine.
//
//  Everything here is pure TypeScript with zero runtime dependencies — it is
//  imported today by apps/web, and is the shared rule source an authoritative
//  server would import so both sides agree on what a legal move is.
//  Board data lives behind the './modes' entry, so a consumer that only needs
//  rules never pulls in board geometry.

export { adjacency, edgesFromLines } from './board';
export { alignedPlayer, applyMove, initialState, legalMoves, pebbleCount } from './rules';
export { chooseMove, positionKey, solveMovementGraph } from './ai';
export type { Label, Score } from './ai';
export { chooseMoveGreedy } from './aiGreedy';
export type {
    BoardDef,
    EngineConfig,
    GameState,
    Move,
    Phase,
    PlayerId,
    VertexId
} from './types';
