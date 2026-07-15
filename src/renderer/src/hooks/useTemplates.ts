import { useCallback, useEffect, useState } from 'react';
import { serializeTemplates, parseTemplates, type NamedTemplate } from '@shared/templates/templatesFile';
import type { Diagram } from '@shared/ir/types';

const EMPTY_TEMPLATES = 'templates: []\n';

/** Loads/saves the project's shared templates file. Templates are available to
 *  every diagram in the project, and the file is editable as YAML in-app. */
export function useTemplates(projectDir: string | null, onError: (msg: string) => void) {
  const [templates, setTemplates] = useState<NamedTemplate[]>([]);
  const [templatesText, setTemplatesText] = useState(EMPTY_TEMPLATES);
  const [yamlError, setYamlError] = useState<string | null>(null);

  const refresh = useCallback(
    async (dir: string) => {
      try {
        const text = await window.solarchitect.readTemplates(dir);
        setTemplatesText(text);
        const result = parseTemplates(text);
        if (result.ok) {
          setTemplates(result.templates);
          setYamlError(null);
        } else {
          setYamlError(result.error.message);
        }
      } catch (e) {
        onError(`Could not read templates: ${(e as Error).message}`);
      }
    },
    [onError],
  );

  useEffect(() => {
    if (projectDir) void refresh(projectDir);
    else {
      setTemplates([]);
      setTemplatesText(EMPTY_TEMPLATES);
    }
  }, [projectDir, refresh]);

  const templateExists = useCallback((name: string) => templates.some((t) => t.name === name), [templates]);

  const persist = useCallback(
    async (next: NamedTemplate[]) => {
      const text = serializeTemplates(next);
      setTemplates(next);
      setTemplatesText(text);
      setYamlError(null);
      if (projectDir) {
        try {
          await window.solarchitect.writeTemplates(projectDir, text);
        } catch (e) {
          onError(`Could not save templates: ${(e as Error).message}`);
        }
      }
    },
    [projectDir, onError],
  );

  const saveTemplate = useCallback(
    (name: string, diagram: Diagram) => {
      // Overwrite by name (the UI confirms before calling on a conflict).
      void persist([...templates.filter((t) => t.name !== name), { name, diagram }]);
    },
    [templates, persist],
  );

  // Hand-edit the templates library as YAML. On success the panel updates and
  // the file is written; on a parse error it freezes (library unchanged) and
  // reports the error, mirroring the diagram editor.
  const applyTemplatesYaml = useCallback(
    (text: string) => {
      const result = parseTemplates(text);
      if (!result.ok) {
        setYamlError(result.error.message);
        return;
      }
      void persist(result.templates);
    },
    [persist],
  );

  return { templates, templatesText, yamlError, templateExists, saveTemplate, applyTemplatesYaml };
}
