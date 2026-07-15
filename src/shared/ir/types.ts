export interface DiagramNode {
  id: string;
  type: string; // must satisfy isValidNodeType() from taxonomy.ts
  label: string;
  x: number;
  y: number;
  clusterId?: string;
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

export interface DiagramCluster {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
}

export function emptyDiagram(): Diagram {
  return { nodes: [], edges: [], clusters: [], annotations: [] };
}
