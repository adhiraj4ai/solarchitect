import { createShapeId, toRichText, renderPlaintextFromRichText, type Editor, type TLShape, type TLShapePartial } from 'tldraw';
import type { DiagramAnnotation, AnnotationKind } from '@shared/ir/types';

// Annotations are freeform whiteboard elements, so they map onto tldraw's own
// native shape types rather than custom ones — the user gets tldraw's built-in
// placement/editing/resize for free.
const KIND_TO_TLTYPE: Record<AnnotationKind, 'note' | 'geo' | 'text'> = {
  sticky: 'note',
  shape: 'geo',
  text: 'text',
};
const TLTYPE_TO_KIND: Record<string, AnnotationKind> = { note: 'sticky', geo: 'shape', text: 'text' };

export function isAnnotationShape(s: TLShape): boolean {
  return s.type === 'note' || s.type === 'geo' || s.type === 'text';
}

export function getAnnotationShapes(editor: Editor): TLShape[] {
  return editor.getCurrentPageShapes().filter(isAnnotationShape);
}

/** Build a tldraw native shape for an IR annotation. */
export function annotationToShape(a: DiagramAnnotation): TLShapePartial {
  const type = KIND_TO_TLTYPE[a.kind];
  const id = createShapeId(a.id);
  const richText = toRichText(a.content);
  if (type === 'geo') {
    return { id, type, x: a.x, y: a.y, props: { w: a.width, h: a.height, geo: 'rectangle', richText } };
  }
  if (type === 'text') {
    return { id, type, x: a.x, y: a.y, props: { w: a.width, richText } };
  }
  return { id, type, x: a.x, y: a.y, props: { richText } }; // note (auto-sized)
}

/** Read an IR annotation out of a tldraw native shape. Size comes from page bounds. */
export function shapeToAnnotation(editor: Editor, s: TLShape): DiagramAnnotation {
  const bounds = editor.getShapePageBounds(s);
  const richText = (s.props as { richText?: Parameters<typeof renderPlaintextFromRichText>[1] }).richText;
  const content = richText ? renderPlaintextFromRichText(editor, richText) : '';
  return {
    id: s.id.replace(/^shape:/, ''),
    kind: TLTYPE_TO_KIND[s.type],
    x: Math.round(s.x),
    y: Math.round(s.y),
    width: Math.round(bounds?.w ?? 0),
    height: Math.round(bounds?.h ?? 0),
    content,
  };
}

export function annotationEq(a: DiagramAnnotation, b: DiagramAnnotation): boolean {
  return (
    a.kind === b.kind &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.content === b.content
  );
}

/** Props patch for updating an existing annotation shape (kind is fixed once created). */
export function annotationUpdateProps(a: DiagramAnnotation): TLShapePartial {
  return annotationToShape(a);
}
