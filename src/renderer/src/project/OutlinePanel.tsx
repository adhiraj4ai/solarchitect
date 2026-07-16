import { buildOutline } from '@shared/outline/outline';
import type { Diagram } from '@shared/ir/types';

/**
 * A tree view of the current diagram's structure, derived from the IR. Clicking
 * any entry reveals (selects + centers) the corresponding shape on the canvas.
 * Reflects the diagram on both surfaces, since the diagram is the whiteboard's
 * backdrop.
 */
export function OutlinePanel({ diagram, onReveal }: { diagram: Diagram; onReveal: (id: string) => void }) {
  const outline = buildOutline(diagram);

  return (
    <div className="panel">
      <div className="panel__head">
        <span className="eyebrow">Outline</span>
      </div>
      {outline.isEmpty ? (
        <div className="list__empty">This diagram is empty — add nodes to see its outline.</div>
      ) : (
        <div className="outline" data-testid="outline">
          {outline.clusters.map((c) => (
            <div key={c.id} className="outline__cluster">
              <button className="outline__row outline__row--group" onClick={() => onReveal(c.id)} title={c.label}>
                <span className="outline__glyph" aria-hidden="true">▤</span>
                <span className="outline__label">{c.label}</span>
              </button>
              {c.children.map((n) => (
                <button
                  key={n.id}
                  className="outline__row outline__row--child"
                  onClick={() => onReveal(n.id)}
                  title={n.nodeType}
                >
                  <span className="outline__glyph" aria-hidden="true">◻</span>
                  <span className="outline__label">{n.label}</span>
                </button>
              ))}
            </div>
          ))}
          {outline.ungrouped.map((n) => (
            <button key={n.id} className="outline__row" onClick={() => onReveal(n.id)} title={n.nodeType}>
              <span className="outline__glyph" aria-hidden="true">◻</span>
              <span className="outline__label">{n.label}</span>
            </button>
          ))}
          {outline.edges.length > 0 && (
            <>
              <div className="outline__section">Relationships</div>
              {outline.edges.map((e) => (
                <button key={e.id} className="outline__row" onClick={() => onReveal(e.id)} title={e.label}>
                  <span className="outline__glyph" aria-hidden="true">↔</span>
                  <span className="outline__label">{e.label}</span>
                </button>
              ))}
            </>
          )}
          {outline.frames.length > 0 && (
            <>
              <div className="outline__section">Pages</div>
              {outline.frames.map((f) => (
                <button key={f.id} className="outline__row" onClick={() => onReveal(f.id)} title={f.label}>
                  <span className="outline__glyph" aria-hidden="true">▭</span>
                  <span className="outline__label">{f.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
