import { Tldraw, type Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { useCallback, useEffect, useRef } from 'react';
import { NodeShapeUtil, NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT } from './NodeShapeUtil';
import { NODE_TYPE_DND_MIME } from './NodePalette';
import { nodesToShapes, nodeToShapeProps, getArchNodeShapes, shapeToNode } from './shapeAdapters';
import { NODE_TAXONOMY } from '@shared/ir/taxonomy';
import type { Diagram, DiagramNode } from '@shared/ir/types';

// Self-hosted so there's no runtime dependency on cdn.tldraw.com (see main/index.ts).
const assetUrls = getAssetUrlsByImport();
const shapeUtils = [NodeShapeUtil];

// Collision-resistant so ids survive loading a saved diagram (ticket #4) without
// a module counter that would restart at 0 and regenerate existing ids.
function makeNodeId(): string {
  return `node-${crypto.randomUUID().slice(0, 8)}`;
}

/** Reconcile the tldraw canvas to match the IR: create new, update changed, remove gone. */
function reconcileNodes(editor: Editor, nodes: DiagramNode[]): void {
  const desired = new Map(nodes.map((n) => [n.id, n]));
  const existing = getArchNodeShapes(editor);
  const existingById = new Map(existing.map((s) => [s.props.nodeId, s]));

  const toRemove = existing.filter((s) => !desired.has(s.props.nodeId)).map((s) => s.id);
  if (toRemove.length) editor.deleteShapes(toRemove);

  const toCreate = nodes.filter((n) => !existingById.has(n.id));
  if (toCreate.length) editor.createShapes(nodesToShapes(toCreate));

  for (const n of nodes) {
    const shape = existingById.get(n.id);
    if (!shape) continue;
    if (shape.x !== n.x || shape.y !== n.y || shape.props.label !== n.label || shape.props.nodeType !== n.type) {
      editor.updateShape({ id: shape.id, type: 'archNode', x: n.x, y: n.y, props: nodeToShapeProps(n) });
    }
  }
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
    reconcileNodes(editor, diagramRef.current.nodes);

    // User-driven canvas changes (move/delete) flow back into the IR. Non-shape
    // fields (clusterId) are merged from the prior IR since shapes don't carry them.
    editor.store.listen(
      () => {
        const prevById = new Map(diagramRef.current.nodes.map((n) => [n.id, n]));
        const nodes = getArchNodeShapes(editor).map((s) => {
          const node = shapeToNode(s);
          const prev = prevById.get(node.id);
          return prev?.clusterId ? { ...node, clusterId: prev.clusterId } : node;
        });
        onCanvasEditRef.current({ ...diagramRef.current, nodes });
      },
      { source: 'user', scope: 'document' },
    );
  }, []);

  // Push IR changes (e.g. a dropped node, or a future YAML edit) onto the canvas.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) reconcileNodes(editor, diagram.nodes);
  }, [diagram]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const editor = editorRef.current;
    const nodeType = e.dataTransfer.getData(NODE_TYPE_DND_MIME);
    const def = NODE_TAXONOMY.find((n) => n.id === nodeType);
    if (!editor || !def) return;

    const point = editor.screenToPage({ x: e.clientX, y: e.clientY });
    const node: DiagramNode = {
      id: makeNodeId(),
      type: def.id,
      label: def.displayName,
      x: Math.round(point.x - NODE_DEFAULT_WIDTH / 2),
      y: Math.round(point.y - NODE_DEFAULT_HEIGHT / 2),
    };
    onCanvasEditRef.current({ ...diagramRef.current, nodes: [...diagramRef.current.nodes, node] });
  }, []);

  return (
    <div
      data-testid="canvas-drop"
      style={{ position: 'absolute', inset: 0 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <Tldraw assetUrls={assetUrls} shapeUtils={shapeUtils} onMount={handleMount} />
    </div>
  );
}
