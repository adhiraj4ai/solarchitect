import { ShapeUtil, Rectangle2d, HTMLContainer, T, resizeBox, type TLResizeInfo, type TLBaseShape } from 'tldraw';
import type { ClusterColor } from '@shared/ir/types';

export type ArchClusterShape = TLBaseShape<
  'archCluster',
  { clusterId: string; label: string; color: ClusterColor; w: number; h: number }
>;

/** Border + translucent fill + label ink for each named cluster color. */
export const CLUSTER_COLOR_STYLE: Record<ClusterColor, { border: string; fill: string; ink: string }> = {
  blueprint: { border: '#2b57c6', fill: 'rgba(43,87,198,0.09)', ink: '#1e3f96' },
  slate: { border: '#5a6675', fill: 'rgba(90,102,117,0.10)', ink: '#3b4553' },
  green: { border: '#2f8a5b', fill: 'rgba(47,138,91,0.10)', ink: '#1f6b43' },
  amber: { border: '#d9822b', fill: 'rgba(217,130,43,0.12)', ink: '#a45f14' },
  violet: { border: '#6d3bcc', fill: 'rgba(109,59,204,0.10)', ink: '#522aa0' },
  red: { border: '#c0392f', fill: 'rgba(192,57,47,0.09)', ink: '#8f2018' },
};

export class ClusterShapeUtil extends ShapeUtil<ArchClusterShape> {
  static override type = 'archCluster' as const;
  static override props = {
    clusterId: T.string,
    label: T.string,
    color: T.literalEnum('blueprint', 'slate', 'green', 'amber', 'violet', 'red'),
    w: T.number,
    h: T.number,
  };

  getDefaultProps(): ArchClusterShape['props'] {
    return { clusterId: '', label: 'New cluster', color: 'blueprint', w: 300, h: 200 };
  }

  getGeometry(shape: ArchClusterShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false });
  }

  // Clusters are backdrops. isFilled:false (above) means only the border is
  // hit-testable, so clicks in the interior fall through to the nodes inside;
  // canBind:false keeps edges from binding to the cluster.
  override canBind = () => false;
  // Clusters can be resized (drag the selection handles); the new w/h sync back
  // to the IR through the store listener like any other canvas edit.
  override canResize = () => true;
  override onResize(shape: ArchClusterShape, info: TLResizeInfo<ArchClusterShape>) {
    return resizeBox(shape, info);
  }

  component(shape: ArchClusterShape) {
    const c = CLUSTER_COLOR_STYLE[shape.props.color] ?? CLUSTER_COLOR_STYLE.blueprint;
    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          border: `1.5px dashed ${c.border}`,
          borderRadius: 10,
          background: c.fill,
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
            color: c.ink,
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
