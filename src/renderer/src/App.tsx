import { useState } from 'react';
import { CanvasView } from './canvas/CanvasView';
import { NodePalette } from './canvas/NodePalette';
import { YamlCodeEditor } from './editor/YamlCodeEditor';
import { ProjectSidebar } from './project/ProjectSidebar';
import { TemplatesPanel } from './project/TemplatesPanel';
import { useSyncEngine } from './hooks/useSyncEngine';
import { useProject } from './hooks/useProject';
import { useTemplates } from './hooks/useTemplates';
import type { Diagram } from '@shared/ir/types';

export default function App() {
  const { yamlText, diagram, yamlError, canvasEditSeq, onCanvasEdit, onYamlEdit, loadDiagram } = useSyncEngine();
  const project = useProject(loadDiagram);
  const templates = useTemplates(project.projectDir, (msg) => project.setIoError(msg));

  const [pendingTemplate, setPendingTemplate] = useState<Diagram | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  function beginSaveTemplate(subtree: Diagram) {
    setPendingTemplate(subtree);
    setTemplateName('');
    setConfirmOverwrite(false);
  }

  function submitTemplate() {
    const name = templateName.trim();
    if (!name || !pendingTemplate) return;
    if (templates.templateExists(name) && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    void templates.saveTemplate(name, pendingTemplate);
    setPendingTemplate(null);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 400px', height: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: 220, minHeight: 0 }}>
        <ProjectSidebar
          projectDir={project.projectDir}
          entries={project.entries}
          currentFile={project.currentFile}
          canSave={!!project.currentFile && !yamlError}
          onOpenProject={project.openProject}
          onNewDiagram={project.newDiagram}
          onOpenDiagram={project.openDiagram}
          onSave={() => project.saveDiagram(yamlText)}
        />
        <TemplatesPanel templates={templates.templates} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <NodePalette />
        <div style={{ position: 'relative', flex: 1 }}>
          <CanvasView
            diagram={diagram}
            templates={templates.templates}
            onCanvasEdit={onCanvasEdit}
            onSaveTemplate={beginSaveTemplate}
          />
        </div>
      </div>
      <YamlCodeEditor
        yamlText={yamlText}
        yamlError={yamlError}
        canvasEditSeq={canvasEditSeq}
        onYamlEdit={onYamlEdit}
      />

      {pendingTemplate && (
        <div style={modalBackdrop}>
          <div style={modalCard} data-testid="template-modal">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Save as Template</div>
            <input
              autoFocus
              data-testid="template-name-input"
              value={templateName}
              placeholder="Template name"
              onChange={(e) => {
                setTemplateName(e.target.value);
                setConfirmOverwrite(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitTemplate()}
              style={{ width: '100%', padding: '6px 8px', fontSize: 13, boxSizing: 'border-box' }}
            />
            {confirmOverwrite && (
              <div data-testid="overwrite-warning" style={{ color: '#c05621', fontSize: 12, marginTop: 6 }}>
                A template named “{templateName.trim()}” exists. Save again to overwrite, or rename.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setPendingTemplate(null)} style={modalBtn}>
                Cancel
              </button>
              <button data-testid="template-save-btn" onClick={submitTemplate} style={modalBtn}>
                {confirmOverwrite ? 'Overwrite' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {project.ioError && (
        <div role="alert" style={toast}>
          {project.ioError}
          <button onClick={project.dismissError} style={{ ...modalBtn, marginLeft: 12, color: 'white', borderColor: 'white', background: 'transparent' }}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

const modalBackdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
};
const modalCard: React.CSSProperties = {
  background: 'white',
  padding: 16,
  borderRadius: 8,
  width: 320,
  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
};
const modalBtn: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 13,
  border: '1px solid #cbd5e0',
  borderRadius: 6,
  cursor: 'pointer',
  background: 'white',
};
const toast: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  maxWidth: 380,
  background: '#611a15',
  color: 'white',
  padding: '10px 14px',
  borderRadius: 6,
  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  fontSize: 13,
  zIndex: 2000,
};
