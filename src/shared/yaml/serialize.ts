import { stringify } from 'yaml';
import type { Diagram } from '../ir/types';

export function serializeDiagram(diagram: Diagram): string {
  const doc = {
    nodes: diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      // Coordinate-free nodes stay coordinate-free in YAML.
      ...(typeof n.x === 'number' ? { x: n.x } : {}),
      ...(typeof n.y === 'number' ? { y: n.y } : {}),
      ...(n.clusterId ? { clusterId: n.clusterId } : {}),
      ...(n.color ? { color: n.color } : {}),
      ...(typeof n.step === 'number' ? { step: n.step } : {}),
    })),
    edges: diagram.edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      // 'forward' is the default; omit it so existing diagrams stay unchanged.
      ...(e.direction !== 'forward' ? { direction: e.direction } : {}),
      ...(e.label ? { label: e.label } : {}),
      ...(e.shape && e.shape !== 'straight' ? { shape: e.shape } : {}),
      ...(e.lineStyle && e.lineStyle !== 'solid' ? { lineStyle: e.lineStyle } : {}),
      ...(e.arrow === false ? { arrow: false } : {}),
      ...(typeof e.step === 'number' ? { step: e.step } : {}),
    })),
    clusters: diagram.clusters.map((c) => ({
      id: c.id,
      label: c.label,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      ...(c.color && c.color !== 'blueprint' ? { color: c.color } : {}),
    })),
    // Frames only appear once at least one exists, so existing diagrams' YAML
    // is unchanged.
    ...(diagram.frames && diagram.frames.length
      ? {
          frames: diagram.frames.map((f) => ({
            id: f.id,
            label: f.label,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            ...(f.preset ? { preset: f.preset } : {}),
          })),
        }
      : {}),
  };
  return stringify(doc, { sortMapEntries: true });
}
