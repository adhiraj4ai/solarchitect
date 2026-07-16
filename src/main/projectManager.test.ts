import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  listDiagrams,
  readDiagram,
  writeDiagram,
  createDiagram,
  readWhiteboard,
  writeWhiteboard,
  whiteboardName,
} from './projectManager';
import { access } from 'node:fs/promises';

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

const EMPTY_DOC = 'nodes: []\nedges: []\nclusters: []\nannotations: []\n';

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(path.join(tmpdir(), 'solarchitect-test-'));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe('projectManager', () => {
  it('writes and reads back a diagram file verbatim', async () => {
    const yaml = `nodes:
  - id: n1
    type: aws.compute.EC2
    label: Web
    x: 42
    y: 99
edges: []
clusters: []
annotations: []
`;
    await writeDiagram(projectDir, 'overview.yaml', yaml);
    expect(await readDiagram(projectDir, 'overview.yaml')).toBe(yaml);
  });

  it('lists diagram files, marking a corrupt one as errored without blocking the rest', async () => {
    await writeDiagram(projectDir, 'ok.yaml', EMPTY_DOC);
    await writeDiagram(projectDir, 'bad.yaml', 'nodes: [this is not: valid yaml');

    const entries = await listDiagrams(projectDir);
    const ok = entries.find((e) => e.fileName === 'ok.yaml');
    const bad = entries.find((e) => e.fileName === 'bad.yaml');

    expect(entries).toHaveLength(2);
    expect(ok?.status).toBe('ok');
    expect(bad?.status).toBe('error');
    expect(bad?.errorMessage).toBeTruthy();
  });

  it('marks a diagram with an unknown node type as errored', async () => {
    await writeDiagram(projectDir, 'unknown.yaml', 'nodes:\n  - id: n1\n    type: not.a.type\n    label: X\n    x: 0\n    y: 0\nedges: []\nclusters: []\nannotations: []\n');
    const [entry] = await listDiagrams(projectDir);
    expect(entry.status).toBe('error');
    expect(entry.errorMessage).toMatch(/Unknown node type/);
  });

  it('ignores non-yaml files and the templates file when listing', async () => {
    await writeDiagram(projectDir, 'a.yaml', EMPTY_DOC);
    await writeFile(path.join(projectDir, 'readme.md'), '# notes');
    await writeFile(path.join(projectDir, 'templates.yaml'), 'templates: []\n');
    const entries = await listDiagrams(projectDir);
    expect(entries.map((e) => e.fileName)).toEqual(['a.yaml']);
  });

  it('creates a new empty diagram file and returns its name', async () => {
    const fileName = await createDiagram(projectDir, 'My Diagram');
    expect(fileName).toMatch(/\.yaml$/);
    const text = await readDiagram(projectDir, fileName);
    expect(text).toContain('nodes: []');
  });

  it('refuses to read or write a path that escapes the project (traversal)', async () => {
    await expect(readDiagram(projectDir, '../../etc/hosts')).rejects.toThrow(/outside the project/);
    await expect(writeDiagram(projectDir, '../escape.yaml', 'x')).rejects.toThrow(/outside the project/);
  });

  it('does not overwrite an existing file when creating a same-named diagram', async () => {
    const first = await createDiagram(projectDir, 'dup');
    const second = await createDiagram(projectDir, 'dup');
    expect(second).not.toBe(first);
    const entries = await listDiagrams(projectDir);
    expect(entries).toHaveLength(2);
  });

  describe('whiteboard sidecar', () => {
    it('derives the sidecar name from the diagram file', () => {
      expect(whiteboardName('payments.yaml')).toBe('payments.whiteboard.json');
      expect(whiteboardName('a.yml')).toBe('a.whiteboard.json');
    });

    it('round-trips a snapshot', async () => {
      await writeDiagram(projectDir, 'd.yaml', EMPTY_DOC);
      const snap = '{"store":{"shape:1":{"typeName":"shape"}}}';
      await writeWhiteboard(projectDir, 'd.yaml', snap);
      expect(await readWhiteboard(projectDir, 'd.yaml')).toBe(snap);
    });

    it('reads a missing sidecar as null (blank whiteboard)', async () => {
      expect(await readWhiteboard(projectDir, 'never.yaml')).toBeNull();
    });

    it('is lazy: a null/empty snapshot writes no file and removes an existing one', async () => {
      const sidecar = path.join(projectDir, whiteboardName('d.yaml'));
      await writeWhiteboard(projectDir, 'd.yaml', null);
      expect(await exists(sidecar)).toBe(false);

      await writeWhiteboard(projectDir, 'd.yaml', '{"store":{}}');
      expect(await exists(sidecar)).toBe(true);

      await writeWhiteboard(projectDir, 'd.yaml', ''); // emptied → removed
      expect(await exists(sidecar)).toBe(false);
    });

    it('is excluded from the diagram list', async () => {
      await writeDiagram(projectDir, 'd.yaml', EMPTY_DOC);
      await writeWhiteboard(projectDir, 'd.yaml', '{"store":{}}');
      const entries = await listDiagrams(projectDir);
      expect(entries.map((e) => e.fileName)).toEqual(['d.yaml']);
    });

    it('refuses a path that escapes the project', async () => {
      await expect(readWhiteboard(projectDir, '../../etc/passwd')).rejects.toThrow(/outside the project/);
    });
  });
});
