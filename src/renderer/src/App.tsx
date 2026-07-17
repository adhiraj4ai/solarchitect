import { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasView } from './canvas/CanvasView';
import { WhiteboardView } from './canvas/WhiteboardView';
import { ShapeLibrary } from './canvas/ShapeLibrary';
import { YamlCodeEditor } from './editor/YamlCodeEditor';
import { MarkdownView } from './editor/MarkdownView';
import { ProjectSidebar } from './project/ProjectSidebar';
import { GitPanel } from './project/GitPanel';
import { TemplatesPanel } from './project/TemplatesPanel';
import { SearchPanel } from './project/SearchPanel';
import { OutlinePanel } from './project/OutlinePanel';
import { SettingsPanel } from './project/SettingsPanel';
import { AnimationsPanel } from './project/AnimationsPanel';
import {
  allPresets,
  resolvePreset,
  isBuiltinPreset,
  BUILTIN_PRESETS,
  DEFAULT_ACTIVE_PRESET_ID,
  type AnimationPreset,
} from '@shared/animation/presets';
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
import type { PanelId } from '@shared/shell/panels';
import type { Diagram } from '@shared/ir/types';

/** How the Diagram surface is laid out (only applies to the Diagram surface). */
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

  // The open document's type fixes which editor is shown — there is no surface
  // toggle. With no document open we fall back to 'diagram' so the shell (panels,
  // layout) has a sensible default.
  const docType = project.currentType ?? 'diagram';
  const isDiagram = docType === 'diagram';
  const layout = useWorkspaceLayout(docType);

  // Visual / Split / Code applies only to the Diagram surface. Whiteboard and
  // markdown are single-pane and have no YAML source.
  const [view, setView] = useState<View>('split');
  const bodyView: View = isDiagram ? view : 'visual';
  const showCanvas = isDiagram && view !== 'code';
  const showSource = isDiagram && view === 'split';

  // Mirror the open markdown document's text so the Outline and Search panels can
  // index its headings. MarkdownView owns the source of truth and reports changes.
  const [markdownText, setMarkdownText] = useState('');

  const [pendingTemplate, setPendingTemplate] = useState<Diagram | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  // Animate: flow the relationship lines. Present: full-screen, chrome-free,
  // stepping through page frames (or fit-to-content when there are none).
  // Steps: overlay the resolved traversal order as badges on nodes/edges.
  const [showSteps, setShowSteps] = useState(false);
  // Traversal preview: play the staged dim→lit build-up, looping.
  const [traversalPlaying, setTraversalPlaying] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const frames = diagram.frames ?? [];

  // A shape the Outline/Search panel asked to reveal on the canvas. The nonce
  // makes revealing the same id twice still fire.
  const [revealTarget, setRevealTarget] = useState<{ id: string; nonce: number } | null>(null);
  const revealNonce = useRef(0);
  const reveal = useCallback(
    (id: string) => {
      // Reveal targets the canvas (diagram) or the preview (markdown); make sure
      // a rendered surface is visible to reveal into.
      if (view === 'code') setView('split');
      revealNonce.current += 1;
      setRevealTarget({ id, nonce: revealNonce.current });
    },
    [view],
  );

  const openDocumentFromSearch = useCallback(
    (fileName: string) => {
      void project.openDocument(fileName);
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
  // Whiteboard and markdown documents own their own autosave.
  useEffect(() => {
    if (!settings.autosave || !project.currentFile || !isDiagram || yamlError) return;
    const t = setTimeout(() => {
      void project.saveDocument(yamlText).then(() => git.refresh());
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autosave, yamlText, project.currentFile, isDiagram, yamlError]);

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
            canSave={!!project.currentFile && isDiagram && !yamlError}
            onOpenProject={project.openProject}
            onNewProject={project.newProject}
            onNewDocument={project.newDocument}
            onOpenDocument={project.openDocument}
            onSave={async () => {
              await project.saveDocument(yamlText);
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
            documentType={project.currentType}
            markdownText={markdownText}
            onOpenDiagram={openDocumentFromSearch}
            onReveal={reveal}
          />
        );
      case 'outline':
        return (
          <OutlinePanel
            diagram={diagram}
            onReveal={reveal}
            documentType={project.currentType}
            markdownText={markdownText}
          />
        );
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
      case 'animations':
        return (
          <AnimationsPanel
            presets={presets}
            activeId={settings.activePresetId}
            onSelectActive={selectActivePreset}
            onCreate={createPreset}
            onDuplicate={duplicatePreset}
            onUpdate={updatePreset}
            onDelete={deletePreset}
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
              data-testid="steps-toggle"
              className={`btn btn--sm${showSteps ? ' btn--on' : ''}`}
              aria-pressed={showSteps}
              onClick={() => setShowSteps((v) => !v)}
              title="Show the traversal step order on nodes and edges"
            >
              {showSteps ? '① Steps' : '◇ Steps'}
            </button>
            <button
              data-testid="traversal-toggle"
              className={`btn btn--sm${traversalPlaying ? ' btn--on' : ''}`}
              aria-pressed={traversalPlaying}
              onClick={() => setTraversalPlaying((v) => !v)}
              title={`Play the active animation: ${activePreset.name}`}
            >
              {traversalPlaying ? `⏸ ${activePreset.name}` : `▶ ${activePreset.name}`}
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
          {isDiagram &&
            (yamlError ? (
              <span className="state error">YAML error</span>
            ) : (
              <span className="state ok">canvas ⇄ source</span>
            ))}
        </span>
      </header>

      <div className={`app__body app__body--${bodyView}`}>
        <ActivityBar
          documentType={project.currentType}
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
          {project.projectDir && !project.currentFile ? (
            <div className="stage__empty" data-testid="no-document">
              <p>No document open.</p>
              <p className="muted">
                Use <strong>New</strong> in the Project panel to create a diagram, whiteboard, or markdown document.
              </p>
            </div>
          ) : docType === 'whiteboard' ? (
            <WhiteboardView
              key={project.currentFile}
              projectDir={project.projectDir}
              fileName={project.currentFile}
              entries={project.entries}
              onError={project.setIoError}
            />
          ) : docType === 'markdown' ? (
            <MarkdownView
              key={project.currentFile}
              projectDir={project.projectDir}
              fileName={project.currentFile}
              view={view}
              revealTarget={revealTarget}
              onError={project.setIoError}
              onGitRefresh={git.refresh}
              onTextChange={setMarkdownText}
            />
          ) : showCanvas ? (
            <CanvasView
              diagram={diagram}
              templates={templates.templates}
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
        {isDiagram && (
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
        {docType === 'markdown' && (
          <div className="segmented" role="tablist" aria-label="Markdown view">
            {(
              [
                ['visual', 'Preview'],
                ['split', 'Split'],
                ['code', 'Source'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                role="tab"
                data-testid={`md-view-${v}`}
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
