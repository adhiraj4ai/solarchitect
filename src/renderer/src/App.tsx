import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { serializeDiagram } from '@shared/yaml/serialize';
import { emptyDiagram } from '@shared/ir/types';

const initialYamlText = serializeDiagram(emptyDiagram());

export default function App() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', height: '100vh' }}>
      <div style={{ position: 'relative' }}>
        <Tldraw />
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
