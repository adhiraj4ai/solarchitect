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

/**
 * Build a tldraw native shape for an IR annotation.
 *
 * Sizing differs by kind because tldraw's native shapes do: geo (rectangle)
 * takes explicit w+h; text takes a fixed width (autoSize off) with auto height;
 * note (sticky) is fixed-size and takes neither. annotationEq mirrors exactly
 * which dimensions each kind actually owns, so reconcile never churns trying to
 * force a dimension the shape ignores.
 */
export function annotationToShape(a: DiagramAnnotation): TLShapePartial {
  const type = KIND_TO_TLTYPE[a.kind];
  const id = createShapeId(a.id);
  const richText = toRichText(a.content);
  if (type === 'geo') {
    return { id, type, x: a.x, y: a.y, props: { w: a.width, h: a.height, geo: 'rectangle', richText } };
  }
  if (type === 'text') {
    return { id, type, x: a.x, y: a.y, props: { w: a.width, autoSize: false, richText } };
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

/**
 * Equality for reconcile diffing. Only compares the dimensions the shape kind
 * actually owns (see annotationToShape): geo owns w+h, text owns width, sticky
 * owns neither (fixed-size). Comparing a dimension the shape ignores would make
 * current-from-bounds never equal IR-desired, churning updateShape forever.
 */
export function annotationEq(a: DiagramAnnotation, b: DiagramAnnotation): boolean {
  if (a.kind !== b.kind || a.x !== b.x || a.y !== b.y || a.content !== b.content) return false;
  if (a.kind === 'shape') return a.width === b.width && a.height === b.height;
  if (a.kind === 'text') return a.width === b.width;
  return true; // sticky: size is canvas-owned
}
