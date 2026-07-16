import { Tldraw, react, createShapeId, exportToBlob, Box, type Editor, type TLShapePartial } from 'tldraw';
import 'tldraw/tldraw.css';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NodeShapeUtil, NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, type ArchNodeShape } from './NodeShapeUtil';
import { ClusterShapeUtil, CLUSTER_COLOR_STYLE, type ArchClusterShape } from './ClusterShapeUtil';
import { FrameShapeUtil, type ArchFrameShape } from './FrameShapeUtil';
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
  framesToShapes,
  frameToShape,
  shapeToFrame,
  getArchFrameShapes,
  edgeToShape,
  getArchEdgeShapes,
  edgeShapesEqual,
} from './shapeAdapters';
import { getAnnotationShapes, annotationToShape, shapeToAnnotation, annotationEq } from './annotationAdapters';
import { diffById } from '@shared/sync/diff';
import { extractTemplate, instantiateTemplate } from '@shared/templates/templates';
import type { NamedTemplate } from '@shared/templates/templatesFile';
import { NODE_TAXONOMY } from '@shared/ir/taxonomy';
import { CLUSTER_COLORS, ACCENT_COLORS } from '@shared/ir/types';
import { FRAME_PRESETS, CUSTOM_FRAME } from '@shared/ir/frames';
import { ACCENT_HEX } from './accent';
import { resolveNodePositions } from '@shared/ir/layout';
import type {
  Diagram,
  DiagramNode,
  DiagramCluster,
  DiagramEdge,
  DiagramFrame,
  AccentColor,
  EdgeShape as EdgeShapeKind,
  EdgeLineStyle,
} from '@shared/ir/types';

const assetUrls = getAssetUrlsByImport();
const shapeUtils = [FrameShapeUtil, ClusterShapeUtil, EdgeShapeUtil, NodeShapeUtil];

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

