import { useMemo, useState } from 'react';
import { NODE_TAXONOMY, type Provider } from '@shared/ir/taxonomy';
import { NODE_TYPE_DND_MIME } from './dnd';
import { NodeIcon, GlyphIcon, PROVIDER_GLYPH } from './icons';

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
  'vercel',
  'netlify',
  'heroku',
  'supabase',
  'snowflake',
  'databricks',
  'flowchart',
  'uml',
  'language',
  'framework',
  'oss',
  'client',
  'ai',
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
  vercel: 'Vercel',
  netlify: 'Netlify',
  heroku: 'Heroku',
  supabase: 'Supabase',
  snowflake: 'Snowflake',
  databricks: 'Databricks',
  flowchart: 'Flowchart',
  uml: 'UML',
  language: 'Languages',
  framework: 'Frameworks',
  oss: 'OSS Databases',
  client: 'Clients',
  ai: 'AI & ML',
  generic: 'Generic',
};

export function ShapeLibrary() {
  const [query, setQuery] = useState('');
  // Categories are collapsed by default so the long catalog stays scannable.
  // A search auto-expands every matching group; manual toggles apply otherwise.
  const [expanded, setExpanded] = useState<Set<Provider>>(new Set());
  const searching = query.trim() !== '';

  const toggle = (provider: Provider) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });

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
        {groups.map((g) => {
          const open = searching || expanded.has(g.provider);
          return (
            <section key={g.provider} className="lib-group">
              <button
                type="button"
                className={`lib-group__label${open ? ' open' : ''}`}
                data-testid={`lib-group-${g.provider}`}
                aria-expanded={open}
                onClick={() => toggle(g.provider)}
              >
                <span className={`lib-caret${open ? ' open' : ''}`} aria-hidden="true">
                  ▸
                </span>
                <span className="lib-group__icon">
                  <GlyphIcon name={PROVIDER_GLYPH[g.provider] ?? g.nodes[0].glyph} size={15} />
                </span>
                <span className="lib-group__name">{PROVIDER_NAME[g.provider]}</span>
                <span className="lib-count">{g.nodes.length}</span>
              </button>
              {open && (
                <div className="lib-grid">
                  {g.nodes.map((def) => (
                    <div
                      key={def.id}
                      className="lib-tile"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData(NODE_TYPE_DND_MIME, def.id)}
                      title={`${def.displayName} — drag onto the canvas`}
                    >
                      <span className="lib-tile__icon">
                        <NodeIcon type={def.id} size={22} />
                      </span>
                      <span className="lib-tile__name">{def.displayName}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
