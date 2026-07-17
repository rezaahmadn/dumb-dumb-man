import { defineConfig } from 'vitest/config';

//  Engine tests are pure TS — node environment, no react plugin, no jsdom.
//  include is src/**, not src/engine/** : the previous root-level config
//  globbed only the engine dir, so modes/__tests__/clash-board.test.ts
//  silently never ran. Keep this glob broad enough to catch every package test.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts']
    }
});
