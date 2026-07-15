import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listDiagrams, readDiagram, writeDiagram, createDiagram } from './projectManager';

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

  it('does not overwrite an existing file when creating a same-named diagram', async () => {
    const first = await createDiagram(projectDir, 'dup');
    const second = await createDiagram(projectDir, 'dup');
    expect(second).not.toBe(first);
    const entries = await listDiagrams(projectDir);
    expect(entries).toHaveLength(2);
  });
});
