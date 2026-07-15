import type { NamedTemplate } from '@shared/templates/templatesFile';

export const TEMPLATE_DND_MIME = 'application/x-solarchitect-template';

export function TemplatesPanel({ templates }: { templates: NamedTemplate[] }) {
  return (
    <div style={{ borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#718096' }}>
        Templates
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 200 }} data-testid="templates-list">
        {templates.length === 0 && (
          <div style={{ padding: '0 10px 8px', fontSize: 12, color: '#a0aec0' }}>
            Select 2+ nodes, then “Save as Template”.
          </div>
        )}
        {templates.map((t) => (
          <div
            key={t.name}
            draggable
            onDragStart={(e) => e.dataTransfer.setData(TEMPLATE_DND_MIME, t.name)}
            style={{
              padding: '6px 10px',
              borderBottom: '1px solid #edf2f7',
              fontSize: 13,
              cursor: 'grab',
              userSelect: 'none',
            }}
            title="Drag onto the canvas to instantiate"
          >
            {t.name}
          </div>
        ))}
      </div>
    </div>
  );
}
