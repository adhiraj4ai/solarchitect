import { ShapeUtil, Rectangle2d, HTMLContainer, T, type TLBaseShape } from 'tldraw';
import { NODE_TAXONOMY } from '@shared/ir/taxonomy';

export type ArchNodeShape = TLBaseShape<
  'archNode',
  { nodeId: string; nodeType: string; label: string; w: number; h: number }
>;

export const NODE_DEFAULT_WIDTH = 140;
export const NODE_DEFAULT_HEIGHT = 88;

export class NodeShapeUtil extends ShapeUtil<ArchNodeShape> {
  static override type = 'archNode' as const;
  static override props = {
    nodeId: T.string,
    nodeType: T.string,
    label: T.string,
    w: T.number,
    h: T.number,
  };

  getDefaultProps(): ArchNodeShape['props'] {
    return {
      nodeId: '',
      nodeType: 'generic.compute.Server',
      label: 'New node',
      w: NODE_DEFAULT_WIDTH,
      h: NODE_DEFAULT_HEIGHT,
    };
  }

  getGeometry(shape: ArchNodeShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: ArchNodeShape) {
    const def = NODE_TAXONOMY.find((n) => n.id === shape.props.nodeType);
    return (
      <HTMLContainer
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          width: shape.props.w,
          height: shape.props.h,
          border: '1px solid #4a5568',
          borderRadius: 8,
          background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          pointerEvents: 'all',
        }}
      >
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#718096' }}>
          {def?.provider ?? 'generic'}
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, textAlign: 'center' }}>{shape.props.label}</div>
        <div style={{ fontSize: 10, color: '#a0aec0' }}>{def?.displayName ?? shape.props.nodeType}</div>
      </HTMLContainer>
    );
  }

  indicator(shape: ArchNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />;
  }
}
