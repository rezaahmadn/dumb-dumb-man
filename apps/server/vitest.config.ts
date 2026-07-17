import { defineConfig } from 'vitest/config';

//  Mirrors packages/engine/vitest.config.ts. Server tests are pure TS — node
//  environment, no jsdom. Keep `include` broad (src/**, not src/foo/**): the
//  engine's config carries a comment about a previous glob that was too
//  narrow and made a whole test file silently never run. Same trap here.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts']
    }
});
