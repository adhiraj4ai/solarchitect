import { useCallback, useEffect, useRef, useState } from 'react';
import type { GitDetail } from '@shared/project/types';

export interface GitState {
  detail: GitDetail | null;
  busy: boolean;
  status: string;
  refresh: () => Promise<void>;
  /** Run a git action, surface its message, then refresh the detail. */
  run: (fn: () => Promise<{ ok: boolean; message: string }>) => Promise<void>;
}

/**
 * Shared git state for the open project. One instance drives both the sidebar
 * Version Control panel and the bottom status bar, so they never drift.
 */
export function useGit(projectDir: string | null, onError: (msg: string) => void): GitState {
  const [detail, setDetail] = useState<GitDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
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

  const run = useCallback(
    async (fn: () => Promise<{ ok: boolean; message: string }>) => {
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
    [onError, refresh],
  );

  return { detail, busy, status, refresh, run };
}
