import { useCallback, useEffect, useState } from 'react';
import { resolveActivePanel, type PanelId, type Surface } from '@shared/shell/panels';

/**
 * Owns the activity-bar/sidebar layout: which panel is active (remembered per
 * surface), whether the sidebar is collapsed, and its width. This is ephemeral,
 * per-machine UI state, so it lives in localStorage rather than crossing into
 * the main process's file store. The active panel is derived through the pure
 * resolveActivePanel so a panel unavailable on the current surface (e.g. Shapes
 * on the Whiteboard) falls back without discarding the remembered preference.
 */

const LS_KEY = 'solarchitect.layout.v1';
const DEFAULT_WIDTH = 264;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 560;

interface LayoutState {
  preferredBySurface: Partial<Record<Surface, PanelId>>;
  collapsed: boolean;
  width: number;
}

const clampWidth = (w: number) => Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Math.round(w)));

function load(): LayoutState {
  const fallback: LayoutState = { preferredBySurface: {}, collapsed: false, width: DEFAULT_WIDTH };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LayoutState>;
    return {
      preferredBySurface:
        typeof parsed.preferredBySurface === 'object' && parsed.preferredBySurface
          ? parsed.preferredBySurface
          : {},
      collapsed: typeof parsed.collapsed === 'boolean' ? parsed.collapsed : false,
      width: typeof parsed.width === 'number' ? clampWidth(parsed.width) : DEFAULT_WIDTH,
    };
  } catch {
    return fallback;
  }
}

export function useWorkspaceLayout(surface: Surface) {
  const [state, setState] = useState<LayoutState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — layout just won't persist this session */
    }
  }, [state]);

  const activePanel = resolveActivePanel(surface, state.preferredBySurface);

  // Selecting the already-active panel collapses the sidebar (VS Code behavior);
  // selecting any other panel opens it and remembers the choice for this surface.
  const selectPanel = useCallback(
    (panel: PanelId) => {
      setState((s) => {
        const current = resolveActivePanel(surface, s.preferredBySurface);
        if (!s.collapsed && panel === current) return { ...s, collapsed: true };
        return { ...s, collapsed: false, preferredBySurface: { ...s.preferredBySurface, [surface]: panel } };
      });
    },
    [surface],
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
