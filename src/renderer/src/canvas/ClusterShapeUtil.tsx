import { ShapeUtil, Rectangle2d, HTMLContainer, T, type TLBaseShape } from 'tldraw';

export type ArchClusterShape = TLBaseShape<
  'archCluster',
  { clusterId: string; label: string; w: number; h: number }
>;

export class ClusterShapeUtil extends ShapeUtil<ArchClusterShape> {
  static override type = 'archCluster' as const;
  static override props = {
    clusterId: T.string,
    label: T.string,
    w: T.number,
    h: T.number,
  };

  getDefaultProps(): ArchClusterShape['props'] {
    return { clusterId: '', label: 'New cluster', w: 300, h: 200 };
  }

  getGeometry(shape: ArchClusterShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false });
  }

  // Clusters are backdrops. isFilled:false (above) means only the border is
  // hit-testable, so clicks in the interior fall through to the nodes inside;
  // canBind:false keeps edges from binding to the cluster.
  override canBind = () => false;

  component(shape: ArchClusterShape) {
    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          border: '1.5px dashed var(--blueprint, #2b57c6)',
          borderRadius: 10,
          background: 'var(--blueprint-soft, rgba(43,87,198,0.09))',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 10,
            fontFamily: 'var(--mono)',
            fontWeight: 600,
            fontSize: 12,
            color: 'var(--blueprint-ink, #1e3f96)',
          }}
        >
          {shape.props.label}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: ArchClusterShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={10} />;
  }
}
