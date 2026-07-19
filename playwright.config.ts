import { defineConfig } from '@playwright/test';

// E2E smoke seam: drives the real built Electron app. Build (`npm run build`)
// must run before these tests so out/main/index.js exists.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  // The suite drives a real Electron app under a virtual display in CI, where
  // rAF-driven animation timing is occasionally slow enough to miss a poll.
  // Retry in CI so a single timing miss is reported as flaky, not a failure.
  retries: process.env.CI ? 2 : 0,
});
