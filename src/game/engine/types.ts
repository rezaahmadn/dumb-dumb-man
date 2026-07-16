//  engine/ imports NOTHING outside engine/ (no phaser, no react, no modes/).
//  These types are normative — defined in .claude/PRPs/prds/pebble-trap.prd.md.

export type VertexId = string;
export type PlayerId = 1 | 2;
export type Phase = 'placement' | 'movement' | 'gameover';

export interface BoardDef {
    vertices: { id: VertexId; x: number; y: number }[];
    lines: VertexId[][];
}

export interface EngineConfig {
    board: BoardDef;
    pebblesPerPlayer: number;
    repetitionLimit?: number;
    movement?: 'slide' | 'step' | 'skip' | 'draughts';
    win?: 'trap' | 'alignment' | 'elimination';
    //  Pre-seeded pebbles, keyed by player. When present, initialState skips
    //  the placement phase entirely and opens in 'movement'. Every id must
    //  exist in board.vertices and appear at most once across both players.
    preplaced?: Record<PlayerId, VertexId[]>;
    //  A player reduced to this many pebbles or fewer may move long-range
    //  ("flying"). Consulted ONLY by the 'draughts' branch (Phase 3). Default 3.
    flyingThreshold?: number;
}

export interface GameState {
    modeId: string;
    phase: Phase;
    board: Record<VertexId, PlayerId | null>;
    current: PlayerId;
    placed: Record<PlayerId, number>;
    winner: PlayerId | null;
    history?: Record<string, number>;
}

//  A jump is ONE turn, not one hop: `hops` is the ordered chain the pebble
//  takes. Each hop names the vertex captured (`over`) and the vertex landed
//  on (`to`). The mover leaves `from` and ends on the LAST hop's `to`; every
//  `over` is removed. hops.length >= 1. Chain enumeration lands in Phase 3.
export type Move =
    | { kind: 'place'; to: VertexId }
    | { kind: 'move'; from: VertexId; to: VertexId }
    | { kind: 'jump'; from: VertexId; hops: { over: VertexId; to: VertexId }[] }
    | { kind: 'pass' };
