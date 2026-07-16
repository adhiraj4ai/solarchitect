import { NewDocumentMenu } from './NewDocumentMenu';
import { type DocumentType } from '@shared/project/documentType';
import type { DocumentEntry } from '@shared/project/types';

const basename = (dir: string) => dir.split(/[/\\]/).filter(Boolean).pop() ?? dir;

/** The document types offered by "New" (and the order groups appear in the list).
 *  Markdown is added once its editor exists. */
const OFFERED_TYPES: DocumentType[] = ['diagram', 'whiteboard'];

const GROUP_LABEL: Record<DocumentType, string> = {
  diagram: 'Diagrams',
  whiteboard: 'Whiteboards',
  markdown: 'Documents',
};

function TypeIcon({ type }: { type: DocumentType }) {
  const paths: Record<DocumentType, JSX.Element> = {
    diagram: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="8.5" y="14" width="7" height="7" rx="1" />
      </>
    ),
    whiteboard: (
      <>
        <path d="M4 5h16v11H4z" />
        <path d="M8 9l2.5 2.5L16 6" />
      </>
    ),
    markdown: (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="M7 15V9l2.5 2.5L12 9v6" />
      </>
    ),
  };
  return (
    <svg className="diagram-item__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

export function ProjectSidebar({
  projectDir,
  entries,
  currentFile,
  canSave,
  onOpenProject,
  onNewProject,
  onNewDocument,
  onOpenDocument,
  onSave,
}: {
  projectDir: string | null;
  entries: DocumentEntry[];
  currentFile: string | null;
  canSave: boolean;
  onOpenProject: () => void;
  onNewProject: () => void;
  onNewDocument: (type: DocumentType) => void;
  onOpenDocument: (fileName: string) => void;
  onSave: () => void;
}) {
  // Order the groups as offered, then any other types (e.g. markdown created
  // outside the app) after, so nothing is ever hidden entirely.
  const groupOrder: DocumentType[] = [
    ...OFFERED_TYPES,
    ...(['markdown'] as DocumentType[]).filter((t) => !OFFERED_TYPES.includes(t)),
  ];

  return (
    <>
      <div className="sidebar__head">
        <span className="eyebrow">Project</span>
        <div className={`sidebar__project${projectDir ? '' : ' empty'}`}>
          {projectDir ? basename(projectDir) : 'No project open'}
        </div>
        <div className="sidebar__actions">
          <button data-testid="new-project-btn" onClick={onNewProject} className="btn btn--sm">
            New project
          </button>
          <button data-testid="open-project-btn" onClick={onOpenProject} className="btn btn--sm">
            Open…
          </button>
        </div>
        <div className="sidebar__actions">
          <NewDocumentMenu disabled={!projectDir} types={OFFERED_TYPES} onNew={onNewDocument} />
          <button
            data-testid="save-btn"
            onClick={onSave}
            disabled={!canSave}
            title={currentFile && !canSave ? 'Fix the YAML error before saving' : undefined}
            className="btn btn--sm btn--primary"
          >
            Save
          </button>
        </div>
      </div>
      <div className="list" data-testid="document-list">
        {entries.length === 0 && projectDir && (
          <div className="list__empty" data-testid="project-empty">
            No documents yet — use “New” to create one.
          </div>
        )}
        {groupOrder.map((type) => {
          const group = entries.filter((e) => e.type === type);
          if (group.length === 0) return null;
          return (
            <div key={type} className="list__group" data-testid={`group-${type}`}>
              <div className="list__grouphead">{GROUP_LABEL[type]}</div>
              {group.map((e) => (
                <button
                  key={e.fileName}
                  onClick={() => e.status === 'ok' && onOpenDocument(e.fileName)}
                  disabled={e.status === 'error'}
                  title={e.errorMessage}
                  className={`diagram-item${e.fileName === currentFile ? ' active' : ''}${
                    e.status === 'error' ? ' error' : ''
                  }`}
                >
                  {e.status === 'error' ? (
                    <span className="warn" aria-hidden="true">
                      ⚠
                    </span>
                  ) : (
                    <TypeIcon type={type} />
                  )}
                  {e.fileName}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
