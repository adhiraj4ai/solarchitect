import { panelsForType, type PanelId } from '@shared/shell/panels';
import { DOCUMENT_TYPE_LABEL, type DocumentType } from '@shared/project/documentType';

/**
 * The far-left icon strip. A read-only badge for the open document's type sits at
 * the top, then the panel icons available on that type in the middle, and utility
 * icons (Settings, Help) anchored to the bottom. The document's type fixes the
 * editor, so there is no surface switching here. Selecting a panel is delegated
 * up; selecting the active one collapses the sidebar (handled by the layout hook).
 */

function Icon({ name }: { name: PanelId | DocumentType }) {
  const p = ICONS[name];
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  );
}

const ICONS: Record<PanelId | DocumentType, JSX.Element> = {
  diagram: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="8.5" y="14" width="7" height="7" rx="1" />
      <path d="M6.5 10v2.5h11V10M12 12.5V14" />
    </>
  ),
  whiteboard: (
    <>
      <path d="M4 5h16v11H4z" />
      <path d="M9 20l3-4 3 4" />
      <path d="M8 9l2.5 2.5L16 6" />
    </>
  ),
  markdown: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M7 15V9l2.5 2.5L12 9v6M15.5 9v4.5M15.5 13.5L14 12M15.5 13.5L17 12" />
    </>
  ),
  project: (
    <>
      <path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  outline: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>
  ),
  shapes: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <circle cx="16.5" cy="7.5" r="3.5" />
      <path d="M7.5 14l3.5 6H4z" />
      <rect x="13" y="14" width="7" height="6" rx="1" />
    </>
  ),
  templates: (
    <>
      <path d="M7 4h10v16l-5-3.5L7 20z" />
    </>
  ),
  animations: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
    </>
  ),
  git: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="9" r="2.4" />
      <path d="M6 8.4v7.2M8.2 7.4C13 8 15.6 8.8 15.6 11.2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.3" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </>
  ),
};

export function ActivityBar({
  documentType,
  activePanel,
  collapsed,
  onSelectPanel,
}: {
  documentType: DocumentType | null;
  activePanel: PanelId;
  collapsed: boolean;
  onSelectPanel: (p: PanelId) => void;
}) {
  // With no document open, fall back to the diagram panel set so the bar isn't empty.
  const panels = panelsForType(documentType ?? 'diagram');
  const primary = panels.filter((p) => p.group === 'primary');
  const utility = panels.filter((p) => p.group === 'utility');

  const panelButton = (id: PanelId, label: string) => {
    const selected = activePanel === id && !collapsed;
    return (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={selected}
        data-testid={`activity-${id}`}
        className={`actbar__btn${selected ? ' on' : ''}`}
        title={label}
        aria-label={label}
        onClick={() => onSelectPanel(id)}
      >
        <Icon name={id} />
      </button>
    );
  };

  return (
    <nav className="actbar" role="tablist" aria-label="Activity bar" aria-orientation="vertical">
      {documentType && (
        <>
          <div
            className="actbar__group actbar__typebadge"
            role="img"
            aria-label={`${DOCUMENT_TYPE_LABEL[documentType]} document`}
            title={`${DOCUMENT_TYPE_LABEL[documentType]} document`}
            data-testid={`doctype-${documentType}`}
          >
            <Icon name={documentType} />
          </div>
          <span className="actbar__sep" />
        </>
      )}
      <div className="actbar__group">{primary.map((p) => panelButton(p.id, p.label))}</div>
      <span className="actbar__spacer" />
      <div className="actbar__group">{utility.map((p) => panelButton(p.id, p.label))}</div>
    </nav>
  );
}
