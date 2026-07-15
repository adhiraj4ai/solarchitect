/** Prebuilt frame sizes, in canvas pixels at 96 DPI (so print sizes map 1:1 to
 *  screen). Custom frames use preset 'custom' and are sized by resizing. */
export interface FramePreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const FRAME_PRESETS: FramePreset[] = [
  { id: 'a4-portrait', label: 'A4 Portrait', width: 794, height: 1123 },
  { id: 'a4-landscape', label: 'A4 Landscape', width: 1123, height: 794 },
  { id: 'letter-portrait', label: 'Letter Portrait', width: 816, height: 1056 },
  { id: 'letter-landscape', label: 'Letter Landscape', width: 1056, height: 816 },
  { id: 'a3-landscape', label: 'A3 Landscape', width: 1587, height: 1123 },
  { id: 'slide-16-9', label: 'Slide 16:9', width: 1280, height: 720 },
  { id: 'slide-4-3', label: 'Slide 4:3', width: 1024, height: 768 },
];

export const CUSTOM_FRAME = { width: 800, height: 600 };
