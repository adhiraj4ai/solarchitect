import { useCallback, useEffect, useState } from 'react';
import { resolveActivePanelForType, type PanelId } from '@shared/shell/panels';
import type { DocumentType } from '@shared/project/documentType';

/**
 * Owns the activity-bar/sidebar layout: which panel is active (remembered per
 * surface), whether the sidebar is collapsed, and its width. This is ephemeral,
 * per-machine UI state, so it lives in localStorage rather than crossing into
 * the main process's file store. The active panel is derived through the pure
 * resolveActivePanelForType so a panel unavailable on the current document type
 * (e.g. Shapes on a Whiteboard) falls back without discarding the remembered
 * preference.
 */

const LS_KEY = 'solarchitect.layout.v2';
const DEFAULT_WIDTH = 264;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 560;

interface LayoutState {
  preferredByType: Partial<Record<DocumentType, PanelId>>;
  collapsed: boolean;
  width: number;
}

const clampWidth = (w: number) => Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Math.round(w)));

function load(): LayoutState {
  const fallback: LayoutState = { preferredByType: {}, collapsed: false, width: DEFAULT_WIDTH };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LayoutState>;
    return {
      preferredByType:
        typeof parsed.preferredByType === 'object' && parsed.preferredByType
          ? parsed.preferredByType
          : {},
      collapsed: typeof parsed.collapsed === 'boolean' ? parsed.collapsed : false,
      width: typeof parsed.width === 'number' ? clampWidth(parsed.width) : DEFAULT_WIDTH,
    };
  } catch {
    return fallback;
  }
}

export function useWorkspaceLayout(type: DocumentType) {
  const [state, setState] = useState<LayoutState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — layout just won't persist this session */
    }
  }, [state]);

  const activePanel = resolveActivePanelForType(type, state.preferredByType);

  // Selecting the already-active panel collapses the sidebar (VS Code behavior);
  // selecting any other panel opens it and remembers the choice for this type.
  const selectPanel = useCallback(
    (panel: PanelId) => {
      setState((s) => {
        const current = resolveActivePanelForType(type, s.preferredByType);
        if (!s.collapsed && panel === current) return { ...s, collapsed: true };
        return { ...s, collapsed: false, preferredByType: { ...s.preferredByType, [type]: panel } };
      });
    },
    [type],
  );

  const toggleCollapsed = useCallback(() => setState((s) => ({ ...s, collapsed: !s.collapsed })), []);

  const setWidth = useCallback((w: number) => setState((s) => ({ ...s, width: clampWidth(w) })), []);

  return {
    activePanel,
    collapsed: state.collapsed,
    width: state.width,
    selectPanel,
    toggleCollapsed,
    setWidth,
  };
}
