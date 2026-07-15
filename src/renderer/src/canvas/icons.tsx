import type { ReactElement } from 'react';
import { NODE_TAXONOMY, type Provider } from '@shared/ir/taxonomy';

/** Brand-ish accent per provider — the one place vendor color enters the app. */
export const PROVIDER_COLOR: Record<Provider, string> = {
  aws: '#E8871E',
  azure: '#1275C6',
  gcp: '#1A73E8',
  kubernetes: '#3660C4',
  generic: '#5A6675',
};

export const PROVIDER_TINT: Record<Provider, string> = {
  aws: 'rgba(232, 135, 30, 0.12)',
  azure: 'rgba(18, 117, 198, 0.12)',
  gcp: 'rgba(26, 115, 232, 0.12)',
  kubernetes: 'rgba(54, 96, 196, 0.12)',
  generic: 'rgba(90, 102, 117, 0.12)',
};

// Recognizable line-art for the architecture vocabulary. Original glyphs (not
// the vendors' copyrighted assets), tinted by provider so a node reads at a
// glance the way it does in a `diagrams` drawing.
const GLYPHS: Record<string, ReactElement> = {
  server: (
    <>
      <rect x="4" y="4" width="16" height="7" rx="1.6" />
      <rect x="4" y="13" width="16" height="7" rx="1.6" />
      <circle cx="7.4" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="7.4" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  function: (
    <>
      <path d="M7 20 L13 4" />
      <path d="M10.6 12 L16 20" />
      <path d="M11 4 h2.4" />
    </>
  ),
  container: (
    <>
      <path d="M12 3.5l7.5 4v9L12 20.5 4.5 16.5v-9z" />
      <path d="M4.5 7.5l7.5 4 7.5-4" />
      <path d="M12 11.5v9" />
    </>
  ),
  kubernetes: (
    <>
      <path d="M12 3l7.8 4.5v9L12 21 4.2 16.5v-9z" />
      <circle cx="12" cy="12" r="2.3" />
      <path d="M12 5.6V9.7M6.3 8.9l3.6 2M17.7 8.9l-3.6 2M8.2 16.8l1.7-2.9M15.8 16.8l-1.7-2.9" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.6 3.1 3 7 3s7-1.4 7-3V6" />
      <path d="M5 12c0 1.6 3.1 3 7 3s7-1.4 7-3" />
    </>
  ),
  nosql: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.6" />
      <path d="M5 6v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" />
      <path d="M5 11v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4" />
    </>
  ),
  cache: <path d="M13 3 L5 13 h6 l-1 8 L19 10 h-6 z" />,
  bucket: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.4" />
      <path d="M5 6 l1.4 13.4a1 1 0 0 0 1 .9h9.2a1 1 0 0 0 1-.9L19 6" />
    </>
  ),
  loadbalancer: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="5.5" r="2" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="18" cy="18.5" r="2" />
      <path d="M8.4 11 L16 6.2M8.5 12 H16M8.4 13 L16 17.8" />
    </>
  ),
  cdn: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.8c3 2.6 3 13.8 0 16.4M12 3.8c-3 2.6-3 13.8 0 16.4" />
    </>
  ),
  internet: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.8c3 2.6 3 13.8 0 16.4M12 3.8c-3 2.6-3 13.8 0 16.4" />
    </>
  ),
  dns: (
    <>
      <rect x="3" y="8.5" width="18" height="7" rx="1.6" />
      <circle cx="7" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M11 12h7" />
    </>
  ),
  gateway: (
    <>
      <path d="M5 20V10a7 7 0 0 1 14 0v10" />
      <path d="M3.5 20h17" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  queue: (
    <>
      <rect x="5" y="4.5" width="14" height="4" rx="1.2" />
      <rect x="5" y="10" width="14" height="4" rx="1.2" />
      <rect x="5" y="15.5" width="14" height="4" rx="1.2" />
    </>
  ),
  identity: (
    <>
      <circle cx="8.5" cy="8.5" r="4" />
      <path d="M11.3 11.3 L20 20M16.5 16.5l2-2" />
    </>
  ),
  vm: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M3 8h18" />
      <path d="M8.5 20h7M12 16v4" />
    </>
  ),
  app: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <circle cx="6" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="8.6" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20h16M4 20V4" />
      <rect x="7" y="11" width="3" height="6" rx="0.6" />
      <rect x="12" y="7" width="3" height="10" rx="0.6" />
      <rect x="16.6" y="13" width="3" height="4" rx="0.6" />
    </>
  ),
  pod: (
    <>
      <path d="M12 3l7.8 4.5v9L12 21 4.2 16.5v-9z" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
    </>
  ),
  deployment: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15V5h10" />
    </>
  ),
  volume: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <circle cx="16.5" cy="12" r="1.5" />
      <path d="M6 12h5" />
    </>
  ),
  config: (
    <>
      <path d="M4 7h9M17 7h3M4 12h5M13 12h7M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="11" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  firewall: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 9.7h18M3 14.3h18" />
      <path d="M10 5v4.7M15 5v4.7M7 9.7v4.6M13 9.7v4.6M18 9.7v4.6M10 14.3V19M15 14.3V19" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c0-4.2 3.4-6.8 7.5-6.8s7.5 2.6 7.5 6.8" />
    </>
  ),
  client: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
      <circle cx="6" cy="7" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="8.4" cy="7" r="0.7" fill="currentColor" stroke="none" />
    </>
  ),
  mobile: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.6" />
      <path d="M10.5 18h3" />
    </>
  ),
  vpc: <path d="M7 18h10a4 4 0 0 0 .5-8 5 5 0 0 0-9.6-1.4A3.5 3.5 0 0 0 7 18z" />,
  gauge: (
    <>
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M12 15l4.5-3.2" />
      <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  chip: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  hub: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="4.2" r="1.6" />
      <circle cx="12" cy="19.8" r="1.6" />
      <circle cx="4.6" cy="8" r="1.6" />
      <circle cx="19.4" cy="8" r="1.6" />
      <path d="M12 6.5v3M12 14.5v3.7M6.1 8.9l3.7 2.1M17.9 8.9l-3.7 2.1" />
    </>
  ),
  steps: <path d="M4 19h4v-4h4v-4h4v-4h4" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3.4 2" />
    </>
  ),
  namespace: (
    <path d="M8 4H6.5A2.5 2.5 0 0 0 4 6.5V10l-1.5 2L4 14v3.5A2.5 2.5 0 0 0 6.5 20H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V10l1.5 2L20 14v3.5a2.5 2.5 0 0 1-2.5 2.5H16" />
  ),
  registry: (
    <>
      <rect x="4" y="4" width="16" height="5" rx="1.4" />
      <rect x="4" y="10" width="16" height="5" rx="1.4" />
      <rect x="4" y="16" width="16" height="4" rx="1.4" />
      <circle cx="7.4" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
};

const DEF_BY_ID = new Map(NODE_TAXONOMY.map((d) => [d.id, d]));

/** Provider-colored glyph for a node type. */
export function NodeIcon({ type, size = 20 }: { type: string; size?: number }) {
  const def = DEF_BY_ID.get(type);
  const color = def ? PROVIDER_COLOR[def.provider] : PROVIDER_COLOR.generic;
  const glyph = (def && GLYPHS[def.glyph]) || GLYPHS.server;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color, display: 'block' }}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}
