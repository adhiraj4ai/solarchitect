import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gitStatus, gitInit, gitSync, gitDetail, gitCommit, gitCreateBranch, gitCheckoutBranch } from './gitService';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
async function identify(d: string) {
  await run('git', ['config', 'user.email', 'test@example.com'], { cwd: d });
  await run('git', ['config', 'user.name', 'Test'], { cwd: d });
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'solarchitect-git-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('gitService', () => {
  it('reports a non-git folder as not a repo', async () => {
    const s = await gitStatus(dir);
    expect(s.isRepo).toBe(false);
    expect(s.hasRemote).toBe(false);
  });

  it('reports a git repo with a branch and the count of changes', async () => {
    await gitInit(dir);
    await writeFile(path.join(dir, 'overview.yaml'), 'nodes: []\n');
    const s = await gitStatus(dir);
    expect(s.isRepo).toBe(true);
    expect(s.dirty).toBe(1); // one untracked file
    expect(s.hasRemote).toBe(false);
  });

  it('refuses to sync a non-git folder with a clear message', async () => {
    const r = await gitSync(dir, 'msg');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not a git repository/i);
  });

  it('commits locally when there are changes but no remote', async () => {
    await gitInit(dir);
    await identify(dir);

    await writeFile(path.join(dir, 'overview.yaml'), 'nodes: []\n');
    const r = await gitSync(dir, 'first commit');
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/no remote/i);

    const after = await gitStatus(dir);
    expect(after.dirty).toBe(0); // committed, working tree clean
  });

  it('gitDetail reports files, branch and log', async () => {
    await gitInit(dir);
    await identify(dir);
    await writeFile(path.join(dir, 'a.yaml'), 'nodes: []\n');
    await gitCommit(dir, 'add a');
    await writeFile(path.join(dir, 'b.yaml'), 'nodes: []\n'); // untracked change

    const d = await gitDetail(dir);
    expect(d.isRepo).toBe(true);
    expect(d.branch).toBeTruthy();
    expect(d.files.map((f) => f.path)).toContain('b.yaml');
    expect(d.log[0].subject).toBe('add a');
    expect(d.ahead).toBe(0);
    expect(d.behind).toBe(0);
  });

  it('gitCommit refuses an empty message and a clean tree', async () => {
    await gitInit(dir);
    await identify(dir);
    expect((await gitCommit(dir, '   ')).ok).toBe(false);
    expect((await gitCommit(dir, 'nothing to do')).message).toMatch(/nothing to commit/i);
  });

  it('creates and switches branches', async () => {
    await gitInit(dir);
    await identify(dir);
    await writeFile(path.join(dir, 'a.yaml'), 'nodes: []\n');
    await gitCommit(dir, 'init');

    const created = await gitCreateBranch(dir, 'feature-x');
    expect(created.ok).toBe(true);
    expect((await gitDetail(dir)).branch).toBe('feature-x');

    const back = await gitCheckoutBranch(dir, 'feature-x');
    expect(back.ok).toBe(true);
    expect((await gitDetail(dir)).branches).toContain('feature-x');
  });
});
