import { CanvasView } from './canvas/CanvasView';
import { NodePalette } from './canvas/NodePalette';
import { YamlCodeEditor } from './editor/YamlCodeEditor';
import { useSyncEngine } from './hooks/useSyncEngine';

export default function App() {
  const { yamlText, diagram, yamlError, onCanvasEdit, onYamlEdit } = useSyncEngine();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', height: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <NodePalette />
        <div style={{ position: 'relative', flex: 1 }}>
          <CanvasView diagram={diagram} onCanvasEdit={onCanvasEdit} />
        </div>
      </div>
      <YamlCodeEditor yamlText={yamlText} yamlError={yamlError} onYamlEdit={onYamlEdit} />
    </div>
  );
}
