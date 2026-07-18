import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

//  Structural guard, not a style rule. applyMoveForSeat is the only place the
//  turn check lives (see src/authority.ts). If handler code can reach past it
//  to the engine's raw applyMove, the check is bypassable and the server's
//  anti-cheat guarantee is void. A prose warning would not survive a
//  refactor; a failing test does.
const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            //  Tests are exempt: they legitimately reference the engine.
            if (entry.name === '__tests__') continue;
            out.push(...sourceFiles(join(dir, entry.name)));
            continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        //  authority.ts is the one file allowed to call applyMove.
        if (entry.name === 'authority.ts') continue;
        out.push(join(dir, entry.name));
    }
    return out;
}

describe('A2 authority is the sole mutator', () => {
    //  Without this, an empty or mis-pointed scan makes the assertion below
    //  pass by finding nothing -- the same vacuous-green failure this whole
    //  phase is built to prevent.
    it('actually finds source files to scan', () => {
        expect(sourceFiles(SRC).length).toBeGreaterThan(0);
    });

    it('no file outside authority.ts references the engine applyMove', () => {
        //  \b...\b does NOT match applyMoveForSeat: 'e' and 'F' are both word
        //  characters, so there is no boundary between them. This matches the
        //  raw engine call and nothing else.
        const offenders = sourceFiles(SRC).filter((file) =>
            /\bapplyMove\b/.test(readFileSync(file, 'utf8'))
        );
        expect(offenders).toEqual([]);
    });
});
