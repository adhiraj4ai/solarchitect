import { NODE_TAXONOMY, type Provider } from '@shared/ir/taxonomy';
import { NODE_TYPE_DND_MIME } from './dnd';

const PROVIDER_ORDER: Provider[] = ['aws', 'azure', 'gcp', 'kubernetes', 'generic'];

export function NodePalette() {
  return (
    <div className="palette">
      {PROVIDER_ORDER.map((provider) => (
        <div key={provider} className="palette__group">
          <span className="eyebrow palette__label">{provider}</span>
          <div className="palette__chips">
            {NODE_TAXONOMY.filter((n) => n.provider === provider).map((def) => (
              <div
                key={def.id}
                className="chip"
                draggable
                onDragStart={(e) => e.dataTransfer.setData(NODE_TYPE_DND_MIME, def.id)}
                title={def.id}
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
