import { useState } from 'react';
import { searchProject, hasResults } from '@shared/search/search';
import type { Diagram } from '@shared/ir/types';

/**
 * Search the open project: diagram file names across the project, and node /
 * cluster labels within the currently-open diagram. Selecting a diagram result
 * opens it; selecting an element result reveals it on the canvas.
 */
export function SearchPanel({
  fileNames,
  diagram,
  hasProject,
  onOpenDiagram,
  onReveal,
}: {
  fileNames: string[];
  diagram: Diagram | null;
  hasProject: boolean;
  onOpenDiagram: (fileName: string) => void;
  onReveal: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const results = searchProject({ query, fileNames, diagram });
  const querying = query.trim() !== '';

  return (
    <div className="panel">
      <div className="panel__head">
        <span className="eyebrow">Search</span>
        <input
          className="library__search"
          type="search"
          data-testid="search-input"
          placeholder="Search diagrams & elements…"
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="panel__body" data-testid="search-results">
        {querying && !hasResults(results) && (
          <div className="list__empty">No matches for “{query.trim()}”.</div>
        )}
        {!querying && !hasProject && (
          <div className="list__empty">Open a project to search its diagrams, or edit a diagram to find its elements.</div>
        )}

        {results.diagrams.length > 0 && (
          <>
            <div className="outline__section">Diagrams</div>
            {results.diagrams.map((d) => (
              <button
                key={d.fileName}
                className="outline__row"
                data-testid="search-diagram-result"
                onClick={() => onOpenDiagram(d.fileName)}
                title={d.fileName}
              >
                <span className="outline__glyph" aria-hidden="true">▢</span>
                <span className="outline__label">{d.fileName}</span>
              </button>
            ))}
          </>
        )}

        {results.elements.length > 0 && (
          <>
            <div className="outline__section">In this diagram</div>
            {results.elements.map((e) => (
              <button
                key={`${e.elementKind}-${e.id}`}
                className="outline__row"
                data-testid="search-element-result"
                onClick={() => onReveal(e.id)}
                title={e.elementKind}
              >
                <span className="outline__glyph" aria-hidden="true">{e.elementKind === 'cluster' ? '▤' : '◻'}</span>
                <span className="outline__label">{e.label}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
