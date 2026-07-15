import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  dirty: number; // number of changed/untracked entries
  hasRemote: boolean;
}

export interface GitSyncResult {
  ok: boolean;
  message: string;
}

async function git(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await run('git', args, { cwd, maxBuffer: 1024 * 1024 });
    return { stdout, stderr, code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; code?: number; message?: string };
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? err.message ?? '', code: err.code ?? 1 };
  }
}

export async function gitStatus(dir: string): Promise<GitStatus> {
  const inside = await git(dir, ['rev-parse', '--is-inside-work-tree']);
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
    return { isRepo: false, branch: null, dirty: 0, hasRemote: false };
  }
  const [branch, porcelain, remotes] = await Promise.all([
    git(dir, ['branch', '--show-current']),
    git(dir, ['status', '--porcelain']),
    git(dir, ['remote']),
  ]);
  return {
    isRepo: true,
    branch: branch.stdout.trim() || null,
    dirty: porcelain.stdout.split('\n').filter((l) => l.trim() !== '').length,
    hasRemote: remotes.stdout.trim() !== '',
  };
}

export async function gitInit(dir: string): Promise<void> {
  await git(dir, ['init']);
}

/** Stage everything, commit (if there are changes), then pull --rebase + push when
 *  a remote exists. Returns a human-readable summary. */
export async function gitSync(dir: string, message: string): Promise<GitSyncResult> {
  const status = await gitStatus(dir);
  if (!status.isRepo) return { ok: false, message: 'This project folder is not a git repository.' };

  await git(dir, ['add', '-A']);
  const staged = await git(dir, ['status', '--porcelain']);
  const hasChanges = staged.stdout.trim() !== '';
  if (hasChanges) {
    const commit = await git(dir, ['commit', '-m', message]);
    if (commit.code !== 0) return { ok: false, message: `Commit failed: ${commit.stderr.trim()}` };
  }

  if (!status.hasRemote) {
    return { ok: true, message: hasChanges ? 'Committed. No remote configured to push to.' : 'Nothing to commit.' };
  }

  const pull = await git(dir, ['pull', '--rebase', '--autostash']);
  if (pull.code !== 0) {
    return { ok: false, message: `Pull failed (resolve conflicts in a terminal): ${pull.stderr.trim().split('\n')[0]}` };
  }
  const push = await git(dir, ['push']);
  if (push.code !== 0) {
    return { ok: false, message: `Push failed: ${push.stderr.trim().split('\n')[0]}` };
  }
  return { ok: true, message: hasChanges ? 'Committed and synced with the remote.' : 'Synced with the remote.' };
}
