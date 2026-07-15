import { Tldraw, react, createShapeId, exportToBlob, type Editor, type TLShapePartial } from 'tldraw';
import 'tldraw/tldraw.css';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NodeShapeUtil, NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, type ArchNodeShape } from './NodeShapeUtil';
import { ClusterShapeUtil, CLUSTER_COLOR_STYLE, type ArchClusterShape } from './ClusterShapeUtil';
import { EdgeShapeUtil, type ArchEdgeShape } from './EdgeShapeUtil';
import { NODE_TYPE_DND_MIME, TEMPLATE_DND_MIME } from './dnd';
import {
  nodesToShapes,
  nodeToShapeProps,
  getArchNodeShapes,
  shapeToNode,
  clustersToShapes,
  clusterToShape,
  shapeToCluster,
  getArchClusterShapes,
  edgeToShape,
  getArchEdgeShapes,
  edgeShapesEqual,
} from './shapeAdapters';
import { getAnnotationShapes, annotationToShape, shapeToAnnotation, annotationEq } from './annotationAdapters';
import { diffById } from '@shared/sync/diff';
import { extractTemplate, instantiateTemplate } from '@shared/templates/templates';
import type { NamedTemplate } from '@shared/templates/templatesFile';
import { NODE_TAXONOMY } from '@shared/ir/taxonomy';
import { CLUSTER_COLORS } from '@shared/ir/types';
import type {
  Diagram,
  DiagramNode,
  DiagramCluster,
  DiagramEdge,
  EdgeShape as EdgeShapeKind,
  EdgeLineStyle,
} from '@shared/ir/types';

const assetUrls = getAssetUrlsByImport();
const shapeUtils = [ClusterShapeUtil, EdgeShapeUtil, NodeShapeUtil];

export type Mode = 'architect' | 'whiteboard';

