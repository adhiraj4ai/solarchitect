import { Tldraw } from 'tldraw';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import 'tldraw/tldraw.css';
import { serializeDiagram } from '@shared/yaml/serialize';
import { emptyDiagram } from '@shared/ir/types';

// Self-host tldraw's icons/fonts/translations by bundling them through Vite,
// so the app has no runtime dependency on cdn.tldraw.com (local-only, offline).
const assetUrls = getAssetUrlsByImport();

const initialYamlText = serializeDiagram(emptyDiagram());

export default function App() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', height: '100vh' }}>
      <div style={{ position: 'relative' }}>
        <Tldraw assetUrls={assetUrls} />
      </div>
      <textarea
        defaultValue={initialYamlText}
        spellCheck={false}
        style={{
          fontFamily: 'monospace',
          fontSize: 13,
          height: '100%',
          border: 'none',
          borderLeft: '1px solid #ccc',
          resize: 'none',
          padding: 8,
        }}
      />
    </div>
  );
}
