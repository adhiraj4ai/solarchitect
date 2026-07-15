import { Tldraw, react, createShapeId, exportToBlob, type Editor, type TLShapePartial } from 'tldraw';
import 'tldraw/tldraw.css';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NodeShapeUtil, NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, type ArchNodeShape } from './NodeShapeUtil';
import { ClusterShapeUtil } from './ClusterShapeUtil';
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
import type { Diagram, DiagramNode, DiagramCluster, EdgeShape as EdgeShapeKind } from '@shared/ir/types';

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
      a.label === b.label && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
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

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const selectedEdgeIdRef = useRef(selectedEdgeId);
  selectedEdgeIdRef.current = selectedEdgeId;
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

    // Track whether the single selected shape is an edge (drives the label input).
    react('selected-edge', () => {
      const only = editor.getOnlySelectedShape();
      setSelectedEdgeId(only?.type === 'archEdge' ? (only as ArchEdgeShape).props.edgeId : null);
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
    // Show the label input immediately (deterministic), rather than waiting on
    // tldraw's selection reaction; the effect below also selects the shape on
    // the canvas for the visual highlight.
    setSelectedEdgeId(edgeId);
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

  const handleLabelChange = useCallback((label: string) => {
    if (!selectedEdgeIdRef.current) return;
    const edges = diagramRef.current.edges.map((e) =>
      e.id === selectedEdgeIdRef.current ? { ...e, label } : e,
    );
    onCanvasEditRef.current({ ...diagramRef.current, edges });
  }, []);

  const handleEdgeShape = useCallback((edgeShape: EdgeShapeKind) => {
    if (!selectedEdgeIdRef.current) return;
    const edges = diagramRef.current.edges.map((e) =>
      e.id === selectedEdgeIdRef.current ? { ...e, shape: edgeShape } : e,
    );
    onCanvasEditRef.current({ ...diagramRef.current, edges });
  }, []);

  const selectedEdge = diagram.edges.find((e) => e.id === selectedEdgeId);
  const selectedEdgeLabel = selectedEdge?.label ?? '';
  const selectedEdgeShape = selectedEdge?.shape ?? 'straight';

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
        {selectedEdgeId && (
          <>
            <input
              data-testid="edge-label-input"
              aria-label="Edge label"
              className="edge-label"
              placeholder="edge label"
              value={selectedEdgeLabel}
              onChange={(e) => handleLabelChange(e.target.value)}
            />
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
          </>
        )}
      </div>
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