/** Tiny preview of each edge routing style for the toolbar picker. */
function EdgeShapeGlyph({ kind }: { kind: EdgeShapeKind }) {
  const d =
    kind === 'curved'
      ? 'M2 14 C7 14 9 4 14 4'
      : kind === 'bent'
        ? 'M2 14 L8 14 L8 4 L14 4'
        : 'M2 14 L14 4';
  return (
    <svg width="16" height="16" viewBox="0 0 16 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Tiny preview of each line stroke style. */
function LineStyleGlyph({ kind }: { kind: EdgeLineStyle }) {
  const dash = kind === 'dashed' ? '5 3' : kind === 'dotted' ? '1 3' : undefined;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <line x1="2" y1="8" x2="14" y2="8" strokeDasharray={dash} />
    </svg>
  );
}

/** Arrowhead on/off preview. */
function ArrowGlyph({ on }: { on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="2" y1="8" x2={on ? '11' : '14'} y2="8" />
      {on && <path d="M10 4.5 L14 8 L10 11.5" />}
    </svg>
  );
}

// Architect mode is a structured system-design surface: no freehand tools, no
// style panel — you place nodes from the library and connect them. Whiteboard
// mode is for sketching: tldraw's full drawing dock and style panel return.
const ARCHITECT_COMPONENTS = {
  StylePanel: null,
  PageMenu: null,
  MainMenu: null,
  Toolbar: null,
  QuickActions: null,
  ActionsMenu: null,
  HelpMenu: null,
  NavigationPanel: null,
};
const WHITEBOARD_COMPONENTS = { PageMenu: null, MainMenu: null };

function shortId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function selectedNodes(editor: Editor): ArchNodeShape[] {
  return editor.getSelectedShapes().filter((s): s is ArchNodeShape => s.type === 'archNode');
}

/**
 * Reconcile the tldraw canvas to match the IR. All mutations run inside
 * mergeRemoteChanges so they're tagged 'remote' and don't re-fire the
 * user-scoped store listener (which would otherwise loop or churn).
 */
function reconcile(editor: Editor, diagram: Diagram): void {
  editor.store.mergeRemoteChanges(() => {
    // Clusters (drawn behind everything).
    const currentClusters: DiagramCluster[] = getArchClusterShapes(editor).map(shapeToCluster);
    const clusterEq = (a: DiagramCluster, b: DiagramCluster) =>
      a.label === b.label &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height &&
      (a.color ?? 'blueprint') === (b.color ?? 'blueprint');
    const dc = diffById(currentClusters, diagram.clusters, clusterEq);
    if (dc.removeIds.length) editor.deleteShapes(dc.removeIds.map((id) => createShapeId(id)));
    if (dc.add.length) editor.createShapes(clustersToShapes(dc.add));
    dc.update.forEach((c) => editor.updateShape(clusterToShape(c)));

    // Edges (derived shapes between node centers).
    const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
    const desiredEdges = diagram.edges
      .map((e) => edgeToShape(e, nodeById))
      .filter((s): s is TLShapePartial => s !== null);
    const desiredEdgeById = new Map(desiredEdges.map((s) => [s.id, s]));
    const currentEdges = getArchEdgeShapes(editor);
    const currentEdgeById = new Map(currentEdges.map((s) => [s.id, s]));
    const edgesToRemove = currentEdges.filter((s) => !desiredEdgeById.has(s.id)).map((s) => s.id);
    if (edgesToRemove.length) editor.deleteShapes(edgesToRemove);
    for (const desired of desiredEdges) {
      const cur = currentEdgeById.get(desired.id);
      if (!cur) editor.createShapes([desired]);
      else if (!edgeShapesEqual(cur, desired as ArchEdgeShape)) editor.updateShape(desired);
    }

    // Nodes (drawn on top).
    const currentNodes = getArchNodeShapes(editor).map(shapeToNode);
    const nodeEq = (a: DiagramNode, b: DiagramNode) =>
      a.type === b.type && a.label === b.label && a.x === b.x && a.y === b.y;
    const dn = diffById(currentNodes, diagram.nodes, nodeEq);
    if (dn.removeIds.length) editor.deleteShapes(dn.removeIds.map((id) => createShapeId(id)));
    if (dn.add.length) editor.createShapes(nodesToShapes(dn.add));
    dn.update.forEach((n) =>
      editor.updateShape({ id: createShapeId(n.id), type: 'archNode', x: n.x, y: n.y, props: nodeToShapeProps(n) }),
    );

    // Annotations (tldraw-native note/geo/text shapes).
    const currentAnnotations = getAnnotationShapes(editor).map((s) => shapeToAnnotation(editor, s));
    const da = diffById(currentAnnotations, diagram.annotations, annotationEq);
    if (da.removeIds.length) editor.deleteShapes(da.removeIds.map((id) => createShapeId(id)));
    if (da.add.length) editor.createShapes(da.add.map(annotationToShape));
    da.update.forEach((a) => editor.updateShape(annotationToShape(a)));

    // Enforce paint order after any additions: clusters at back, nodes on top,
    // edges in between. (New shapes otherwise land on top of their nodes.)
    if (dc.add.length || dn.add.length || desiredEdges.some((s) => !currentEdgeById.has(s.id))) {
      const clusterIds = getArchClusterShapes(editor).map((s) => s.id);
      const nodeIds = getArchNodeShapes(editor).map((s) => s.id);
      if (clusterIds.length) editor.sendToBack(clusterIds);
      if (nodeIds.length) editor.bringToFront(nodeIds);
    }
  });
}

/** Rebuild a consistent IR from the current canvas shapes (after a user move/delete). */
function assembleFromCanvas(editor: Editor, prev: Diagram): Diagram {
  const clusters = getArchClusterShapes(editor).map(shapeToCluster);
  const clusterIds = new Set(clusters.map((c) => c.id));
  const prevNodeById = new Map(prev.nodes.map((n) => [n.id, n]));

  const nodes = getArchNodeShapes(editor).map((s) => {
    const node = shapeToNode(s);
    const prevClusterId = prevNodeById.get(node.id)?.clusterId;
    return prevClusterId && clusterIds.has(prevClusterId) ? { ...node, clusterId: prevClusterId } : node;
  });
  const nodeIds = new Set(nodes.map((n) => n.id));
  // Drop edges whose endpoints were deleted; edges are otherwise IR-authoritative.
  const edges = prev.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
  const annotations = getAnnotationShapes(editor).map((s) => shapeToAnnotation(editor, s));

  return { nodes, edges, clusters, annotations };
}

export function CanvasView({
  diagram,
  templates,
  mode,
  onCanvasEdit,
  onSaveTemplate,
  onError,
}: {
  diagram: Diagram;
  templates: NamedTemplate[];
  mode: Mode;
  onCanvasEdit: (next: Diagram) => void;
  onSaveTemplate: (subtree: Diagram) => void;
  onError: (msg: string) => void;
}) {
  const editorRef = useRef<Editor | null>(null);
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;
  const onCanvasEditRef = useRef(onCanvasEdit);
  onCanvasEditRef.current = onCanvasEdit;
  const templatesRef = useRef(templates);
  templatesRef.current = templates;
  const onSaveTemplateRef = useRef(onSaveTemplate);
  onSaveTemplateRef.current = onSaveTemplate;
  const pendingSelectRef = useRef<string | null>(null);

  // The single selected object (drives the properties panel). Kept as kind+IR-id
  // so the panel can look the object up in the current diagram.
  const [selection, setSelection] = useState<{ kind: 'node' | 'edge' | 'cluster'; id: string } | null>(null);
  const selectedEdgeId = selection?.kind === 'edge' ? selection.id : null;
  const selectedEdgeIdRef = useRef<string | null>(null);
  selectedEdgeIdRef.current = selectedEdgeId;
  // Focus the label field as soon as a relationship is selected (including
  // right after connect-by-drag) so text can be typed onto it immediately.
  const edgeLabelRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectedEdgeId) edgeLabelRef.current?.focus();
  }, [selectedEdgeId]);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // ---- connect-by-drag: drag from a node's port onto another node to add an edge ----
  const [connectLine, setConnectLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const connectFromRef = useRef<string | null>(null);
  const connectRectRef = useRef<DOMRect | null>(null);
  const connectSrcRef = useRef<{ x: number; y: number } | null>(null);

  const onConnectMove = useCallback((ev: PointerEvent) => {
    const rect = connectRectRef.current;
    const src = connectSrcRef.current;
    if (!rect || !src) return;
    setConnectLine({ x1: src.x - rect.left, y1: src.y - rect.top, x2: ev.clientX - rect.left, y2: ev.clientY - rect.top });
  }, []);

  const onConnectUp = useCallback(
    (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onConnectMove);
      window.removeEventListener('pointerup', onConnectUp);
      const from = connectFromRef.current;
      const editor = editorRef.current;
      connectFromRef.current = null;
      setConnectLine(null);
      if (!from || !editor) return;
      const p = editor.screenToPage({ x: ev.clientX, y: ev.clientY });
      const target = diagramRef.current.nodes.find(
        (n) =>
          n.id !== from &&
          p.x >= n.x &&
          p.x <= n.x + NODE_DEFAULT_WIDTH &&
          p.y >= n.y &&
          p.y <= n.y + NODE_DEFAULT_HEIGHT,
      );
      if (!target) return;
      const edge = { id: shortId('edge'), from, to: target.id, direction: 'forward' as const };
      onCanvasEditRef.current({ ...diagramRef.current, edges: [...diagramRef.current.edges, edge] });
    },
    [onConnectMove],
  );

  const handlePointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      if (modeRef.current !== 'architect') return;
      const port = (e.target as HTMLElement).closest?.('[data-conn-port]');
      const editor = editorRef.current;
      if (!port || !editor) return;
      const nodeId = port.getAttribute('data-conn-node');
      const node = nodeId ? diagramRef.current.nodes.find((n) => n.id === nodeId) : undefined;
      if (!node) return;
      // Take over from tldraw so grabbing a port starts a connection, not a shape drag.
      e.preventDefault();
      e.stopPropagation();
      const center = { x: node.x + NODE_DEFAULT_WIDTH / 2, y: node.y + NODE_DEFAULT_HEIGHT / 2 };
      const src = editor.pageToScreen(center);
      const rect = e.currentTarget.getBoundingClientRect();
      connectFromRef.current = node.id;
      connectSrcRef.current = { x: src.x, y: src.y };
      connectRectRef.current = rect;
      setConnectLine({ x1: src.x - rect.left, y1: src.y - rect.top, x2: e.clientX - rect.left, y2: e.clientY - rect.top });
      window.addEventListener('pointermove', onConnectMove);
      window.addEventListener('pointerup', onConnectUp);
    },
    [onConnectMove, onConnectUp],
  );

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    reconcile(editor, diagramRef.current);

    editor.store.listen(() => onCanvasEditRef.current(assembleFromCanvas(editor, diagramRef.current)), {
      source: 'user',
      scope: 'document',
    });

    // Track the single selected object (drives the properties panel).
    react('selection', () => {
      const only = editor.getOnlySelectedShape();
      if (only?.type === 'archEdge') setSelection({ kind: 'edge', id: (only as ArchEdgeShape).props.edgeId });
      else if (only?.type === 'archNode') setSelection({ kind: 'node', id: (only as ArchNodeShape).props.nodeId });
      else if (only?.type === 'archCluster')
        setSelection({ kind: 'cluster', id: (only as ArchClusterShape).props.clusterId });
      else setSelection(null);
    });
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    reconcile(editor, diagram);
    // Select a just-connected edge so its label input appears.
    if (pendingSelectRef.current) {
      const shapeId = createShapeId(pendingSelectRef.current);
      if (editor.getShape(shapeId)) {
        editor.select(shapeId);
        pendingSelectRef.current = null;
      }
    }
  }, [diagram]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    const editor = editorRef.current;
    if (!editor) return;
    // Only claim drops that carry our payload; let tldraw handle image/file drops.
    const templateName = e.dataTransfer.getData(TEMPLATE_DND_MIME);
    const nodeType = e.dataTransfer.getData(NODE_TYPE_DND_MIME);
    if (!templateName && !nodeType) return;
    // Capture-phase + stopPropagation so tldraw's own drop handler (on the inner
    // canvas) doesn't swallow the event before we place the shape.
    e.preventDefault();
    e.stopPropagation();
    const point = editor.screenToPage({ x: e.clientX, y: e.clientY });

    // Instantiating a template dropped from the Templates panel.
    if (templateName) {
      const template = templatesRef.current.find((t) => t.name === templateName);
      if (!template) return;
      const inst = instantiateTemplate(template.diagram, { x: Math.round(point.x), y: Math.round(point.y) }, () =>
        shortId('el'),
      );
      const cur = diagramRef.current;
      onCanvasEditRef.current({
        nodes: [...cur.nodes, ...inst.nodes],
        edges: [...cur.edges, ...inst.edges],
        clusters: [...cur.clusters, ...inst.clusters],
        annotations: cur.annotations,
      });
      return;
    }

    // Dropping a node type from the shape library.
    const def = NODE_TAXONOMY.find((n) => n.id === nodeType);
    if (!def) return;
    const node: DiagramNode = {
      id: shortId('node'),
      type: def.id,
      label: def.displayName,
      x: Math.round(point.x - NODE_DEFAULT_WIDTH / 2),
      y: Math.round(point.y - NODE_DEFAULT_HEIGHT / 2),
    };
    onCanvasEditRef.current({ ...diagramRef.current, nodes: [...diagramRef.current.nodes, node] });
  }, []);

  const handleSaveTemplate = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const ids = new Set(selectedNodes(editor).map((s) => s.props.nodeId));
    if (ids.size < 2) return;
    onSaveTemplateRef.current(extractTemplate(diagramRef.current, ids));
  }, []);

  const handleGroup = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = selectedNodes(editor);
    if (selected.length < 2) return;

    const pad = 28;
    const minX = Math.min(...selected.map((s) => s.x)) - pad;
    const minY = Math.min(...selected.map((s) => s.y)) - pad;
    const maxX = Math.max(...selected.map((s) => s.x + s.props.w)) + pad;
    const maxY = Math.max(...selected.map((s) => s.y + s.props.h)) + pad;
    const clusterId = shortId('cluster');
    const cluster: DiagramCluster = {
      id: clusterId,
      label: 'New cluster',
      x: Math.round(minX),
      y: Math.round(minY),
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
    };
    const selIds = new Set(selected.map((s) => s.props.nodeId));
    const nodes = diagramRef.current.nodes.map((n) => (selIds.has(n.id) ? { ...n, clusterId } : n));
    onCanvasEditRef.current({ ...diagramRef.current, nodes, clusters: [...diagramRef.current.clusters, cluster] });
  }, []);

  const handleConnect = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = selectedNodes(editor);
    if (selected.length !== 2) return; // connect exactly two
    const [a, b] = selected;
    const edgeId = shortId('edge');
    pendingSelectRef.current = edgeId;
    // Show the properties panel immediately (deterministic), rather than waiting
    // on tldraw's selection reaction; the effect below also selects the shape on
    // the canvas for the visual highlight.
    setSelection({ kind: 'edge', id: edgeId });
    onCanvasEditRef.current({
      ...diagramRef.current,
      edges: [
        ...diagramRef.current.edges,
        { id: edgeId, from: a.props.nodeId, to: b.props.nodeId, direction: 'forward' as const },
      ],
    });
  }, []);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const handleExport = useCallback(async (format: 'png' | 'svg') => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const ids = [...editor.getCurrentPageShapeIds()];
      if (ids.length === 0) {
        onErrorRef.current('Nothing to export — the canvas is empty.');
        return;
      }
      const blob = await exportToBlob({ editor, ids, format });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      await window.solarchitect.exportImage(base64, `diagram.${format}`);
    } catch (e) {
      onErrorRef.current(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  // Apply a partial change to the currently selected edge and sync it out.
  const patchSelectedEdge = useCallback((patch: Partial<DiagramEdge>) => {
    if (!selectedEdgeIdRef.current) return;
    const edges = diagramRef.current.edges.map((e) =>
      e.id === selectedEdgeIdRef.current ? { ...e, ...patch } : e,
    );
    onCanvasEditRef.current({ ...diagramRef.current, edges });
  }, []);

  const handleLabelChange = useCallback((label: string) => patchSelectedEdge({ label }), [patchSelectedEdge]);
  const handleEdgeShape = useCallback(
    (shape: EdgeShapeKind) => patchSelectedEdge({ shape }),
    [patchSelectedEdge],
  );
  const handleEdgeLineStyle = useCallback(
    (lineStyle: EdgeLineStyle) => patchSelectedEdge({ lineStyle }),
    [patchSelectedEdge],
  );
  const handleEdgeArrow = useCallback((arrow: boolean) => patchSelectedEdge({ arrow }), [patchSelectedEdge]);

  const patchNode = useCallback((id: string, patch: Partial<DiagramNode>) => {
    const nodes = diagramRef.current.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    onCanvasEditRef.current({ ...diagramRef.current, nodes });
  }, []);
  const patchCluster = useCallback((id: string, patch: Partial<DiagramCluster>) => {
    const clusters = diagramRef.current.clusters.map((c) => (c.id === id ? { ...c, ...patch } : c));
    onCanvasEditRef.current({ ...diagramRef.current, clusters });
  }, []);

  const selectedEdge = diagram.edges.find((e) => e.id === selectedEdgeId);
  const selectedEdgeLabel = selectedEdge?.label ?? '';
  const selectedEdgeShape = selectedEdge?.shape ?? 'straight';
  const selectedEdgeLineStyle = selectedEdge?.lineStyle ?? 'solid';
  const selectedEdgeArrow = selectedEdge?.arrow ?? true;
  const selectedNode = selection?.kind === 'node' ? diagram.nodes.find((n) => n.id === selection.id) : undefined;
  const selectedCluster =
    selection?.kind === 'cluster' ? diagram.clusters.find((c) => c.id === selection.id) : undefined;

  return (
    <div
      className={`canvas${mode === 'architect' ? ' connect-enabled' : ''}`}
      data-testid="canvas-drop"
      onPointerDownCapture={handlePointerDownCapture}
      onDragOverCapture={(e) => {
        if (e.dataTransfer.types.some((t) => t === NODE_TYPE_DND_MIME || t === TEMPLATE_DND_MIME)) {
          e.preventDefault();
        }
      }}
      onDropCapture={handleDrop}
    >
      <div className="canvas-toolbar">
        {mode === 'architect' && (
          <>
            <button data-testid="connect-btn" onClick={handleConnect} className="btn btn--sm">
              Connect
            </button>
            <button data-testid="group-btn" onClick={handleGroup} className="btn btn--sm">
              Group
            </button>
            <span className="sep" />
            <button data-testid="save-template-btn" onClick={handleSaveTemplate} className="btn btn--sm">
              Save as Template
            </button>
            <span className="sep" />
          </>
        )}
        <button data-testid="export-png-btn" onClick={() => handleExport('png')} className="btn btn--sm">
          Export PNG
        </button>
        <button data-testid="export-svg-btn" onClick={() => handleExport('svg')} className="btn btn--sm">
          Export SVG
        </button>
      </div>

      {mode === 'architect' && (selectedEdge || selectedNode || selectedCluster) && (
        <aside className="props-panel" data-testid="props-panel" aria-label="Properties">
          {selectedNode && (
            <>
              <div className="props-panel__title">Component</div>
              <label className="props-field">
                <span className="props-field__label">Label</span>
                <input
                  data-testid="prop-node-label"
                  className="props-input"
                  value={selectedNode.label}
                  onChange={(e) => patchNode(selectedNode.id, { label: e.target.value })}
                />
              </label>
              <div className="props-field__hint">{selectedNode.type}</div>
            </>
          )}

          {selectedCluster && (
            <>
              <div className="props-panel__title">Group</div>
              <label className="props-field">
                <span className="props-field__label">Label</span>
                <input
                  data-testid="prop-cluster-label"
                  className="props-input"
                  value={selectedCluster.label}
                  onChange={(e) => patchCluster(selectedCluster.id, { label: e.target.value })}
                />
              </label>
              <div className="props-field">
                <span className="props-field__label">Color</span>
                <div className="swatches" role="group" aria-label="Group color">
                  {CLUSTER_COLORS.map((col) => (
                    <button
                      key={col}
                      data-testid={`prop-cluster-color-${col}`}
                      className={`swatch${(selectedCluster.color ?? 'blueprint') === col ? ' on' : ''}`}
                      style={{ background: CLUSTER_COLOR_STYLE[col].border }}
                      title={col}
                      aria-label={col}
                      onClick={() => patchCluster(selectedCluster.id, { color: col })}
                    />
                  ))}
                </div>
              </div>
              <div className="props-field__hint">Drag the handles to resize.</div>
            </>
          )}

          {selectedEdge && (
            <>
              <div className="props-panel__title">Relationship</div>
              <label className="props-field">
                <span className="props-field__label">Label</span>
                <input
                  ref={edgeLabelRef}
                  data-testid="edge-label-input"
                  aria-label="Edge label"
                  className="props-input"
                  placeholder="Label this relationship…"
                  value={selectedEdgeLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                />
              </label>
              <div className="props-field">
                <span className="props-field__label">Routing</span>
                <span className="edge-shapes" role="group" aria-label="Edge routing">
                  {(['straight', 'curved', 'bent'] as const).map((k) => (
                    <button
                      key={k}
                      data-testid={`edge-shape-${k}`}
                      className={`edge-shape-btn${selectedEdgeShape === k ? ' on' : ''}`}
                      title={`${k[0].toUpperCase()}${k.slice(1)} routing`}
                      onClick={() => handleEdgeShape(k)}
                    >
                      <EdgeShapeGlyph kind={k} />
                    </button>
                  ))}
                </span>
              </div>
              <div className="props-field">
                <span className="props-field__label">Line</span>
                <span className="edge-shapes" role="group" aria-label="Line style">
                  {(['solid', 'dashed', 'dotted'] as const).map((k) => (
                    <button
                      key={k}
                      data-testid={`edge-line-${k}`}
                      className={`edge-shape-btn${selectedEdgeLineStyle === k ? ' on' : ''}`}
                      title={`${k[0].toUpperCase()}${k.slice(1)} line`}
                      onClick={() => handleEdgeLineStyle(k)}
                    >
                      <LineStyleGlyph kind={k} />
                    </button>
                  ))}
                </span>
              </div>
              <div className="props-field">
                <span className="props-field__label">Arrow</span>
                <span className="edge-shapes" role="group" aria-label="Arrowhead">
                  <button
                    data-testid="edge-arrow-toggle"
                    className={`edge-shape-btn${selectedEdgeArrow ? ' on' : ''}`}
                    aria-pressed={selectedEdgeArrow}
                    title={selectedEdgeArrow ? 'Arrowhead shown — click to hide' : 'No arrowhead — click to show'}
                    onClick={() => handleEdgeArrow(!selectedEdgeArrow)}
                  >
                    <ArrowGlyph on={selectedEdgeArrow} />
                  </button>
                  <button
                    data-testid="edge-direction-toggle"
                    className={`edge-shape-btn${selectedEdge.direction === 'bidirectional' ? ' on' : ''}`}
                    aria-pressed={selectedEdge.direction === 'bidirectional'}
                    title={selectedEdge.direction === 'bidirectional' ? 'Bidirectional' : 'One-way'}
                    onClick={() =>
                      patchSelectedEdge({
                        direction: selectedEdge.direction === 'bidirectional' ? 'forward' : 'bidirectional',
                      })
                    }
                  >
                    ⇌
                  </button>
                </span>
              </div>
            </>
          )}
        </aside>
      )}

      <Tldraw
        assetUrls={assetUrls}
        shapeUtils={shapeUtils}
        components={mode === 'architect' ? ARCHITECT_COMPONENTS : WHITEBOARD_COMPONENTS}
        onMount={handleMount}
      />
      {connectLine && (
        <svg className="connect-overlay" aria-hidden="true">
          <defs>
            <marker id="connect-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
              <path d="M0,0 L7,3 L0,6 Z" fill="var(--sync)" />
            </marker>
          </defs>
          <line
            x1={connectLine.x1}
            y1={connectLine.y1}
            x2={connectLine.x2}
            y2={connectLine.y2}
            stroke="var(--sync)"
            strokeWidth={2}
            strokeDasharray="5 4"
            markerEnd="url(#connect-arrow)"
          />
        </svg>
      )}
    </div>
  );
}
