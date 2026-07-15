import { ShapeUtil, Rectangle2d, HTMLContainer, T, type TLBaseShape } from 'tldraw';
import { NODE_TAXONOMY } from '@shared/ir/taxonomy';
import { NodeIcon, PROVIDER_TINT } from './icons';

export type ArchNodeShape = TLBaseShape<
  'archNode',
  { nodeId: string; nodeType: string; label: string; w: number; h: number }
>;

export const NODE_DEFAULT_WIDTH = 148;
export const NODE_DEFAULT_HEIGHT = 104;

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
          gap: 7,
          width: shape.props.w,
          height: shape.props.h,
          border: '1px solid var(--line-strong, #c6d0dc)',
          borderRadius: 10,
          background: 'var(--panel, #fff)',
          boxShadow: '0 1px 3px rgba(16,23,34,0.1)',
          fontFamily: 'var(--sans)',
          pointerEvents: 'all',
        }}
      >
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 34,
            height: 34,
            borderRadius: 9,
            background: def ? PROVIDER_TINT[def.provider] : PROVIDER_TINT.generic,
          }}
        >
          <NodeIcon type={shape.props.nodeType} size={20} />
        </span>
        <span style={{ fontWeight: 650, fontSize: 13.5, lineHeight: 1.15, textAlign: 'center', color: 'var(--ink, #101722)' }}>
          {shape.props.label}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--faint, #8a94a3)' }}>
          {def?.displayName ?? shape.props.nodeType}
        </span>
      </HTMLContainer>
    );
  }

  indicator(shape: ArchNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />;
  }
}
