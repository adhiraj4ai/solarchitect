import { CanvasView } from './canvas/CanvasView';
import { NodePalette } from './canvas/NodePalette';
import { useSyncEngine } from './hooks/useSyncEngine';

export default function App() {
  const { yamlText, diagram, onCanvasEdit } = useSyncEngine();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', height: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <NodePalette />
        <div style={{ position: 'relative', flex: 1 }}>
          <CanvasView diagram={diagram} onCanvasEdit={onCanvasEdit} />
        </div>
      </div>
      <textarea
        value={yamlText}
        readOnly
        spellCheck={false}
        aria-label="Diagram YAML"
        style={{
          fontFamily: 'monospace',
          fontSize: 13,
          height: '100%',
          border: 'none',
          borderLeft: '1px solid #ccc',
          resize: 'none',
          padding: 8,
          background: '#fafafa',
        }}
      />
    </div>
  );
}
