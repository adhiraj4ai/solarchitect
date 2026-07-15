import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
    // @tldraw/assets/imports.vite resolves icon/font URLs via Vite's ?url asset
    // handling; letting Vite pre-bundle it into .vite/deps breaks that in dev
    // (getAssetUrlsByImport throws on undefined). Excluding it fixes the dev
    // renderer; the production build is unaffected.
    optimizeDeps: {
      exclude: ['@tldraw/assets'],
    },
    plugins: [react()],
  },
});
