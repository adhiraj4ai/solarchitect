import type { AccentColor } from '@shared/ir/types';

/** Solid hex for each accent color (used to tint node icons the user colors). */
export const ACCENT_HEX: Record<AccentColor, string> = {
  blueprint: '#2b57c6',
  slate: '#5a6675',
  green: '#2f8a5b',
  amber: '#d9822b',
  violet: '#6d3bcc',
  red: '#c0392f',
};

/** Very light background tint of each accent, for the node icon chip. */
export const ACCENT_TINT: Record<AccentColor, string> = {
  blueprint: 'rgba(43,87,198,0.12)',
  slate: 'rgba(90,102,117,0.12)',
  green: 'rgba(47,138,91,0.12)',
  amber: 'rgba(217,130,43,0.14)',
  violet: 'rgba(109,59,204,0.12)',
  red: 'rgba(192,57,47,0.11)',
};
