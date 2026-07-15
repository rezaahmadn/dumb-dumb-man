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

export type Move =
    | { kind: 'place'; to: VertexId }
    | { kind: 'move'; from: VertexId; to: VertexId };
