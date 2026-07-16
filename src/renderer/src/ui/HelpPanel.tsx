import { Wordmark } from './Wordmark';

/** App version — kept in step with package.json's version. */
const APP_VERSION = '0.1.0';

const SHORTCUTS: [string, string][] = [
  ['⌘Z / Ctrl+Z', 'Undo'],
  ['⌘⇧Z / Ctrl+Y', 'Redo'],
  ['⌘B / Ctrl+B', 'Toggle sidebar'],
  ['Esc', 'Exit presentation'],
  ['← →', 'Step through pages while presenting'],
];

/** Static reference: keyboard shortcuts, version, and links to the design docs. */
export function HelpPanel() {
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="eyebrow">Help</span>
      </div>
      <div className="panel__body help">
        <div className="help__brand">
          <Wordmark />
          <span className="help__version" data-testid="help-version">
            v{APP_VERSION}
          </span>
        </div>

        <div className="help__section">Keyboard shortcuts</div>
        <ul className="help__keys">
          {SHORTCUTS.map(([keys, what]) => (
            <li key={keys}>
              <kbd>{keys}</kbd>
              <span>{what}</span>
            </li>
          ))}
        </ul>

        <div className="help__section">Documentation</div>
        <ul className="help__docs">
          <li>docs/superpowers/specs/2026-07-15-solarchitect-design.md</li>
          <li>docs/superpowers/specs/2026-07-16-whiteboard-diagram-separation-design.md</li>
        </ul>
      </div>
    </div>
  );
}
