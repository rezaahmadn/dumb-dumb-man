import type { GameModeDef } from '../types';

//  Mode 2: "Three-in-a-Row" — Three Men's Morris / Tapatan. 3x3 grid: square +
//  inner cross + both diagonals, all crossing at the centre. Alignment win,
//  single-step movement. See .claude/PRPs/prds/three-in-a-row.prd.md.
export const MORRIS_MODE: GameModeDef = {
    id: 'morris',
    name: 'Three-in-a-Row',
    engine: {
        pebblesPerPlayer: 3,
        repetitionLimit: 3,
        movement: 'step',
        win: 'alignment',
        board: {
            vertices: [
                { id: 'TL', x: 90, y: 290 }, { id: 'T', x: 360, y: 290 }, { id: 'TR', x: 630, y: 290 },
                { id: 'L', x: 90, y: 560 }, { id: 'C', x: 360, y: 560 }, { id: 'R', x: 630, y: 560 },
                { id: 'BL', x: 90, y: 830 }, { id: 'B', x: 360, y: 830 }, { id: 'BR', x: 630, y: 830 }
            ],
            lines: [
                ['TL', 'T', 'TR'], ['L', 'C', 'R'], ['BL', 'B', 'BR'],
                ['TL', 'L', 'BL'], ['T', 'C', 'B'], ['TR', 'R', 'BR'],
                ['TL', 'C', 'BR'], ['TR', 'C', 'BL']
            ]
        }
    },
    boardStrokes: [
        //  square sides
        { kind: 'segment', from: 'TL', to: 'TR' },
        { kind: 'segment', from: 'BL', to: 'BR' },
        { kind: 'segment', from: 'TL', to: 'BL' },
        { kind: 'segment', from: 'TR', to: 'BR' },
        //  inner cross
        { kind: 'segment', from: 'L', to: 'R' },
        { kind: 'segment', from: 'T', to: 'B' },
        //  diagonals
        { kind: 'segment', from: 'TL', to: 'BR' },
        { kind: 'segment', from: 'TR', to: 'BL' }
    ]
};
