import { useEffect, useRef, useState } from 'react';
import type { DocumentType } from '@shared/project/documentType';

const LABEL: Record<DocumentType, string> = {
  diagram: 'Diagram',
  whiteboard: 'Whiteboard',
  markdown: 'Markdown',
};

/** The "New" button and its type menu. Picking a type creates and opens a
 *  document of that type. `types` is the set of types offered (so a type whose
 *  editor doesn't exist yet is simply not listed). */
export function NewDocumentMenu({
  disabled,
  types,
  onNew,
}: {
  disabled: boolean;
  types: DocumentType[];
  onNew: (t: DocumentType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="newmenu" ref={ref}>
      <button
        data-testid="new-document-btn"
        className="btn btn--sm"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        New ▾
      </button>
      {open && (
        <div className="newmenu__list" role="menu" data-testid="new-document-menu">
          {types.map((t) => (
            <button
              key={t}
              role="menuitem"
              data-testid={`new-${t}`}
              className="newmenu__item"
              onClick={() => {
                setOpen(false);
                onNew(t);
              }}
            >
              {LABEL[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
