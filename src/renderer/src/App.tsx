import { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasView } from './canvas/CanvasView';
import { ShapeLibrary } from './canvas/ShapeLibrary';
import { YamlCodeEditor } from './editor/YamlCodeEditor';
import { ProjectSidebar } from './project/ProjectSidebar';
import { GitPanel } from './project/GitPanel';
import { TemplatesPanel } from './project/TemplatesPanel';
import { SearchPanel } from './project/SearchPanel';
import { OutlinePanel } from './project/OutlinePanel';
import { SettingsPanel } from './project/SettingsPanel';
import { HelpPanel } from './ui/HelpPanel';
import { ActivityBar } from './ui/ActivityBar';
import { Sidebar } from './ui/Sidebar';
import { Wordmark } from './ui/Wordmark';
import { useSyncEngine } from './hooks/useSyncEngine';
import { useProject } from './hooks/useProject';
import { useTemplates } from './hooks/useTemplates';
import { useGit } from './hooks/useGit';
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout';
import { useSettings } from './hooks/useSettings';
import type { Mode } from './canvas/CanvasView';
import type { PanelId } from '@shared/shell/panels';
import type { Diagram } from '@shared/ir/types';

/** Which panels are on screen for the Diagram surface. Orthogonal to the surface. */
type View = 'visual' | 'split' | 'code';

/** Compile-time exhaustiveness guard for the panel switch. */
function assertNever(x: never): never {
  throw new Error(`Unhandled panel: ${String(x)}`);
}

