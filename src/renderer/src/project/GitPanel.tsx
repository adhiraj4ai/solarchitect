import { useState } from 'react';
import type { GitState } from '../hooks/useGit';

/** Full git surface for the open project: branch switch/create, changed files,
 *  commit with a message, push/pull, and recent history. Git state is shared
 *  (via useGit) with the bottom status bar; all git runs in the main process. */
export function GitPanel({
  projectDir,
  git,
  canReview,
  onReviewChanges,
}: {
  projectDir: string | null;
  git: GitState;
  canReview?: boolean;
  onReviewChanges?: () => void;
}) {
  const { detail, busy, status } = git;
  const act = git.run;
  const [commitMsg, setCommitMsg] = useState('');
  const [branchMenu, setBranchMenu] = useState(false);
  const [newBranch, setNewBranch] = useState('');

  if (!projectDir) return null;

  if (!detail?.isRepo) {
    return (
      <div className="git">
        <div className="git__head">
          <span className="eyebrow">Version control</span>
        </div>
        <div className="git__empty">Not a git repository.</div>
        <button
          className="btn btn--sm"
          data-testid="git-init-btn"
          disabled={busy}
          onClick={() => void act(() => window.solarchitect.gitInit(projectDir))}
        >
          Initialize repository
        </button>
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

      {onReviewChanges && (
        <button
          className="btn btn--sm git__review"
          data-testid="git-review-btn"
          disabled={!canReview}
          onClick={onReviewChanges}
          title={canReview ? 'Review this diagram’s changes since the last commit' : 'Open a diagram to review its changes'}
        >
          ◨ Review changes
        </button>
      )}

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
