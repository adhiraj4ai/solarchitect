import { ShapeUtil, Rectangle2d, HTMLContainer, T, type TLBaseShape } from 'tldraw';
import { NODE_TAXONOMY } from '@shared/ir/taxonomy';
import { NodeIcon, PROVIDER_TINT } from './icons';
import { PROVIDER_ICON_MAP } from './iconMap';

export type ArchNodeShape = TLBaseShape<
  'archNode',
  { nodeId: string; nodeType: string; label: string; w: number; h: number; order: number }
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
    order: T.number,
  };

  getDefaultProps(): ArchNodeShape['props'] {
    return {
      nodeId: '',
      nodeType: 'generic.compute.Server',
      label: 'New node',
      w: NODE_DEFAULT_WIDTH,
      h: NODE_DEFAULT_HEIGHT,
      order: 0,
    };
  }

  getGeometry(shape: ArchNodeShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: ArchNodeShape) {
    const def = NODE_TAXONOMY.find((n) => n.id === shape.props.nodeType);
    
    // Check if we have an official PNG icon for this node type
    const customIconPath = PROVIDER_ICON_MAP[shape.props.nodeType];
    const isCustomIcon = !!customIconPath;
    
    return (
      <HTMLContainer
        className="arch-node"
        style={{
          width: shape.props.w,
          height: shape.props.h,
        }}
      >
        {/* Traversal-order badge; shown only when Steps is on (.steps-on ancestor). */}
        <span className="arch-step-badge" title={`Step ${shape.props.order}`}>
          {shape.props.order}
        </span>
        {/* Drag from a port onto another node to draw a relationship. */}
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <span
            key={side}
            className={`arch-node__port arch-node__port--${side}`}
            data-conn-port=""
            data-conn-node={shape.props.nodeId}
          />
        ))}
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 34,
            height: 34,
            borderRadius: 9,
            background: isCustomIcon ? 'transparent' : (def ? PROVIDER_TINT[def.provider] : PROVIDER_TINT.generic),
          }}
        >
          {isCustomIcon ? (
            <img 
              src={customIconPath} 
              alt={def?.displayName || 'Icon'} 
              style={{ width: 22, height: 22, objectFit: 'contain' }}
              draggable={false}
            />
          ) : (
            <NodeIcon type={shape.props.nodeType} size={20} />
          )}
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
