export interface DiagramNode {
  id: string;
  type: string; // must satisfy isValidNodeType() from taxonomy.ts
  label: string;
  x: number;
  y: number;
  clusterId?: string;
}

export interface DiagramEdge {
  id: string;
  from: string; // DiagramNode.id
  to: string; // DiagramNode.id
  direction: 'forward' | 'bidirectional';
  label?: string;
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
