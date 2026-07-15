import { CanvasView } from './canvas/CanvasView';
import { NodePalette } from './canvas/NodePalette';
import { YamlCodeEditor } from './editor/YamlCodeEditor';
import { ProjectSidebar } from './project/ProjectSidebar';
import { useSyncEngine } from './hooks/useSyncEngine';
import { useProject } from './hooks/useProject';

export default function App() {
  const { yamlText, diagram, yamlError, canvasEditSeq, onCanvasEdit, onYamlEdit, loadDiagram } = useSyncEngine();
  const project = useProject(loadDiagram);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 400px', height: '100vh' }}>
      <ProjectSidebar
        projectDir={project.projectDir}
        entries={project.entries}
        currentFile={project.currentFile}
        canSave={!!project.currentFile && !yamlError}
        onOpenProject={project.openProject}
        onNewDiagram={project.newDiagram}
        onOpenDiagram={project.openDiagram}
        onSave={() => project.saveDiagram(yamlText)}
      />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <NodePalette />
        <div style={{ position: 'relative', flex: 1 }}>
          <CanvasView diagram={diagram} onCanvasEdit={onCanvasEdit} />
        </div>
      </div>
      <YamlCodeEditor
        yamlText={yamlText}
        yamlError={yamlError}
        canvasEditSeq={canvasEditSeq}
        onYamlEdit={onYamlEdit}
      />
      {project.ioError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            maxWidth: 380,
            background: '#611a15',
            color: 'white',
            padding: '10px 14px',
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            fontSize: 13,
          }}
        >
          {project.ioError}
          <button
            onClick={project.dismissError}
            style={{ marginLeft: 12, background: 'transparent', color: 'white', border: '1px solid white', borderRadius: 4, cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
