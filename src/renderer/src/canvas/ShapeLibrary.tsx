import { useMemo, useState } from 'react';
import { NODE_TAXONOMY, type Provider } from '@shared/ir/taxonomy';
import { NODE_TYPE_DND_MIME } from './dnd';
import { NodeIcon, PROVIDER_COLOR, PROVIDER_TINT } from './icons';

const PROVIDER_ORDER: Provider[] = [
  'aws',
  'azure',
  'gcp',
  'oracle',
  'ibm',
  'alibaba',
  'kubernetes',
  'onprem',
  'cloudflare',
  'digitalocean',
  'firebase',
  'elastic',
  'saas',
  'generic',
];
const PROVIDER_NAME: Record<Provider, string> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'Google Cloud',
  oracle: 'Oracle Cloud',
  ibm: 'IBM Cloud',
  alibaba: 'Alibaba Cloud',
  kubernetes: 'Kubernetes',
  onprem: 'On-Prem',
  cloudflare: 'Cloudflare',
  digitalocean: 'DigitalOcean',
  firebase: 'Firebase',
  elastic: 'Elastic',
  saas: 'SaaS',
  generic: 'Generic',
};

export function ShapeLibrary() {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROVIDER_ORDER.map((provider) => ({
      provider,
      nodes: NODE_TAXONOMY.filter(
        (n) =>
          n.provider === provider &&
          (q === '' ||
            n.displayName.toLowerCase().includes(q) ||
            n.category.toLowerCase().includes(q) ||
            n.id.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.nodes.length > 0);
  }, [query]);

  return (
    <div className="library">
      <div className="library__head">
        <span className="eyebrow">Shapes</span>
        <input
          className="library__search"
          type="search"
          placeholder="Search services…"
          aria-label="Search shapes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="library__body">
        {groups.length === 0 && <div className="list__empty">No shapes match “{query}”.</div>}
        {groups.map((g) => (
          <section key={g.provider} className="lib-group">
            <div className="lib-group__label">
              <span className="lib-dot" style={{ background: PROVIDER_COLOR[g.provider] }} />
              {PROVIDER_NAME[g.provider]}
              <span className="lib-count">{g.nodes.length}</span>
            </div>
            <div className="lib-grid">
              {g.nodes.map((def) => (
                <div
                  key={def.id}
                  className="lib-tile"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData(NODE_TYPE_DND_MIME, def.id)}
                  title={`${def.displayName} — drag onto the canvas`}
                >
                  <span className="lib-tile__icon" style={{ background: PROVIDER_TINT[def.provider] }}>
                    <NodeIcon type={def.id} size={22} />
                  </span>
                  <span className="lib-tile__name">{def.displayName}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
