import { useCallback, useRef, type ReactNode } from 'react';

/**
 * The single sidebar container. Shows one panel's content at the persisted
 * width and provides a drag handle on its right edge to resize. It's a dumb
 * container: which panel to render and the width state live in App / the layout
 * hook. Each panel supplies its own header, so the container adds none.
 */
export function Sidebar({
  width,
  onResize,
  children,
}: {
  width: number;
  onResize: (width: number) => void;
  children: ReactNode;
}) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      onResize(d.startWidth + (e.clientX - d.startX));
    },
    [onResize],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  const onHandleDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: width };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [width, onPointerMove, onPointerUp],
  );

  return (
    <aside className="sidebar-shell" style={{ width }} data-testid="sidebar">
      <div className="sidebar-shell__content">{children}</div>
      <div
        className="sidebar-shell__resize"
        data-testid="sidebar-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={onHandleDown}
      />
    </aside>
  );
}
