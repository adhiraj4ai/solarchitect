import { ShapeUtil, Rectangle2d, HTMLContainer, T, resizeBox, type TLResizeInfo, type TLBaseShape } from 'tldraw';

export type ArchFrameShape = TLBaseShape<
  'archFrame',
  { frameId: string; label: string; preset: string; w: number; h: number }
>;

/** A print page / artboard: a white page with a soft shadow and a title tab,
 *  drawn behind everything else. The interior is not hit-testable (isFilled
 *  false) so shapes on top of it stay clickable; grab the border or title to
 *  move/resize it. */
export class FrameShapeUtil extends ShapeUtil<ArchFrameShape> {
  static override type = 'archFrame' as const;
  static override props = {
    frameId: T.string,
    label: T.string,
    preset: T.string,
    w: T.number,
    h: T.number,
  };

  getDefaultProps(): ArchFrameShape['props'] {
    return { frameId: '', label: 'Page', preset: 'custom', w: 794, h: 1123 };
  }

  getGeometry(shape: ArchFrameShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false });
  }

  override canBind = () => false;
  override canResize = () => true;
  override onResize(shape: ArchFrameShape, info: TLResizeInfo<ArchFrameShape>) {
    return resizeBox(shape, info);
  }

  component(shape: ArchFrameShape) {
    const { w, h, label } = shape.props;
    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#ffffff',
            border: '1px solid var(--line-strong, #c6d0dc)',
            boxShadow: '0 8px 28px -12px rgba(16,23,34,0.35)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -22,
            left: 0,
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--slate, #5a6675)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--ink, #101722)' }}>{label}</span>
          <span style={{ color: 'var(--faint, #8a94a3)' }}>
            {Math.round(w)}×{Math.round(h)}
          </span>
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: ArchFrameShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
