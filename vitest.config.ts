import { defineConfig } from 'vitest/config';

//  Standalone config on purpose: the template's vite configs live at
//  vite/config.*.mjs and are not auto-discovered by vitest. Engine tests
//  are pure TS — node environment, no react plugin, no jsdom.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/game/engine/**/*.test.ts']
    }
});
