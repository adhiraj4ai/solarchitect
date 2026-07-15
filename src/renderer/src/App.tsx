import { useEffect, useState } from 'react';
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
  const { yamlText, diagram, yamlError, canvasEditSeq, canUndo, canRedo, onCanvasEdit, onYamlEdit, loadDiagram, undo, redo } =
    useSyncEngine();
  const project = useProject(loadDiagram);

  // Global undo/redo. Captured before tldraw and the textarea so a single
  // shortcut drives the unified IR history regardless of what has focus.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const isUndo = mod && !e.shiftKey && key === 'z';
      const isRedo = mod && ((e.shiftKey && key === 'z') || key === 'y'); // Cmd+Shift+Z or Ctrl+Y
      if (!isUndo && !isRedo) return;
      e.preventDefault();
      e.stopPropagation();
      if (isRedo) redo();
      else undo();
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [undo, redo]);
  // Pass the stable setter directly — an inline wrapper would change every
  // render and retrigger useTemplates' load effect in a loop.
  const templates = useTemplates(project.projectDir, project.setIoError);

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
        <TemplatesPanel
          templates={templates.templates}
          templatesText={templates.templatesText}
          yamlError={templates.yamlError}
          onApplyYaml={templates.applyTemplatesYaml}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, padding: '4px 8px', borderBottom: '1px solid #e2e8f0' }}>
          <button data-testid="undo-btn" onClick={undo} disabled={!canUndo} style={topBtn}>
            Undo
          </button>
          <button data-testid="redo-btn" onClick={redo} disabled={!canRedo} style={topBtn}>
            Redo
          </button>
        </div>
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

const topBtn: React.CSSProperties = {
  padding: '3px 12px',
  fontSize: 12,
  background: 'white',
  border: '1px solid #cbd5e0',
  borderRadius: 6,
  cursor: 'pointer',
};
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