export default function App() {
  const { yamlText, diagram, yamlError, canvasEditSeq, canUndo, canRedo, onCanvasEdit, onYamlEdit, loadDiagram, undo, redo } =
    useSyncEngine();
  const project = useProject(loadDiagram);
  // Pass the stable setter directly — an inline wrapper would change every
  // render and retrigger useTemplates' load effect in a loop.
  const templates = useTemplates(project.projectDir, project.setIoError);
  const git = useGit(project.projectDir, project.setIoError);
  const { settings, update: updateSettings } = useSettings(project.setIoError);

  // The document surface (Diagram = architect, Whiteboard = whiteboard) doubles
  // as the canvas-interaction mode. The activity bar switches it.
  const [surface, setSurface] = useState<Mode>('architect');
  const layout = useWorkspaceLayout(surface);

  // Visual / Split / Code applies only to the Diagram surface. A whiteboard has
  // no meaningful YAML, so it always shows the canvas alone.
  const [view, setView] = useState<View>('split');
  const effectiveView: View = surface === 'whiteboard' ? 'visual' : view;
  const showCanvas = effectiveView !== 'code';
  const showSource = effectiveView === 'split';

  const [pendingTemplate, setPendingTemplate] = useState<Diagram | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  // Animate: flow the relationship lines. Present: full-screen, chrome-free,
  // stepping through page frames (or fit-to-content when there are none).
  const [animate, setAnimate] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const frames = diagram.frames ?? [];

  // A shape the Outline/Search panel asked to reveal on the canvas. The nonce
  // makes revealing the same id twice still fire.
  const [revealTarget, setRevealTarget] = useState<{ id: string; nonce: number } | null>(null);
  const revealNonce = useRef(0);
  const reveal = useCallback(
    (id: string) => {
      // Reveal happens on the canvas; make sure it's visible.
      if (surface === 'architect' && view === 'code') setView('split');
      revealNonce.current += 1;
      setRevealTarget({ id, nonce: revealNonce.current });
    },
    [surface, view],
  );

  const openDiagramFromSearch = useCallback(
    (fileName: string) => {
      void project.openDiagram(fileName);
    },
    [project],
  );

  function startPresenting() {
    setPresentIndex(0);
    setPresenting(true);
  }
  function stepPresent(delta: number) {
    setPresentIndex((i) => Math.max(0, Math.min(frames.length - 1, i + delta)));
  }

  // Autosave the open diagram after edits, when enabled and the YAML is valid.
  useEffect(() => {
    if (!settings.autosave || !project.currentFile || yamlError) return;
    const t = setTimeout(() => {
      void project.saveDiagram(yamlText).then(() => git.refresh());
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autosave, yamlText, project.currentFile, yamlError]);

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

  // Cmd/Ctrl+B toggles the sidebar (VS Code parity).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        e.stopPropagation();
        layout.toggleCollapsed();
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [layout]);

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

  function renderPanel(panel: PanelId) {
    switch (panel) {
      case 'project':
        return (
          <ProjectSidebar
            projectDir={project.projectDir}
            entries={project.entries}
            currentFile={project.currentFile}
            canSave={!!project.currentFile && !yamlError}
            onOpenProject={project.openProject}
            onNewProject={project.newProject}
            onNewDiagram={project.newDiagram}
            onOpenDiagram={project.openDiagram}
            onSave={async () => {
              await project.saveDiagram(yamlText);
              void git.refresh(); // reflect the new working-tree state in the status bar
            }}
          />
        );
      case 'search':
        return (
          <SearchPanel
            fileNames={project.entries.map((e) => e.fileName)}
            diagram={diagram}
            hasProject={!!project.projectDir}
            onOpenDiagram={openDiagramFromSearch}
            onReveal={reveal}
          />
        );
      case 'outline':
        return <OutlinePanel diagram={diagram} onReveal={reveal} />;
      case 'shapes':
        return <ShapeLibrary defaultProvider={settings.defaultProvider} />;
      case 'templates':
        return (
          <TemplatesPanel
            templates={templates.templates}
            templatesText={templates.templatesText}
            yamlError={templates.yamlError}
            onApplyYaml={templates.applyTemplatesYaml}
          />
        );
      case 'git':
        return <GitPanel projectDir={project.projectDir} git={git} />;
      case 'settings':
        return <SettingsPanel settings={settings} onUpdate={updateSettings} />;
      case 'help':
        return <HelpPanel />;
      default:
        // Exhaustiveness: a new PanelId must be handled above, not silently
        // render nothing.
        return assertNever(panel);
    }
  }

  return (
    <div className={`app${presenting ? ' app--presenting' : ''}`}>
      <header className="app__bar">
        <Wordmark />
        <span className="topsep" />
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

      <div className={`app__body app__body--${effectiveView}`}>
        <ActivityBar
          surface={surface}
          onSurfaceChange={setSurface}
          activePanel={layout.activePanel}
          collapsed={layout.collapsed}
          onSelectPanel={layout.selectPanel}
        />

        {!layout.collapsed && (
          <Sidebar width={layout.width} onResize={layout.setWidth}>
            {renderPanel(layout.activePanel)}
          </Sidebar>
        )}

        <main className="stage">
          {showCanvas ? (
            <CanvasView
              diagram={diagram}
              templates={templates.templates}
              mode={surface}
              animate={animate}
              presenting={presenting}
              presentIndex={presentIndex}
              grid={settings.grid}
              revealTarget={revealTarget}
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

        {showSource && (
          <YamlCodeEditor
            yamlText={yamlText}
            yamlError={yamlError}
            canvasEditSeq={canvasEditSeq}
            onYamlEdit={onYamlEdit}
          />
        )}
      </div>

      <footer className="app__foot">
        {surface === 'architect' && (
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
        )}

        <span className="app__foot-spacer" />

        {git.detail?.isRepo && (
          <span className="foot-git" data-testid="foot-git" title="Version control">
            <span className="foot-git__branch">⎇ {git.detail.branch ?? 'detached'}</span>
            {(git.detail.ahead > 0 || git.detail.behind > 0) && (
              <span className="foot-git__sync">
                {git.detail.behind > 0 && `↓${git.detail.behind}`}
                {git.detail.behind > 0 && git.detail.ahead > 0 && ' '}
                {git.detail.ahead > 0 && `↑${git.detail.ahead}`}
              </span>
            )}
            <span className={`foot-git__state${git.detail.files.length > 0 ? ' dirty' : ''}`}>
              {git.detail.files.length > 0
                ? `${git.detail.files.length} change${git.detail.files.length === 1 ? '' : 's'}`
                : 'clean'}
            </span>
          </span>
        )}
      </footer>

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
