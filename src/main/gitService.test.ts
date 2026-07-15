import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gitStatus, gitInit, gitSync } from './gitService';

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
    // Some CI/dev environments have no default git identity; set one for the repo.
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const run = promisify(execFile);
    await run('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
    await run('git', ['config', 'user.name', 'Test'], { cwd: dir });

    await writeFile(path.join(dir, 'overview.yaml'), 'nodes: []\n');
    const r = await gitSync(dir, 'first commit');
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/no remote/i);

    const after = await gitStatus(dir);
    expect(after.dirty).toBe(0); // committed, working tree clean
  });
});
