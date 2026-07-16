// Minimal typings for gifenc (ships no declarations). Covers the subset used
// by captureAnimation.ts.
declare module 'gifenc' {
  export interface WriteFrameOpts {
    palette?: number[][];
    /** Frame delay in milliseconds. */
    delay?: number;
    /** Loop count on the first frame: 0 = forever, -1 = play once. */
    repeat?: number;
    transparent?: boolean;
    dispose?: number;
  }
  export interface GifEncoderInstance {
    writeFrame(index: Uint8Array | number[], width: number, height: number, opts?: WriteFrameOpts): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(): GifEncoderInstance;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: unknown): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;
}
