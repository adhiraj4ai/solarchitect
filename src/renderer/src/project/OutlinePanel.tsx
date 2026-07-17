import { buildOutline } from '@shared/outline/outline';
import { markdownHeadings } from '@shared/markdown/markdownOutline';
import type { Diagram } from '@shared/ir/types';
import type { DocumentType } from '@shared/project/documentType';

/**
 * A tree view of the current document's structure. For a diagram it lists the IR
 * (clusters/nodes/edges/frames) and clicking an entry reveals it on the canvas;
 * for a markdown document it lists the headings and clicking one scrolls the
 * preview.
 */
export function OutlinePanel({
  diagram,
  onReveal,
  documentType,
  markdownText,
}: {
  diagram: Diagram;
  onReveal: (id: string) => void;
  documentType: DocumentType | null;
  markdownText: string;
}) {
  if (documentType === 'markdown') {
    const headings = markdownHeadings(markdownText);
    return (
      <div className="panel">
        <div className="panel__head">
          <span className="eyebrow">Outline</span>
        </div>
        {headings.length === 0 ? (
          <div className="list__empty">No headings yet — add a heading to see the outline.</div>
        ) : (
          <div className="outline" data-testid="outline">
            {headings.map((h) => (
              <button
                key={h.id}
                className={`outline__row outline__row--h${h.level}`}
                data-testid={`outline-h-${h.id}`}
                onClick={() => onReveal(h.id)}
                title={h.text}
                style={{ paddingLeft: `${8 + (h.level - 1) * 12}px` }}
              >
                <span className="outline__glyph" aria-hidden="true">#</span>
                <span className="outline__label">{h.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

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
