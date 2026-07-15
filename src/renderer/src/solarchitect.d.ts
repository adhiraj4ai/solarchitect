import type { SolarchitectApi } from '@shared/project/types';

// window.solarchitect is provided by the preload bridge (src/preload/index.ts),
// typed against the same shared SolarchitectApi so the two stay in sync.
declare global {
  interface Window {
    solarchitect: SolarchitectApi;
  }
}