/** Accent-color picker with a leading "black & white" (none) option. */
function ColorSwatches({ value, onPick }: { value: AccentColor | 'none'; onPick: (c: AccentColor | 'none') => void }) {
  return (
    <div className="swatches" role="group" aria-label="Color">
      <button
        type="button"
        data-testid="color-none"
        className={`swatch swatch--none${value === 'none' ? ' on' : ''}`}
        title="Black & white"
        aria-label="Black and white"
        onClick={() => onPick('none')}
      />
      {ACCENT_COLORS.map((col) => (
        <button
          type="button"
          key={col}
          data-testid={`color-${col}`}
          className={`swatch${value === col ? ' on' : ''}`}
          style={{ background: ACCENT_HEX[col] }}
          title={col}
          aria-label={col}
          onClick={() => onPick(col)}
        />
      ))}
    </div>
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

/** Monochrome icons for the canvas action toolbar. */
const TOOL_ICONS = {
  connect: (
    <>
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <path d="M8 16 L16 8" />
    </>
  ),
  group: <rect x="4" y="6" width="16" height="12" rx="2" strokeDasharray="3 2.4" />,
  template: <path d="M7 4h10v16l-5-3.6L7 20z" />,
  frame: (
    <>
      <rect x="4" y="5.5" width="16" height="13" rx="1.5" />
      <path d="M4 9.2h16" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v10" />
      <path d="M8 9l4 4 4-4" />
      <path d="M5 20h14" />
    </>
  ),
} as const;

function ToolIcon({ name }: { name: keyof typeof TOOL_ICONS }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TOOL_ICONS[name]}
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
function reconcile(editor: Editor, diagram: Diagram, showAnnotations: boolean): void {
  editor.store.mergeRemoteChanges(() => {
    // Frames (print pages — drawn behind everything).
    const frames = diagram.frames ?? [];
    const currentFrames: DiagramFrame[] = getArchFrameShapes(editor).map(shapeToFrame);
    const frameEq = (a: DiagramFrame, b: DiagramFrame) =>
      a.label === b.label && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
    const df = diffById(currentFrames, frames, frameEq);
    if (df.removeIds.length) editor.deleteShapes(df.removeIds.map((id) => createShapeId(id)));
    if (df.add.length) editor.createShapes(framesToShapes(df.add));
    df.update.forEach((f) => editor.updateShape(frameToShape(f)));

    // Clusters (drawn behind everything but frames).
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

    // Resolve coordinate-free nodes to concrete positions before anything reads
    // them (edges need node centers; the canvas can't hold undefined x/y).
    const positionedNodes = resolveNodePositions(diagram);

    // Edges (derived shapes between node centers).
    const nodeById = new Map(positionedNodes.map((n) => [n.id, n]));
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

    // Nodes (drawn on top). Use the position-resolved list so every node has x/y.
    const currentNodes = getArchNodeShapes(editor).map(shapeToNode);
    const nodeEq = (a: DiagramNode, b: DiagramNode) =>
      a.type === b.type &&
      a.label === b.label &&
      a.x === b.x &&
      a.y === b.y &&
      (a.color ?? 'none') === (b.color ?? 'none');
    const dn = diffById(currentNodes, positionedNodes, nodeEq);
    if (dn.removeIds.length) editor.deleteShapes(dn.removeIds.map((id) => createShapeId(id)));
    if (dn.add.length) editor.createShapes(nodesToShapes(dn.add));
    dn.update.forEach((n) =>
      editor.updateShape({ id: createShapeId(n.id), type: 'archNode', x: n.x, y: n.y, props: nodeToShapeProps(n) }),
    );

    // Annotations (tldraw-native note/geo/text shapes) live only on the
    // Whiteboard. In Architect the surface is strictly structured, so any
    // annotation shapes are removed from the canvas (they stay in the IR and
    // reappear on the Whiteboard).
    const currentAnnotations = getAnnotationShapes(editor).map((s) => shapeToAnnotation(editor, s));
    if (showAnnotations) {
      const da = diffById(currentAnnotations, diagram.annotations, annotationEq);
      if (da.removeIds.length) editor.deleteShapes(da.removeIds.map((id) => createShapeId(id)));
      if (da.add.length) editor.createShapes(da.add.map(annotationToShape));
      da.update.forEach((a) => editor.updateShape(annotationToShape(a)));
    } else if (currentAnnotations.length) {
      editor.deleteShapes(getAnnotationShapes(editor).map((s) => s.id));
    }

    // Enforce paint order after any additions: frames at the very back, then
    // clusters, then edges, then nodes on top. (New shapes otherwise land on
    // top of their neighbours.)
    if (df.add.length || dc.add.length || dn.add.length || desiredEdges.some((s) => !currentEdgeById.has(s.id))) {
      const clusterIds = getArchClusterShapes(editor).map((s) => s.id);
      const frameIds = getArchFrameShapes(editor).map((s) => s.id);
      const nodeIds = getArchNodeShapes(editor).map((s) => s.id);
      if (clusterIds.length) editor.sendToBack(clusterIds);
      if (frameIds.length) editor.sendToBack(frameIds); // frames end up behind clusters
      if (nodeIds.length) editor.bringToFront(nodeIds);
    }
  });
}

/** Rebuild a consistent IR from the current canvas shapes (after a user move/delete). */
function assembleFromCanvas(editor: Editor, prev: Diagram, readAnnotations: boolean): Diagram {
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
  // Annotations are only on-canvas in Whiteboard; in Architect they aren't
  // rendered, so preserve the prior ones rather than reading an empty canvas.
  const annotations = readAnnotations
    ? getAnnotationShapes(editor).map((s) => shapeToAnnotation(editor, s))
    : prev.annotations;
  const frames = getArchFrameShapes(editor).map(shapeToFrame);

  return { nodes, edges, clusters, annotations, frames };
}

export function CanvasView({
  diagram,
  templates,
  mode,
  onCanvasEdit,
  onSaveTemplate,
  onError,
  animate = false,
  presenting = false,
  presentIndex = 0,
}: {
  diagram: Diagram;
  templates: NamedTemplate[];
  mode: Mode;
  animate?: boolean;
  presenting?: boolean;
  presentIndex?: number;
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
  const [selection, setSelection] = useState<{ kind: 'node' | 'edge' | 'cluster' | 'frame'; id: string } | null>(
    null,
  );
  const [frameMenuOpen, setFrameMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  // All currently-selected node ids (for assigning a color to several at once).
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
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
          n.x !== undefined &&
          n.y !== undefined &&
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
      const center = { x: (node.x ?? 0) + NODE_DEFAULT_WIDTH / 2, y: (node.y ?? 0) + NODE_DEFAULT_HEIGHT / 2 };
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
    reconcile(editor, diagramRef.current, modeRef.current === 'whiteboard');

    editor.store.listen(
      () =>
        onCanvasEditRef.current(assembleFromCanvas(editor, diagramRef.current, modeRef.current === 'whiteboard')),
      {
        source: 'user',
        scope: 'document',
      },
    );

    // Track the single selected object (drives the properties panel).
    react('selection', () => {
      const only = editor.getOnlySelectedShape();
      if (only?.type === 'archEdge') setSelection({ kind: 'edge', id: (only as ArchEdgeShape).props.edgeId });
      else if (only?.type === 'archNode') setSelection({ kind: 'node', id: (only as ArchNodeShape).props.nodeId });
      else if (only?.type === 'archCluster')
        setSelection({ kind: 'cluster', id: (only as ArchClusterShape).props.clusterId });
      else if (only?.type === 'archFrame')
        setSelection({ kind: 'frame', id: (only as ArchFrameShape).props.frameId });
      else setSelection(null);
      setSelectedNodeIds(
        editor
          .getSelectedShapes()
          .filter((s): s is ArchNodeShape => s.type === 'archNode')
          .map((s) => s.props.nodeId),
      );
    });
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    reconcile(editor, diagram, mode === 'whiteboard');
    // Select a just-connected edge so its label input appears.
    if (pendingSelectRef.current) {
      const shapeId = createShapeId(pendingSelectRef.current);
      if (editor.getShape(shapeId)) {
        editor.select(shapeId);
        pendingSelectRef.current = null;
      }
    }
    // `mode` is a dep so switching Architect/Whiteboard re-reconciles annotations.
  }, [diagram, mode]);

  // Presentation: fit the camera to the current page frame (or the whole
  // diagram when there are no frames) whenever presenting or the index changes.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !presenting) return;
    editor.selectNone();
    const frames = diagramRef.current.frames ?? [];
    if (frames.length) {
      const f = frames[Math.min(presentIndex, frames.length - 1)];
      editor.zoomToBounds(new Box(f.x, f.y, f.width, f.height), { inset: 48, animation: { duration: 350 } });
    } else {
      editor.zoomToFit({ animation: { duration: 350 } });
    }
  }, [presenting, presentIndex]);

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
        frames: cur.frames,
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
  // Assign (or clear, when 'none') an accent color across one or more nodes.
  const setNodesColor = useCallback((ids: string[], color: AccentColor | 'none') => {
    const set = new Set(ids);
    const nodes = diagramRef.current.nodes.map((n) => {
      if (!set.has(n.id)) return n;
      if (color === 'none') {
        const { color: _drop, ...rest } = n;
        return rest;
      }
      return { ...n, color };
    });
    onCanvasEditRef.current({ ...diagramRef.current, nodes });
  }, []);
  const patchCluster = useCallback((id: string, patch: Partial<DiagramCluster>) => {
    const clusters = diagramRef.current.clusters.map((c) => (c.id === id ? { ...c, ...patch } : c));
    onCanvasEditRef.current({ ...diagramRef.current, clusters });
  }, []);
  const patchFrame = useCallback((id: string, patch: Partial<DiagramFrame>) => {
    const frames = (diagramRef.current.frames ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f));
    onCanvasEditRef.current({ ...diagramRef.current, frames });
  }, []);

  // Add a frame from a preset (or a default custom size), placed at the current
  // viewport's top-left so it lands in view.
  const handleAddFrame = useCallback((presetId: string) => {
    const editor = editorRef.current;
    const preset = FRAME_PRESETS.find((p) => p.id === presetId);
    const width = preset?.width ?? CUSTOM_FRAME.width;
    const height = preset?.height ?? CUSTOM_FRAME.height;
    const tl = editor ? editor.screenToPage({ x: 0, y: 0 }) : { x: 0, y: 0 };
    const frame: DiagramFrame = {
      id: shortId('frame'),
      label: preset?.label ?? 'Page',
      x: Math.round(tl.x + 60),
      y: Math.round(tl.y + 60),
      width,
      height,
      preset: preset?.id ?? 'custom',
    };
    const cur = diagramRef.current;
    onCanvasEditRef.current({ ...cur, frames: [...(cur.frames ?? []), frame] });
  }, []);

  // Export just one frame's region as an image (the "print" path).
  const handleExportFrame = useCallback(async (frame: DiagramFrame, format: 'png' | 'svg') => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const ids = [...editor.getCurrentPageShapeIds()];
      if (ids.length === 0) {
        onErrorRef.current('Nothing to export — the canvas is empty.');
        return;
      }
      const bounds = new Box(frame.x, frame.y, frame.width, frame.height);
      const blob = await exportToBlob({ editor, ids, format, opts: { bounds, background: true, padding: 0 } });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const safe = frame.label.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'frame';
      await window.solarchitect.exportImage(btoa(binary), `${safe}.${format}`);
    } catch (e) {
      onErrorRef.current(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const selectedEdge = diagram.edges.find((e) => e.id === selectedEdgeId);
  const selectedEdgeLabel = selectedEdge?.label ?? '';
  const selectedEdgeShape = selectedEdge?.shape ?? 'straight';
  const selectedEdgeLineStyle = selectedEdge?.lineStyle ?? 'solid';
  const selectedEdgeArrow = selectedEdge?.arrow ?? true;
  const selectedNode = selection?.kind === 'node' ? diagram.nodes.find((n) => n.id === selection.id) : undefined;
  const selectedCluster =
    selection?.kind === 'cluster' ? diagram.clusters.find((c) => c.id === selection.id) : undefined;
  const selectedFrame =
    selection?.kind === 'frame' ? (diagram.frames ?? []).find((f) => f.id === selection.id) : undefined;

  return (
    <div
      className={`canvas${mode === 'architect' && !presenting ? ' connect-enabled' : ''}${animate ? ' animate-on' : ''}${presenting ? ' presenting' : ''}`}
      data-testid="canvas-drop"
      onPointerDownCapture={handlePointerDownCapture}
      onDragOverCapture={(e) => {
        if (e.dataTransfer.types.some((t) => t === NODE_TYPE_DND_MIME || t === TEMPLATE_DND_MIME)) {
          e.preventDefault();
        }
      }}
      onDropCapture={handleDrop}
    >
      {!presenting && (
      <div className="canvas-toolbar">
        {mode === 'architect' && (
          <>
            <button data-testid="connect-btn" onClick={handleConnect} className="btn btn--sm">
              <ToolIcon name="connect" />
              Connect
            </button>
            <button data-testid="group-btn" onClick={handleGroup} className="btn btn--sm">
              <ToolIcon name="group" />
              Group
            </button>
            <span className="sep" />
            <button data-testid="save-template-btn" onClick={handleSaveTemplate} className="btn btn--sm">
              <ToolIcon name="template" />
              Template
            </button>
            <div className="frame-menu">
              <button
                data-testid="add-frame-btn"
                className="btn btn--sm"
                aria-expanded={frameMenuOpen}
                onClick={() => {
                  setExportMenuOpen(false);
                  setFrameMenuOpen((v) => !v);
                }}
              >
                <ToolIcon name="frame" />
                Frame ▾
              </button>
              {frameMenuOpen && (
                <div className="frame-menu__list" role="menu">
                  {FRAME_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      role="menuitem"
                      data-testid={`add-frame-${p.id}`}
                      className="frame-menu__item"
                      onClick={() => {
                        handleAddFrame(p.id);
                        setFrameMenuOpen(false);
                      }}
                    >
                      <span>{p.label}</span>
                      <span className="frame-menu__dim">
                        {p.width}×{p.height}
                      </span>
                    </button>
                  ))}
                  <button
                    role="menuitem"
                    data-testid="add-frame-custom"
                    className="frame-menu__item"
                    onClick={() => {
                      handleAddFrame('custom');
                      setFrameMenuOpen(false);
                    }}
                  >
                    <span>Custom</span>
                    <span className="frame-menu__dim">resize</span>
                  </button>
                </div>
              )}
            </div>
            <span className="sep" />
          </>
        )}
        <div className="frame-menu">
          <button
            data-testid="export-btn"
            className="btn btn--sm"
            aria-expanded={exportMenuOpen}
            onClick={() => {
              setFrameMenuOpen(false);
              setExportMenuOpen((v) => !v);
            }}
          >
            <ToolIcon name="export" />
            Export ▾
          </button>
          {exportMenuOpen && (
            <div className="frame-menu__list" role="menu">
              <button
                role="menuitem"
                data-testid="export-png-btn"
                className="frame-menu__item"
                onClick={() => {
                  setExportMenuOpen(false);
                  void handleExport('png');
                }}
              >
                <span>PNG image</span>
                <span className="frame-menu__dim">.png</span>
              </button>
              <button
                role="menuitem"
                data-testid="export-svg-btn"
                className="frame-menu__item"
                onClick={() => {
                  setExportMenuOpen(false);
                  void handleExport('svg');
                }}
              >
                <span>SVG vector</span>
                <span className="frame-menu__dim">.svg</span>
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {!presenting && mode === 'architect' && selectedNodeIds.length >= 2 && (
        <aside className="props-panel" data-testid="props-panel-multi" aria-label="Properties">
          <div className="props-panel__title">{selectedNodeIds.length} components</div>
          <div className="props-field">
            <span className="props-field__label">Color</span>
            <ColorSwatches value="none" onPick={(c) => setNodesColor(selectedNodeIds, c)} />
          </div>
          <div className="props-field__hint">Applies to all selected components.</div>
        </aside>
      )}

      {!presenting &&
        mode === 'architect' &&
        selectedNodeIds.length < 2 &&
        (selectedEdge || selectedNode || selectedCluster || selectedFrame) && (
        <aside className="props-panel" data-testid="props-panel" aria-label="Properties">
          {selectedFrame && (
            <>
              <div className="props-panel__title">Page</div>
              <label className="props-field">
                <span className="props-field__label">Label</span>
                <input
                  data-testid="prop-frame-label"
                  className="props-input"
                  value={selectedFrame.label}
                  onChange={(e) => patchFrame(selectedFrame.id, { label: e.target.value })}
                />
              </label>
              <div className="props-field__hint">
                {Math.round(selectedFrame.width)}×{Math.round(selectedFrame.height)} px · drag handles to resize
              </div>
              <div className="props-field">
                <span className="props-field__label">Export page</span>
                <div className="props-btn-row">
                  <button
                    data-testid="frame-export-png"
                    className="btn btn--sm"
                    onClick={() => handleExportFrame(selectedFrame, 'png')}
                  >
                    PNG
                  </button>
                  <button
                    data-testid="frame-export-svg"
                    className="btn btn--sm"
                    onClick={() => handleExportFrame(selectedFrame, 'svg')}
                  >
                    SVG
                  </button>
                </div>
              </div>
            </>
          )}

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
              <div className="props-field">
                <span className="props-field__label">Color</span>
                <ColorSwatches
                  value={selectedNode.color ?? 'none'}
                  onPick={(c) => setNodesColor([selectedNode.id], c)}
                />
              </div>
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
