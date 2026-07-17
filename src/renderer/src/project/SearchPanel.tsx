import { useState } from 'react';
import { searchProject, hasResults } from '@shared/search/search';
import { searchMarkdown } from '@shared/markdown/markdownOutline';
import type { Diagram } from '@shared/ir/types';
import type { DocumentType } from '@shared/project/documentType';

/**
 * Search the open project: document file names across the project, plus content
 * within the current document — node/cluster labels for a diagram, or headings
 * for a markdown document. Selecting a file opens it; selecting a content result
 * reveals it (canvas shape or preview heading).
 */
export function SearchPanel({
  fileNames,
  diagram,
  hasProject,
  documentType,
  markdownText,
  onOpenDiagram,
  onReveal,
}: {
  fileNames: string[];
  diagram: Diagram | null;
  hasProject: boolean;
  documentType: DocumentType | null;
  markdownText: string;
  onOpenDiagram: (fileName: string) => void;
  onReveal: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  // Content search targets the current document's structure: markdown headings
  // for a markdown document, diagram elements otherwise.
  const results = searchProject({
    query,
    fileNames,
    diagram: documentType === 'markdown' ? null : diagram,
  });
  const headingResults = documentType === 'markdown' ? searchMarkdown(markdownText, query) : [];
  const querying = query.trim() !== '';
  const anyResults = hasResults(results) || headingResults.length > 0;

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
        {querying && !anyResults && (
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

        {headingResults.length > 0 && (
          <>
            <div className="outline__section">In this document</div>
            {headingResults.map((h) => (
              <button
                key={h.id}
                className="outline__row"
                data-testid="search-heading-result"
                onClick={() => onReveal(h.id)}
                title={h.text}
              >
                <span className="outline__glyph" aria-hidden="true">#</span>
                <span className="outline__label">{h.text}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
