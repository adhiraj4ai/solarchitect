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

export interface GitFileChange {
  path: string;
  /** Two-char porcelain code, e.g. " M", "A ", "??". */
  code: string;
  staged: boolean;
}

export interface GitCommitInfo {
  hash: string;
  subject: string;
  author: string;
  relDate: string;
}

export interface GitDetail {
  isRepo: boolean;
  branch: string | null;
  hasRemote: boolean;
  ahead: number;
  behind: number;
  files: GitFileChange[];
  branches: string[];
  log: GitCommitInfo[];
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

export interface GitShowResult {
  ok: boolean;
  /** File bytes at the ref (empty string when not ok). */
  content: string;
  message?: string;
}

/** Read a project-relative file's content at a git ref (e.g. 'HEAD'). A path
 *  absent at that ref (a brand-new, never-committed document) returns ok:false
 *  rather than throwing, so callers can treat it as "no prior version". */
export async function gitShow(dir: string, ref: string, relPath: string): Promise<GitShowResult> {
  const r = await git(dir, ['show', `${ref}:${relPath.replace(/\\/g, '/')}`]);
  if (r.code !== 0) {
    return { ok: false, content: '', message: r.stderr.trim().split('\n')[0] || `Could not read ${relPath} at ${ref}` };
  }
  return { ok: true, content: r.stdout };
}

const US = '\x1f'; // unit separator for log parsing

/** Rich status: branch, ahead/behind, changed files, branch list, recent log. */
export async function gitDetail(dir: string, logLimit = 20): Promise<GitDetail> {
  const inside = await git(dir, ['rev-parse', '--is-inside-work-tree']);
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
    return { isRepo: false, branch: null, hasRemote: false, ahead: 0, behind: 0, files: [], branches: [], log: [] };
  }
  const [branch, porcelain, remotes, counts, branchList, log] = await Promise.all([
    git(dir, ['branch', '--show-current']),
    git(dir, ['status', '--porcelain']),
    git(dir, ['remote']),
    git(dir, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']),
    git(dir, ['branch', '--format=%(refname:short)']),
    git(dir, ['log', `-n${logLimit}`, `--pretty=format:%h${US}%s${US}%an${US}%cr`]),
  ]);

  const files: GitFileChange[] = porcelain.stdout
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const code = l.slice(0, 2);
      return { code, path: l.slice(3), staged: code[0] !== ' ' && code[0] !== '?' };
    });

  // rev-list --left-right --count @{u}...HEAD → "behind<TAB>ahead" (empty when no upstream).
  let ahead = 0;
  let behind = 0;
  if (counts.code === 0) {
    const [b, a] = counts.stdout.trim().split(/\s+/);
    behind = Number(b) || 0;
    ahead = Number(a) || 0;
  }

  const logEntries: GitCommitInfo[] =
    log.code === 0 && log.stdout.trim()
      ? log.stdout.split('\n').map((line) => {
          const [hash, subject, author, relDate] = line.split(US);
          return { hash, subject, author, relDate };
        })
      : [];

  return {
    isRepo: true,
    branch: branch.stdout.trim() || null,
    hasRemote: remotes.stdout.trim() !== '',
    ahead,
    behind,
    files,
    branches: branchList.stdout.split('\n').map((b) => b.trim()).filter(Boolean),
    log: logEntries,
  };
}

/** Stage everything and commit with the given message. */
export async function gitCommit(dir: string, message: string): Promise<GitSyncResult> {
  if (!message.trim()) return { ok: false, message: 'Enter a commit message.' };
  await git(dir, ['add', '-A']);
  const staged = await git(dir, ['status', '--porcelain']);
  if (staged.stdout.trim() === '') return { ok: false, message: 'Nothing to commit — no changes.' };
  const commit = await git(dir, ['commit', '-m', message]);
  if (commit.code !== 0) return { ok: false, message: `Commit failed: ${commit.stderr.trim().split('\n')[0]}` };
  return { ok: true, message: 'Committed.' };
}

export async function gitPush(dir: string): Promise<GitSyncResult> {
  const push = await git(dir, ['push']);
  if (push.code !== 0) return { ok: false, message: `Push failed: ${push.stderr.trim().split('\n')[0]}` };
  return { ok: true, message: 'Pushed to the remote.' };
}

export async function gitPull(dir: string): Promise<GitSyncResult> {
  const pull = await git(dir, ['pull', '--rebase', '--autostash']);
  if (pull.code !== 0) {
    return { ok: false, message: `Pull failed (resolve conflicts in a terminal): ${pull.stderr.trim().split('\n')[0]}` };
  }
  return { ok: true, message: 'Pulled from the remote.' };
}

export async function gitCreateBranch(dir: string, name: string): Promise<GitSyncResult> {
  const n = name.trim();
  if (!n) return { ok: false, message: 'Enter a branch name.' };
  const res = await git(dir, ['checkout', '-b', n]);
  if (res.code !== 0) return { ok: false, message: `Could not create branch: ${res.stderr.trim().split('\n')[0]}` };
  return { ok: true, message: `Created and switched to ${n}.` };
}

export async function gitCheckoutBranch(dir: string, name: string): Promise<GitSyncResult> {
  const res = await git(dir, ['checkout', name]);
  if (res.code !== 0) return { ok: false, message: `Could not switch branch: ${res.stderr.trim().split('\n')[0]}` };
  return { ok: true, message: `Switched to ${name}.` };
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
