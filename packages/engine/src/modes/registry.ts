import type { GameModeDef } from './types';
import { CLASH_MODE } from './clash';
import { MORRIS_MODE } from './morris';
import { WELL_MODE } from './well';

export const MODES: Record<string, GameModeDef> = {
    [WELL_MODE.id]: WELL_MODE,
    [MORRIS_MODE.id]: MORRIS_MODE,
    [CLASH_MODE.id]: CLASH_MODE
};
