import { useEffect, useState } from 'react';
import { CanvasView } from './canvas/CanvasView';
import { NodePalette } from './canvas/NodePalette';
import { YamlCodeEditor } from './editor/YamlCodeEditor';
import { ProjectSidebar } from './project/ProjectSidebar';
import { TemplatesPanel } from './project/TemplatesPanel';
import { Wordmark } from './ui/Wordmark';
import { useSyncEngine } from './hooks/useSyncEngine';
import { useProject } from './hooks/useProject';
import { useTemplates } from './hooks/useTemplates';
import type { Diagram } from '@shared/ir/types';

export default function App() {
  const { yamlText, diagram, yamlError, canvasEditSeq, canUndo, canRedo, onCanvasEdit, onYamlEdit, loadDiagram, undo, redo } =
    useSyncEngine();
  const project = useProject(loadDiagram);
  // Pass the stable setter directly — an inline wrapper would change every
  // render and retrigger useTemplates' load effect in a loop.
  const templates = useTemplates(project.projectDir, project.setIoError);

  const [pendingTemplate, setPendingTemplate] = useState<Diagram | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

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
    <div className="app">
      <header className="app__bar">
        <Wordmark />
        <span className="spacer" />
        <span className="app__file">
          {project.currentFile ? (
            <span className="name">{project.currentFile}</span>
          ) : (
            <span style={{ color: 'var(--faint)' }}>untitled — not in a project</span>
          )}
          {yamlError && <span className="state error">YAML error</span>}
        </span>
      </header>

      <div className="app__body">
        <div className="sidebar">
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

        <div className="workspace">
          <div className="actionbar">
            <button data-testid="undo-btn" onClick={undo} disabled={!canUndo} className="btn btn--sm" title="Undo (⌘Z)">
              ↩ Undo
            </button>
            <button data-testid="redo-btn" onClick={redo} disabled={!canRedo} className="btn btn--sm" title="Redo (⌘⇧Z)">
              Redo ↪
            </button>
            <span className="actionbar__hint">Drag a node onto the canvas, or edit the YAML →</span>
          </div>
          <NodePalette />
          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <CanvasView
              diagram={diagram}
              templates={templates.templates}
              onCanvasEdit={onCanvasEdit}
              onSaveTemplate={beginSaveTemplate}
              onError={project.setIoError}
            />
          </div>
        </div>

        <YamlCodeEditor
          yamlText={yamlText}
          yamlError={yamlError}
          canvasEditSeq={canvasEditSeq}
          onYamlEdit={onYamlEdit}
        />
      </div>

      {pendingTemplate && (
        <div className="modal__backdrop">
          <div className="modal" data-testid="template-modal">
            <h2>Save as template</h2>
            <p>Reusable across every diagram in this project.</p>
            <input
              autoFocus
              data-testid="template-name-input"
              className="modal__input"
              value={templateName}
              placeholder="Template name"
              onChange={(e) => {
                setTemplateName(e.target.value);
                setConfirmOverwrite(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitTemplate()}
            />
            {confirmOverwrite && (
              <div data-testid="overwrite-warning" className="modal__warn">
                A template named “{templateName.trim()}” already exists. Save again to overwrite, or rename.
              </div>
            )}
            <div className="modal__actions">
              <button onClick={() => setPendingTemplate(null)} className="btn">
                Cancel
              </button>
              <button data-testid="template-save-btn" onClick={submitTemplate} className="btn btn--primary">
                {confirmOverwrite ? 'Overwrite' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {project.ioError && (
        <div role="alert" className="toast">
          <span className="accent" />
          <span>{project.ioError}</span>
          <button onClick={project.dismissError}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
