import type { GameModeDef } from '../types';

//  Mode 1: "Well Board" — umul gonu style. Circle + cross with the S-E arc
//  missing. The gap is load-bearing: with a full circle no trap is possible
//  (see PRD Trap Math). Never "fix" the rim line into a cycle.
export const WELL_MODE: GameModeDef = {
    id: 'well',
    name: 'Well Board',
    engine: {
        pebblesPerPlayer: 2,
        board: {
            vertices: [
                { id: 'C', x: 360, y: 560 },
                { id: 'N', x: 360, y: 290 },
                { id: 'E', x: 630, y: 560 },
                { id: 'S', x: 360, y: 830 },
                { id: 'W', x: 90, y: 560 }
            ],
            lines: [
                ['N', 'C', 'S'],
                ['W', 'C', 'E'],
                ['E', 'N', 'W', 'S']
            ]
        }
    },
    boardStrokes: [
        { kind: 'segment', from: 'N', to: 'S' },
        { kind: 'segment', from: 'W', to: 'E' },
        { kind: 'arc', cx: 360, cy: 560, radius: 270, startDeg: 90, endDeg: 360 }
    ]
};
