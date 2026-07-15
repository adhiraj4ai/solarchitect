import type { DiagramFileEntry } from '@shared/project/types';

const basename = (dir: string) => dir.split(/[/\\]/).filter(Boolean).pop() ?? dir;

export function ProjectSidebar({
  projectDir,
  entries,
  currentFile,
  onOpenProject,
  onNewDiagram,
  onOpenDiagram,
  onSave,
}: {
  projectDir: string | null;
  entries: DiagramFileEntry[];
  currentFile: string | null;
  onOpenProject: () => void;
  onNewDiagram: () => void;
  onOpenDiagram: (fileName: string) => void;
  onSave: () => void;
}) {
  return (
    <div
      style={{
        width: 220,
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        background: '#f7fafc',
        minHeight: 0,
      }}
    >
      <div style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#718096' }}>
          Project
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>
          {projectDir ? basename(projectDir) : 'No project open'}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button data-testid="open-project-btn" onClick={onOpenProject} style={btn}>
            Open…
          </button>
          <button data-testid="new-diagram-btn" onClick={onNewDiagram} disabled={!projectDir} style={btn}>
            New
          </button>
          <button data-testid="save-btn" onClick={onSave} disabled={!currentFile} style={btn}>
            Save
          </button>
        </div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }} data-testid="diagram-list">
        {entries.map((e) => (
          <button
            key={e.fileName}
            onClick={() => e.status === 'ok' && onOpenDiagram(e.fileName)}
            disabled={e.status === 'error'}
            title={e.errorMessage}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px 10px',
              border: 'none',
              borderBottom: '1px solid #edf2f7',
              background: e.fileName === currentFile ? '#e6f0fb' : 'transparent',
              color: e.status === 'error' ? '#c53030' : '#2d3748',
              fontSize: 13,
              cursor: e.status === 'error' ? 'not-allowed' : 'pointer',
            }}
          >
            {e.status === 'error' ? '⚠ ' : ''}
            {e.fileName}
          </button>
        ))}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 12,
  background: 'white',
  border: '1px solid #cbd5e0',
  borderRadius: 6,
  cursor: 'pointer',
};
