import type { DiagramFileEntry } from '@shared/project/types';

const basename = (dir: string) => dir.split(/[/\\]/).filter(Boolean).pop() ?? dir;

export function ProjectSidebar({
  projectDir,
  entries,
  currentFile,
  canSave,
  onOpenProject,
  onNewDiagram,
  onOpenDiagram,
  onSave,
}: {
  projectDir: string | null;
  entries: DiagramFileEntry[];
  currentFile: string | null;
  canSave: boolean;
  onOpenProject: () => void;
  onNewDiagram: () => void;
  onOpenDiagram: (fileName: string) => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="sidebar__head">
        <span className="eyebrow">Project</span>
        <div className={`sidebar__project${projectDir ? '' : ' empty'}`}>
          {projectDir ? basename(projectDir) : 'No project open'}
        </div>
        <div className="sidebar__actions">
          <button data-testid="open-project-btn" onClick={onOpenProject} className="btn btn--sm">
            Open…
          </button>
          <button data-testid="new-diagram-btn" onClick={onNewDiagram} disabled={!projectDir} className="btn btn--sm">
            New
          </button>
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
      <div className="list" data-testid="diagram-list">
        {entries.length === 0 && projectDir && (
          <div className="list__empty">No diagrams yet — “New” creates one.</div>
        )}
        {entries.map((e) => (
          <button
            key={e.fileName}
            onClick={() => e.status === 'ok' && onOpenDiagram(e.fileName)}
            disabled={e.status === 'error'}
            title={e.errorMessage}
            className={`diagram-item${e.fileName === currentFile ? ' active' : ''}${
              e.status === 'error' ? ' error' : ''
            }`}
          >
            {e.status === 'error' && <span className="warn" aria-hidden="true">⚠</span>}
            {e.fileName}
          </button>
        ))}
      </div>
    </>
  );
}
