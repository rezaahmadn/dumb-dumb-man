//  Board data + mode registry — the '@pebble/engine/modes' entry.
//  Separate from the root entry so a rules-only consumer skips board geometry.

export { MODES } from './registry';
export { CLASH_MODE } from './clash';
export { MORRIS_MODE } from './morris';
export { WELL_MODE } from './well';
export type { GameModeDef, Stroke } from './types';
