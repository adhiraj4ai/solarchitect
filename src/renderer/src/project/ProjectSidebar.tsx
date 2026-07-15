import type { DiagramFileEntry, GitStatus } from '@shared/project/types';

const basename = (dir: string) => dir.split(/[/\\]/).filter(Boolean).pop() ?? dir;

export function ProjectSidebar({
  projectDir,
  entries,
  currentFile,
  canSave,
  git,
  syncing,
  onOpenProject,
  onNewProject,
  onNewDiagram,
  onOpenDiagram,
  onSave,
  onSync,
}: {
  projectDir: string | null;
  entries: DiagramFileEntry[];
  currentFile: string | null;
  canSave: boolean;
  git: GitStatus | null;
  syncing: boolean;
  onOpenProject: () => void;
  onNewProject: () => void;
  onNewDiagram: () => void;
  onOpenDiagram: (fileName: string) => void;
  onSave: () => void;
  onSync: () => void;
}) {
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
          <button data-testid="new-diagram-btn" onClick={onNewDiagram} disabled={!projectDir} className="btn btn--sm">
            New diagram
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
        {projectDir && git && (
          <div className="git-row">
            {git.isRepo ? (
              <>
                <span className="git-branch" title="Current branch">
                  ⎇ {git.branch ?? 'detached'}
                </span>
                <span className={`git-state${git.dirty > 0 ? ' dirty' : ''}`}>
                  {git.dirty > 0 ? `${git.dirty} change${git.dirty === 1 ? '' : 's'}` : 'clean'}
                </span>
                <button
                  data-testid="git-sync-btn"
                  onClick={onSync}
                  disabled={syncing}
                  className="btn btn--sm"
                  title={git.hasRemote ? 'Commit and sync with the remote' : 'Commit locally (no remote configured)'}
                >
                  {syncing ? 'Syncing…' : git.hasRemote ? 'Sync' : 'Commit'}
                </button>
              </>
            ) : (
              <span className="git-state">Not a git repository</span>
            )}
          </div>
        )}
      </div>
      <div className="list" data-testid="diagram-list">
        {entries.length === 0 && projectDir && (
          <div className="list__empty">No diagrams yet — “New diagram” creates one.</div>
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
