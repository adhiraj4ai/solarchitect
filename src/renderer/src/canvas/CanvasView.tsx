import { Tldraw, createShapeId, type Editor, type TLShapePartial } from 'tldraw';
import 'tldraw/tldraw.css';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { useCallback, useEffect, useRef } from 'react';
import { NodeShapeUtil, NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, type ArchNodeShape } from './NodeShapeUtil';
import { ClusterShapeUtil } from './ClusterShapeUtil';
import { EdgeShapeUtil } from './EdgeShapeUtil';
import { NODE_TYPE_DND_MIME } from './NodePalette';
import {
  nodesToShapes,
  nodeToShapeProps,
  getArchNodeShapes,
  shapeToNode,
  clustersToShapes,
  getArchClusterShapes,
  clusterToShapePatch,
  edgeToShape,
  getArchEdgeShapes,
} from './shapeAdapters';
import { diffById } from '@shared/sync/diff';
import { NODE_TAXONOMY } from '@shared/ir/taxonomy';
import type { Diagram, DiagramNode, DiagramCluster } from '@shared/ir/types';

const assetUrls = getAssetUrlsByImport();
const shapeUtils = [ClusterShapeUtil, EdgeShapeUtil, NodeShapeUtil];

function shortId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function selectedNodes(editor: Editor): ArchNodeShape[] {
  return editor.getSelectedShapes().filter((s): s is ArchNodeShape => s.type === 'archNode');
}

function reconcile(editor: Editor, diagram: Diagram): void {
  // Clusters (drawn behind nodes).
  const currentClusters: DiagramCluster[] = getArchClusterShapes(editor).map((s) => ({
    id: s.props.clusterId,
    label: s.props.label,
    x: s.x,
    y: s.y,
    width: s.props.w,
    height: s.props.h,
  }));
  const clusterEq = (a: DiagramCluster, b: DiagramCluster) =>
    a.label === b.label && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  const dc = diffById(currentClusters, diagram.clusters, clusterEq);
  if (dc.removeIds.length) editor.deleteShapes(dc.removeIds.map((id) => createShapeId(id)));
  if (dc.add.length) editor.createShapes(clustersToShapes(dc.add));
  dc.update.forEach((c) => editor.updateShape(clusterToShapePatch(c)));

  // Edges (derived shapes running between node centers).
  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
  const desiredEdges = diagram.edges
    .map((e) => edgeToShape(e, nodeById))
    .filter((s): s is TLShapePartial => s !== null);
  const desiredEdgeById = new Map(desiredEdges.map((s) => [s.id, s]));
  const currentEdges = getArchEdgeShapes(editor);
  const currentEdgeIds = new Set(currentEdges.map((s) => s.id));
  const edgesToRemove = currentEdges.filter((s) => !desiredEdgeById.has(s.id)).map((s) => s.id);
  if (edgesToRemove.length) editor.deleteShapes(edgesToRemove);
  const edgesToAdd = desiredEdges.filter((s) => !currentEdgeIds.has(s.id));
  if (edgesToAdd.length) editor.createShapes(edgesToAdd);
  for (const desired of desiredEdges) {
    const cur = currentEdges.find((c) => c.id === desired.id);
    if (!cur) continue;
    const curKey = JSON.stringify({ x: cur.x, y: cur.y, props: cur.props });
    const wantKey = JSON.stringify({ x: desired.x, y: desired.y, props: desired.props });
    if (curKey !== wantKey) editor.updateShape(desired);
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
}

/** Rebuild a consistent IR from the current canvas shapes (after a user move/delete). */
function assembleFromCanvas(editor: Editor, prev: Diagram): Diagram {
  const clusterShapes = getArchClusterShapes(editor);
  const clusterIds = new Set(clusterShapes.map((s) => s.props.clusterId));
  const prevNodeById = new Map(prev.nodes.map((n) => [n.id, n]));

  const nodes = getArchNodeShapes(editor).map((s) => {
    const node = shapeToNode(s);
    const prevClusterId = prevNodeById.get(node.id)?.clusterId;
    return prevClusterId && clusterIds.has(prevClusterId) ? { ...node, clusterId: prevClusterId } : node;
  });
  const nodeIds = new Set(nodes.map((n) => n.id));

  const clusters = clusterShapes.map((s) => ({
    id: s.props.clusterId,
    label: s.props.label,
    x: s.x,
    y: s.y,
    width: s.props.w,
    height: s.props.h,
  }));
  // Drop edges whose endpoints were deleted; keep the rest (edges are IR-authoritative).
  const edges = prev.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

  return { nodes, edges, clusters, annotations: prev.annotations };
}

export function CanvasView({
  diagram,
  onCanvasEdit,
}: {
  diagram: Diagram;
  onCanvasEdit: (next: Diagram) => void;
}) {
  const editorRef = useRef<Editor | null>(null);
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;
  const onCanvasEditRef = useRef(onCanvasEdit);
  onCanvasEditRef.current = onCanvasEdit;

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    reconcile(editor, diagramRef.current);

    editor.store.listen(() => onCanvasEditRef.current(assembleFromCanvas(editor, diagramRef.current)), {
      source: 'user',
      scope: 'document',
    });
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) reconcile(editor, diagram);
  }, [diagram]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const editor = editorRef.current;
    const nodeType = e.dataTransfer.getData(NODE_TYPE_DND_MIME);
    const def = NODE_TAXONOMY.find((n) => n.id === nodeType);
    if (!editor || !def) return;

    const point = editor.screenToPage({ x: e.clientX, y: e.clientY });
    const node: DiagramNode = {
      id: shortId('node'),
      type: def.id,
      label: def.displayName,
      x: Math.round(point.x - NODE_DEFAULT_WIDTH / 2),
      y: Math.round(point.y - NODE_DEFAULT_HEIGHT / 2),
    };
    onCanvasEditRef.current({ ...diagramRef.current, nodes: [...diagramRef.current.nodes, node] });
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
    if (selected.length < 2) return;
    const [a, b] = selected;
    const edge = {
      id: shortId('edge'),
      from: a.props.nodeId,
      to: b.props.nodeId,
      direction: 'forward' as const,
    };
    onCanvasEditRef.current({ ...diagramRef.current, edges: [...diagramRef.current.edges, edge] });
  }, []);

  return (
    <div
      data-testid="canvas-drop"
      style={{ position: 'absolute', inset: 0 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex',
          gap: 6,
        }}
      >
        <button data-testid="connect-btn" onClick={handleConnect} style={toolbarBtn}>
          Connect
        </button>
        <button data-testid="group-btn" onClick={handleGroup} style={toolbarBtn}>
          Group
        </button>
      </div>
      <Tldraw assetUrls={assetUrls} shapeUtils={shapeUtils} onMount={handleMount} />
    </div>
  );
}

const toolbarBtn: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  background: 'white',
  border: '1px solid #cbd5e0',
  borderRadius: 6,
  cursor: 'pointer',
};
