import { useCallback, useEffect, useState } from 'react';
import { serializeTemplates, parseTemplates, type NamedTemplate } from '@shared/templates/templatesFile';
import type { Diagram } from '@shared/ir/types';

/** Loads/saves the project's shared templates file. Templates are available to
 *  every diagram in the project. */
export function useTemplates(projectDir: string | null, onError: (msg: string) => void) {
  const [templates, setTemplates] = useState<NamedTemplate[]>([]);

  const refresh = useCallback(
    async (dir: string) => {
      try {
        const text = await window.solarchitect.readTemplates(dir);
        const result = parseTemplates(text);
        if (result.ok) setTemplates(result.templates);
        else onError(`templates.yaml: ${result.error.message}`);
      } catch (e) {
        onError(`Could not read templates: ${(e as Error).message}`);
      }
    },
    [onError],
  );

  useEffect(() => {
    if (projectDir) void refresh(projectDir);
    else setTemplates([]);
  }, [projectDir, refresh]);

  const templateExists = useCallback((name: string) => templates.some((t) => t.name === name), [templates]);

  const saveTemplate = useCallback(
    async (name: string, diagram: Diagram) => {
      if (!projectDir) return;
      // Overwrite by name (the UI confirms before calling on a conflict).
      const next = [...templates.filter((t) => t.name !== name), { name, diagram }];
      try {
        await window.solarchitect.writeTemplates(projectDir, serializeTemplates(next));
        setTemplates(next);
      } catch (e) {
        onError(`Could not save template: ${(e as Error).message}`);
      }
    },
    [projectDir, templates, onError],
  );

  return { templates, templateExists, saveTemplate };
}
