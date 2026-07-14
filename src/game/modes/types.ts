import type { EngineConfig, VertexId } from '../engine/types';

//  Declarative board drawing — BoardScene renders ONLY these strokes,
//  so a new mode is data, never scene code.
//  arc: clockwise, screen coords (y down): 0°=E, 90°=S, 180°=W, 270°=N.
export type Stroke =
    | { kind: 'segment'; from: VertexId; to: VertexId }
    | { kind: 'arc'; cx: number; cy: number; radius: number; startDeg: number; endDeg: number };

export interface GameModeDef {
    id: string;
    name: string;
    engine: EngineConfig;
    boardStrokes: Stroke[];
}
