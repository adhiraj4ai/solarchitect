import { useCallback, useEffect, useRef, useState } from 'react';
import type { GitDetail } from '@shared/project/types';

/** Full git surface for the open project: branch switch/create, changed files,
 *  commit with a message, push/pull, and recent history. All git runs in the
 *  main process via the preload bridge. */
export function GitPanel({ projectDir, onError }: { projectDir: string | null; onError: (msg: string) => void }) {
  const [detail, setDetail] = useState<GitDetail | null>(null);
  const [commitMsg, setCommitMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [branchMenu, setBranchMenu] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    if (!projectDir) {
      setDetail(null);
      return;
    }
    const mine = ++seq.current;
    const d = await window.solarchitect.gitDetail(projectDir);
    if (mine === seq.current) setDetail(d);
  }, [projectDir]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Run a git action, surface its message, then refresh.
  const act = useCallback(
    async (fn: () => Promise<{ ok: boolean; message: string }>) => {
      if (busy) return;
      setBusy(true);
      setStatus('');
      try {
        const r = await fn();
        setStatus(r.message);
        if (!r.ok) onError(r.message);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [busy, onError, refresh],
  );

  if (!projectDir) return null;

  if (!detail?.isRepo) {
    return (
      <div className="git">
        <div className="git__head">
          <span className="eyebrow">Version control</span>
        </div>
        <div className="git__empty">Not a git repository.</div>
      </div>
    );
  }

  const dirty = detail.files.length;

  return (
    <div className="git">
      <div className="git__head">
        <span className="eyebrow">Version control</span>
        <div className="git__branch-wrap">
          <button
            className="btn btn--sm"
            data-testid="git-branch-btn"
            onClick={() => setBranchMenu((v) => !v)}
            title="Switch or create a branch"
          >
            ⎇ {detail.branch ?? 'detached'} ▾
          </button>
          {branchMenu && (
            <div className="git__branch-menu" role="menu">
              {detail.branches.map((b) => (
                <button
                  key={b}
                  role="menuitem"
                  className={`git__branch-item${b === detail.branch ? ' on' : ''}`}
                  onClick={() => {
                    setBranchMenu(false);
                    if (b !== detail.branch) void act(() => window.solarchitect.gitCheckoutBranch(projectDir, b));
                  }}
                >
                  {b === detail.branch ? '● ' : ''}
                  {b}
                </button>
              ))}
              <div className="git__branch-new">
                <input
                  className="props-input"
                  placeholder="new-branch"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newBranch.trim()) {
                      const name = newBranch.trim();
                      setNewBranch('');
                      setBranchMenu(false);
                      void act(() => window.solarchitect.gitCreateBranch(projectDir, name));
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="git__remote">
        {detail.hasRemote ? (
          <>
            <button
              className="btn btn--sm"
              data-testid="git-pull-btn"
              disabled={busy}
              onClick={() => void act(() => window.solarchitect.gitPull(projectDir))}
              title="Pull (rebase) from the remote"
            >
              ↓ Pull{detail.behind ? ` ${detail.behind}` : ''}
            </button>
            <button
              className="btn btn--sm"
              data-testid="git-push-btn"
              disabled={busy}
              onClick={() => void act(() => window.solarchitect.gitPush(projectDir))}
              title="Push to the remote"
            >
              ↑ Push{detail.ahead ? ` ${detail.ahead}` : ''}
            </button>
          </>
        ) : (
          <span className="git__norem">No remote configured</span>
        )}
      </div>

      <div className="git__changes">
        <div className="git__changes-head">
          <span>{dirty === 0 ? 'No changes' : `${dirty} change${dirty === 1 ? '' : 's'}`}</span>
        </div>
        {dirty > 0 && (
          <ul className="git__files" data-testid="git-files">
            {detail.files.slice(0, 8).map((f) => (
              <li key={f.path} className={`git__file${f.staged ? ' staged' : ''}`}>
                <span className="git__file-code">{f.code.trim() || '•'}</span>
                <span className="git__file-path">{f.path}</span>
              </li>
            ))}
            {dirty > 8 && <li className="git__file more">+{dirty - 8} more</li>}
          </ul>
        )}
        <div className="git__commit">
          <input
            className="props-input"
            data-testid="git-commit-msg"
            placeholder="Commit message"
            value={commitMsg}
            disabled={dirty === 0}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && commitMsg.trim() && dirty > 0) {
                const m = commitMsg.trim();
                setCommitMsg('');
                void act(() => window.solarchitect.gitCommit(projectDir, m));
              }
            }}
          />
          <button
            className="btn btn--sm btn--primary"
            data-testid="git-commit-btn"
            disabled={busy || dirty === 0 || !commitMsg.trim()}
            onClick={() => {
              const m = commitMsg.trim();
              setCommitMsg('');
              void act(() => window.solarchitect.gitCommit(projectDir, m));
            }}
          >
            Commit
          </button>
        </div>
      </div>

      {detail.log.length > 0 && (
        <details className="git__history">
          <summary>History</summary>
          <ul>
            {detail.log.map((c) => (
              <li key={c.hash}>
                <span className="git__log-hash">{c.hash}</span>
                <span className="git__log-subject">{c.subject}</span>
                <span className="git__log-meta">
                  {c.author} · {c.relDate}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {status && <div className="git__status">{status}</div>}
    </div>
  );
}
