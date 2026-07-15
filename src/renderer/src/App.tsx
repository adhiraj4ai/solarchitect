import { useEffect, useState } from 'react';
import { CanvasView } from './canvas/CanvasView';
import { ShapeLibrary } from './canvas/ShapeLibrary';
import { YamlCodeEditor } from './editor/YamlCodeEditor';
import { ProjectSidebar } from './project/ProjectSidebar';
import { TemplatesPanel } from './project/TemplatesPanel';
import { Wordmark } from './ui/Wordmark';
import { useSyncEngine } from './hooks/useSyncEngine';
import { useProject } from './hooks/useProject';
import { useTemplates } from './hooks/useTemplates';
import type { Mode } from './canvas/CanvasView';
import type { Diagram } from '@shared/ir/types';

/** Which panels are on screen. Orthogonal to the canvas-interaction Mode. */
type View = 'visual' | 'split' | 'code';

export default function App() {
  const { yamlText, diagram, yamlError, canvasEditSeq, canUndo, canRedo, onCanvasEdit, onYamlEdit, loadDiagram, undo, redo } =
    useSyncEngine();
  const project = useProject(loadDiagram);
  // Pass the stable setter directly — an inline wrapper would change every
  // render and retrigger useTemplates' load effect in a loop.
  const templates = useTemplates(project.projectDir, project.setIoError);

  const [mode, setMode] = useState<Mode>('architect');
  // Layout: visual = canvas only, split = canvas + source (default), code =
  // source editor only. Independent of the canvas-interaction mode above.
  const [view, setView] = useState<View>('split');
  const showCanvas = view !== 'code';
  const [pendingTemplate, setPendingTemplate] = useState<Diagram | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  // Animate: flow the relationship lines. Present: full-screen, chrome-free,
  // stepping through page frames (or fit-to-content when there are none).
  const [animate, setAnimate] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const frames = diagram.frames ?? [];

  function startPresenting() {
    setPresentIndex(0);
    setPresenting(true);
  }
  function stepPresent(delta: number) {
    setPresentIndex((i) => Math.max(0, Math.min(frames.length - 1, i + delta)));
  }

  // Presentation keyboard controls: Esc exits, arrows step through frames.
  useEffect(() => {
    if (!presenting) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPresenting(false);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ')
        setPresentIndex((i) => Math.max(0, Math.min(frames.length - 1, i + 1)));
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
        setPresentIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, frames.length]);

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
    <div className={`app${presenting ? ' app--presenting' : ''}`}>
      <header className="app__bar">
        <Wordmark />
        <span className="topsep" />
        {showCanvas && (
          <>
            <div className="segmented" role="tablist" aria-label="Mode">
              <button
                role="tab"
                aria-selected={mode === 'architect'}
                className={`segmented__btn${mode === 'architect' ? ' on' : ''}`}
                onClick={() => setMode('architect')}
              >
                Architect
              </button>
              <button
                role="tab"
                aria-selected={mode === 'whiteboard'}
                className={`segmented__btn${mode === 'whiteboard' ? ' on' : ''}`}
                onClick={() => setMode('whiteboard')}
              >
                Whiteboard
              </button>
            </div>
            <span className="topsep" />
          </>
        )}
        <div className="topgroup">
          <button data-testid="undo-btn" onClick={undo} disabled={!canUndo} className="btn btn--sm btn--icon" title="Undo (⌘Z)">
            ↩
          </button>
          <button data-testid="redo-btn" onClick={redo} disabled={!canRedo} className="btn btn--sm btn--icon" title="Redo (⌘⇧Z)">
            ↪
          </button>
        </div>
        <span className="spacer" />
        {showCanvas && (
          <div className="topgroup">
            <button
              data-testid="animate-toggle"
              className={`btn btn--sm${animate ? ' btn--on' : ''}`}
              aria-pressed={animate}
              onClick={() => setAnimate((v) => !v)}
              title="Animate the relationship lines"
            >
              {animate ? '◉ Animating' : '◎ Animate'}
            </button>
            <button data-testid="present-btn" className="btn btn--sm" onClick={startPresenting} title="Present full screen">
              ▷ Present
            </button>
          </div>
        )}
        <span className="topsep" />
        <span className="app__file">
          {project.currentFile ? (
            <span className="name">{project.currentFile}</span>
          ) : (
            <span className="muted">untitled — not in a project</span>
          )}
          {yamlError ? <span className="state error">YAML error</span> : <span className="state ok">canvas ⇄ source</span>}
        </span>
      </header>

      <div className={`app__body app__body--${view}`}>
        <aside className="rail">
          <section className="rail__proj">
            <ProjectSidebar
              projectDir={project.projectDir}
              entries={project.entries}
              currentFile={project.currentFile}
              canSave={!!project.currentFile && !yamlError}
              git={project.git}
              syncing={project.syncing}
              onOpenProject={project.openProject}
              onNewProject={project.newProject}
              onNewDiagram={project.newDiagram}
              onOpenDiagram={project.openDiagram}
              onSave={() => project.saveDiagram(yamlText)}
              onSync={project.sync}
            />
          </section>
          <section className="rail__shapes">
            {!showCanvas ? (
              <div className="rail__hint">
                <span className="eyebrow">Code</span>
                <p>Editing the diagram as YAML. Invalid YAML freezes sync and shows the error — nothing is lost. Switch to Split or Visual to place shapes.</p>
              </div>
            ) : mode === 'architect' ? (
              <ShapeLibrary />
            ) : (
              <div className="rail__hint">
                <span className="eyebrow">Whiteboard</span>
                <p>Sketch freely with the drawing tools on the canvas. Switch to Architect to place cloud shapes.</p>
              </div>
            )}
          </section>
          <section className="rail__tpl">
            <TemplatesPanel
              templates={templates.templates}
              templatesText={templates.templatesText}
              yamlError={templates.yamlError}
              onApplyYaml={templates.applyTemplatesYaml}
            />
          </section>
        </aside>

        <main className="stage">
          {showCanvas ? (
            <CanvasView
              diagram={diagram}
              templates={templates.templates}
              mode={mode}
              animate={animate}
              presenting={presenting}
              presentIndex={presentIndex}
              onCanvasEdit={onCanvasEdit}
              onSaveTemplate={beginSaveTemplate}
              onError={project.setIoError}
            />
          ) : (
            <YamlCodeEditor
              yamlText={yamlText}
              yamlError={yamlError}
              canvasEditSeq={canvasEditSeq}
              onYamlEdit={onYamlEdit}
              full
            />
          )}
        </main>

        {view === 'split' && (
          <YamlCodeEditor
            yamlText={yamlText}
            yamlError={yamlError}
            canvasEditSeq={canvasEditSeq}
            onYamlEdit={onYamlEdit}
          />
        )}

        <footer className="app__foot">
          <div className="segmented" role="tablist" aria-label="View">
            {(
              [
                ['visual', 'Visual'],
                ['split', 'Split'],
                ['code', 'Code'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                role="tab"
                data-testid={`view-${v}`}
                aria-selected={view === v}
                className={`segmented__btn${view === v ? ' on' : ''}`}
                onClick={() => setView(v)}
                title={`${label} view`}
              >
                {label}
              </button>
            ))}
          </div>
        </footer>
      </div>

      {presenting && (
        <div className="present-bar" role="toolbar" aria-label="Presentation">
          <button className="btn btn--sm" data-testid="present-exit" onClick={() => setPresenting(false)} title="Exit (Esc)">
            ✕ Exit
          </button>
          {frames.length > 0 && (
            <>
              <span className="present-sep" />
              <button className="btn btn--sm btn--icon" onClick={() => stepPresent(-1)} disabled={presentIndex === 0} title="Previous (←)">
                ‹
              </button>
              <span className="present-count">
                {presentIndex + 1} / {frames.length}
                <span className="present-name">{frames[Math.min(presentIndex, frames.length - 1)]?.label}</span>
              </span>
              <button
                className="btn btn--sm btn--icon"
                onClick={() => stepPresent(1)}
                disabled={presentIndex >= frames.length - 1}
                title="Next (→)"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}

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
