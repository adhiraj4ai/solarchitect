import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  listDocuments,
  readDocument,
  writeDocument,
  createDocument,
  readDocumentAtRef,
} from './projectManager';

const EMPTY_DIAGRAM = 'nodes: []\nedges: []\nclusters: []\n';

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(path.join(tmpdir(), 'solarchitect-test-'));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe('projectManager documents', () => {
  it('writes and reads back any document verbatim', async () => {
    await writeDocument(projectDir, 'notes.md', '# Title\n');
    expect(await readDocument(projectDir, 'notes.md')).toBe('# Title\n');
  });

  it('lists documents of every type with their type, ignoring templates.yaml', async () => {
    await writeDocument(projectDir, 'a.yaml', EMPTY_DIAGRAM);
    await writeDocument(projectDir, 'b.whiteboard.json', '{"version":1,"snapshot":null,"backdropDiagram":null}');
    await writeDocument(projectDir, 'c.md', '# hi');
    await writeFile(path.join(projectDir, 'templates.yaml'), 'templates: []\n');

    const entries = await listDocuments(projectDir);
    const byName = Object.fromEntries(entries.map((e) => [e.fileName, e.type]));
    expect(byName).toEqual({ 'a.yaml': 'diagram', 'b.whiteboard.json': 'whiteboard', 'c.md': 'markdown' });
  });

  it('validates only diagrams; a corrupt diagram is errored, others always ok', async () => {
    await writeDocument(projectDir, 'bad.yaml', 'nodes: [this is not: valid');
    await writeDocument(projectDir, 'x.whiteboard.json', '{not json'); // still ok: not validated
    const entries = await listDocuments(projectDir);
    expect(entries.find((e) => e.fileName === 'bad.yaml')?.status).toBe('error');
    expect(entries.find((e) => e.fileName === 'bad.yaml')?.errorMessage).toBeTruthy();
    expect(entries.find((e) => e.fileName === 'x.whiteboard.json')?.status).toBe('ok');
  });

  it('marks a diagram with an unknown node type as errored', async () => {
    await writeDocument(
      projectDir,
      'unknown.yaml',
      'nodes:\n  - id: n1\n    type: not.a.type\n    label: X\n    x: 0\n    y: 0\nedges: []\nclusters: []\n',
    );
    const [entry] = await listDocuments(projectDir);
    expect(entry.status).toBe('error');
    expect(entry.errorMessage).toMatch(/Unknown node type/);
  });

  it('creates an auto-named document per type, disambiguating collisions', async () => {
    expect(await createDocument(projectDir, 'diagram')).toBe('untitled.yaml');
    expect(await createDocument(projectDir, 'diagram')).toBe('untitled-2.yaml');
    expect(await createDocument(projectDir, 'whiteboard')).toBe('untitled.whiteboard.json');
    expect(await createDocument(projectDir, 'markdown')).toBe('untitled.md');
  });

  it('seeds an empty diagram, a wrapped-empty whiteboard, and a starter markdown', async () => {
    const wb = await createDocument(projectDir, 'whiteboard');
    expect(JSON.parse(await readDocument(projectDir, wb))).toEqual({
      version: 1,
      snapshot: null,
      backdropDiagram: null,
    });
    const md = await createDocument(projectDir, 'markdown');
    expect(await readDocument(projectDir, md)).toContain('#');
    const dg = await createDocument(projectDir, 'diagram');
    expect(await readDocument(projectDir, dg)).toContain('nodes: []');
  });

  it('refuses to read a document at a ref that escapes the project (traversal)', async () => {
    await expect(readDocumentAtRef(projectDir, '../../etc/hosts', 'HEAD')).rejects.toThrow(/outside the project/);
  });

  it('refuses to read or write a path that escapes the project (traversal)', async () => {
    await expect(readDocument(projectDir, '../../etc/hosts')).rejects.toThrow(/outside the project/);
    await expect(writeDocument(projectDir, '../escape.yaml', 'x')).rejects.toThrow(/outside the project/);
  });
});
