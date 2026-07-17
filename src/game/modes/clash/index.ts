import type { GameModeDef } from '../types';

//  Mode 3: "Pebble Clash" — traditional Sixteen Soldiers board (5x5
//  Alquerque grid + triangular wing top and bottom). 16 pebbles/side,
//  pre-placed, centre row empty. Jump-to-eliminate, chained captures,
//  flying at <=3 pebbles. See .claude/PRPs/prds/pebble-clash.prd.md
//  "Board Geometry" for the full derivation of every coordinate below.
export const CLASH_MODE: GameModeDef = {
    id: 'clash',
    name: 'Dumb Dumb Man',
    engine: {
        pebblesPerPlayer: 16,
        movement: 'draughts',
        win: 'elimination',
        flyingThreshold: 3,
        preplaced: {
            2: [
                'tb0', 'tb1', 'tb2', 'tc0', 'tc1', 'tc2',
                'g00', 'g01', 'g02', 'g03', 'g04',
                'g10', 'g11', 'g12', 'g13', 'g14'
            ],
            1: [
                'bb0', 'bb1', 'bb2', 'bc0', 'bc1', 'bc2',
                'g30', 'g31', 'g32', 'g33', 'g34',
                'g40', 'g41', 'g42', 'g43', 'g44'
            ]
        },
        board: {
            vertices: [
                { id: 'tb0', x: 90, y: 100 }, { id: 'tb1', x: 360, y: 100 }, { id: 'tb2', x: 630, y: 100 },
                { id: 'tc0', x: 225, y: 235 }, { id: 'tc1', x: 360, y: 235 }, { id: 'tc2', x: 495, y: 235 },
                { id: 'g00', x: 90, y: 370 }, { id: 'g01', x: 225, y: 370 }, { id: 'g02', x: 360, y: 370 },
                { id: 'g03', x: 495, y: 370 }, { id: 'g04', x: 630, y: 370 },
                { id: 'g10', x: 90, y: 505 }, { id: 'g11', x: 225, y: 505 }, { id: 'g12', x: 360, y: 505 },
                { id: 'g13', x: 495, y: 505 }, { id: 'g14', x: 630, y: 505 },
                { id: 'g20', x: 90, y: 640 }, { id: 'g21', x: 225, y: 640 }, { id: 'g22', x: 360, y: 640 },
                { id: 'g23', x: 495, y: 640 }, { id: 'g24', x: 630, y: 640 },
                { id: 'g30', x: 90, y: 775 }, { id: 'g31', x: 225, y: 775 }, { id: 'g32', x: 360, y: 775 },
                { id: 'g33', x: 495, y: 775 }, { id: 'g34', x: 630, y: 775 },
                { id: 'g40', x: 90, y: 910 }, { id: 'g41', x: 225, y: 910 }, { id: 'g42', x: 360, y: 910 },
                { id: 'g43', x: 495, y: 910 }, { id: 'g44', x: 630, y: 910 },
                { id: 'bc0', x: 225, y: 1045 }, { id: 'bc1', x: 360, y: 1045 }, { id: 'bc2', x: 495, y: 1045 },
                { id: 'bb0', x: 90, y: 1180 }, { id: 'bb1', x: 360, y: 1180 }, { id: 'bb2', x: 630, y: 1180 }
            ],
            lines: [
                ['g00', 'g01', 'g02', 'g03', 'g04'],
                ['g10', 'g11', 'g12', 'g13', 'g14'],
                ['g20', 'g21', 'g22', 'g23', 'g24'],
                ['g30', 'g31', 'g32', 'g33', 'g34'],
                ['g40', 'g41', 'g42', 'g43', 'g44'],
                ['g00', 'g10', 'g20', 'g30', 'g40'],
                ['g01', 'g11', 'g21', 'g31', 'g41'],
                ['tb1', 'tc1', 'g02', 'g12', 'g22', 'g32', 'g42', 'bc1', 'bb1'],
                ['g03', 'g13', 'g23', 'g33', 'g43'],
                ['g04', 'g14', 'g24', 'g34', 'g44'],
                ['g00', 'g11', 'g22', 'g33', 'g44'],
                ['g04', 'g13', 'g22', 'g31', 'g40'],
                //  Apex diagonals — g02 and g42 are convergence points, not
                //  endpoints. Each pair below is ONE straight, evenly-spaced
                //  line (verified against vertex coordinates); previously
                //  mis-transcribed as two lines terminating at the apex,
                //  which silently blocked every jump that should pass
                //  through the apex to the wing (or vice versa).
                ['tb2', 'tc2', 'g02', 'g11', 'g20'],
                ['tb0', 'tc0', 'g02', 'g13', 'g24'],
                ['g20', 'g31', 'g42', 'bc2', 'bb2'],
                ['bb0', 'bc0', 'g42', 'g33', 'g24'],
                ['tb0', 'tb1', 'tb2'],
                ['tc0', 'tc1', 'tc2'],
                ['bb0', 'bb1', 'bb2'],
                ['bc0', 'bc1', 'bc2']
            ]
        }
    },
    //  One straight segment per line — every Pebble Clash line is straight.
    boardStrokes: [
        { kind: 'segment', from: 'g00', to: 'g04' },
        { kind: 'segment', from: 'g10', to: 'g14' },
        { kind: 'segment', from: 'g20', to: 'g24' },
        { kind: 'segment', from: 'g30', to: 'g34' },
        { kind: 'segment', from: 'g40', to: 'g44' },
        { kind: 'segment', from: 'g00', to: 'g40' },
        { kind: 'segment', from: 'g01', to: 'g41' },
        { kind: 'segment', from: 'tb1', to: 'bb1' },
        { kind: 'segment', from: 'g03', to: 'g43' },
        { kind: 'segment', from: 'g04', to: 'g44' },
        { kind: 'segment', from: 'g00', to: 'g44' },
        { kind: 'segment', from: 'g04', to: 'g40' },
        { kind: 'segment', from: 'g02', to: 'g20' },
        { kind: 'segment', from: 'g02', to: 'g24' },
        { kind: 'segment', from: 'g20', to: 'g42' },
        { kind: 'segment', from: 'g24', to: 'g42' },
        { kind: 'segment', from: 'tb0', to: 'tb2' },
        { kind: 'segment', from: 'tc0', to: 'tc2' },
        { kind: 'segment', from: 'tb0', to: 'g02' },
        { kind: 'segment', from: 'tb2', to: 'g02' },
        { kind: 'segment', from: 'bb0', to: 'bb2' },
        { kind: 'segment', from: 'bc0', to: 'bc2' },
        { kind: 'segment', from: 'bb0', to: 'g42' },
        { kind: 'segment', from: 'bb2', to: 'g42' }
    ]
};
