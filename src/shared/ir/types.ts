export interface DiagramNode {
  id: string;
  type: string; // must satisfy isValidNodeType() from taxonomy.ts
  label: string;
  /** Canvas position. Optional: nodes without coordinates are auto-laid-out
   *  (see resolveNodePositions). A node gets concrete coordinates once it is
   *  moved on the canvas. */
  x?: number;
  y?: number;
  clusterId?: string;
  /** User-assigned accent color. Absent means the node renders black & white. */
  color?: AccentColor;
}

/** How an edge is routed between its two nodes. Absent means 'straight'. */
export type EdgeShape = 'straight' | 'curved' | 'bent';

/** Stroke style of the relationship line. Absent means 'solid'. */
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted';

export interface DiagramEdge {
  id: string;
  from: string; // DiagramNode.id
  to: string; // DiagramNode.id
  direction: 'forward' | 'bidirectional';
  label?: string;
  shape?: EdgeShape;
  /** Line stroke style. Absent means 'solid'. */
  lineStyle?: EdgeLineStyle;
  /** Whether to draw arrowheads at all. Absent means true (arrow shown). */
  arrow?: boolean;
}

/** The shared accent-color vocabulary, used for both node and cluster colors.
 *  Kept small so YAML stays readable and the palette stays on-brand. */
export type AccentColor = 'blueprint' | 'slate' | 'green' | 'amber' | 'violet' | 'red';

export const ACCENT_COLORS: AccentColor[] = ['blueprint', 'slate', 'green', 'amber', 'violet', 'red'];

/** @deprecated Alias of AccentColor — clusters and nodes share one palette. */
export type ClusterColor = AccentColor;
export const CLUSTER_COLORS = ACCENT_COLORS;

export interface DiagramCluster {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Accent color. Absent means 'blueprint'. */
  color?: ClusterColor;
}

/** A print page / artboard on the canvas. Content that falls within its bounds
 *  can be exported as one image. `preset` records the size preset chosen (or
 *  'custom'), purely for display. */
export interface DiagramFrame {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  preset?: string;
}

export type AnnotationKind = 'sticky' | 'shape' | 'text';

export interface DiagramAnnotation {
  id: string;
  kind: AnnotationKind;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
}

export interface Diagram {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  clusters: DiagramCluster[];
  annotations: DiagramAnnotation[];
  /** Print pages / artboards. Optional for backward compatibility; treated as
   *  [] when absent. */
  frames?: DiagramFrame[];
}

export function emptyDiagram(): Diagram {
  return { nodes: [], edges: [], clusters: [], annotations: [], frames: [] };
}
