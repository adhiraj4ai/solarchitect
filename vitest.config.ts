import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // src/shared: pure core-engine seam. src/main: pure Node fs logic
    // (projectManager) — these tests must not import electron.
    include: ['src/shared/**/*.test.ts', 'src/main/**/*.test.ts'],
    environment: 'node',
  },
});
