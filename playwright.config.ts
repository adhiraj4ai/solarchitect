import { defineConfig } from '@playwright/test';

// E2E smoke seam: drives the real built Electron app. Build (`npm run build`)
// must run before these tests so out/main/index.js exists.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
});
