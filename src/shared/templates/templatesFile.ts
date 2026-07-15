import { parse as parseYaml, stringify } from 'yaml';
import { serializeDiagram } from '../yaml/serialize';
import { parseDiagram } from '../yaml/parse';
import type { Diagram } from '../ir/types';

// Kept consistent with the diagram serializer's options.
function stringifyDoc(obj: unknown): string {
  return stringify(obj, { sortMapEntries: true });
}

export interface NamedTemplate {
  name: string;
  diagram: Diagram;
}

export type TemplatesParseResult =
  | { ok: true; templates: NamedTemplate[] }
  | { ok: false; error: { message: string } };

/**
 * The shared templates file is a list of named templates, each holding a
 * diagram-shaped subtree. Each subtree is serialized with the diagram
 * serializer so the whole file reads like the diagrams it complements.
 */
export function serializeTemplates(templates: NamedTemplate[]): string {
  // serializeDiagram emits a full YAML doc; nest it under each template by
  // re-parsing to a plain object so the outer document stays a single tree.
  const doc = {
    templates: templates.map((t) => ({ name: t.name, diagram: parseYaml(serializeDiagram(t.diagram)) })),
  };
  // Reuse the diagram serializer's YAML engine indirectly via a fresh stringify.
  return stringifyDoc(doc);
}

export function parseTemplates(yamlText: string): TemplatesParseResult {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText) ?? {};
  } catch (e) {
    return { ok: false, error: { message: `YAML syntax error: ${(e as Error).message}` } };
  }

  const list = (raw as { templates?: unknown }).templates;
  if (list === undefined || list === null) return { ok: true, templates: [] };
  if (!Array.isArray(list)) return { ok: false, error: { message: '"templates" must be a list' } };

  const templates: NamedTemplate[] = [];
  for (let i = 0; i < list.length; i++) {
    const entry = list[i] as { name?: unknown; diagram?: unknown };
    if (typeof entry?.name !== 'string') {
      return { ok: false, error: { message: `templates[${i}].name must be a string` } };
    }
    const diagramResult = parseDiagram(stringifyDoc(entry.diagram ?? {}));
    if (!diagramResult.ok) {
      return { ok: false, error: { message: `templates[${i}] (${entry.name}): ${diagramResult.error.message}` } };
    }
    templates.push({ name: entry.name, diagram: diagramResult.diagram });
  }
  return { ok: true, templates };
}
