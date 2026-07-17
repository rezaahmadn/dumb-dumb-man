import type { PlayerId } from '@pebble/engine';

export const THEME = {
    background: 0x111418,
    boardLine: 0xe8e2d0,
    boardLineWidth: 6,
    vertexDot: 0xe8e2d0,
    pebble: { 1: 0xe53935, 2: 0x1e88e5 },
    pebbleRadius: 34,
    vertexRadius: 12,
    //  Must stay below half the tightest vertex spacing across all modes
    //  (Pebble Clash grid cells are 135px apart) or adjacent tap/pebble hit
    //  circles overlap and steal taps meant for the neighbour.
    tapRadius: 60,
    moveTweenMs: 200,
    highlightColor: 0xffffff,
    //  Distinct from highlightColor so a jump landing reads as visually
    //  different from a quiet destination.
    jumpHighlightColor: 0xffb300,
    aiMoveDelayMs: 400
} as const;

export const PLAYER_NAME: Record<PlayerId, string> = { 1: 'Red', 2: 'Blue' };
export const PLAYER_COLOR_CSS: Record<PlayerId, string> = { 1: '#e53935', 2: '#1e88e5' };
