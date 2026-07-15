/** The Solarchitect mark: a dashed cluster holding one filled and one outlined
 *  node joined by an edge — the product in miniature. */
export function Wordmark() {
  return (
    <span className="brand" aria-label="Solarchitect">
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="19" height="19" rx="4" stroke="var(--blueprint)" strokeWidth="1.5" strokeDasharray="3 2.4" />
        <rect x="5" y="8.5" width="5" height="5" rx="1.3" fill="var(--blueprint)" />
        <rect x="12" y="8.5" width="5" height="5" rx="1.3" stroke="var(--blueprint)" strokeWidth="1.4" />
        <line x1="10" y1="11" x2="12" y2="11" stroke="var(--blueprint)" strokeWidth="1.4" />
      </svg>
      <span>sol<b>architect</b></span>
    </span>
  );
}
