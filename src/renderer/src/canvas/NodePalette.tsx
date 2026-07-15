import { NODE_TAXONOMY, type Provider } from '@shared/ir/taxonomy';

export const NODE_TYPE_DND_MIME = 'application/x-solarchitect-node-type';

const PROVIDER_ORDER: Provider[] = ['aws', 'azure', 'gcp', 'kubernetes', 'generic'];

export function NodePalette() {
  return (
    <div style={{ padding: 8, overflowY: 'auto', borderBottom: '1px solid #e2e8f0' }}>
      {PROVIDER_ORDER.map((provider) => (
        <div key={provider} style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: '#718096',
              marginBottom: 4,
            }}
          >
            {provider}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {NODE_TAXONOMY.filter((n) => n.provider === provider).map((def) => (
              <div
                key={def.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData(NODE_TYPE_DND_MIME, def.id)}
                title={def.id}
                style={{
                  border: '1px solid #cbd5e0',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 12,
                  cursor: 'grab',
                  background: 'white',
                  userSelect: 'none',
                }}
              >
                {def.displayName}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
