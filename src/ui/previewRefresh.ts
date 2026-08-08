import { createMemo, type Accessor } from "solid-js";
import type { PreviewConfig, PreviewSettings } from "../domain/preview.ts";
import { isPreviewFullScreen, isPreviewPaneShown } from "../domain/preview.ts";
import type { AppState } from "../domain/types.ts";
import {
  getExpandedRevision,
  getFocusedFile,
  getFocusedOperationLogEntry,
  getFocusedRevision,
} from "../state/store.ts";
import type { LogSurfaceMode } from "./logSurface.ts";

export type PreviewScrollPosition = Readonly<{ x: number; y: number }>;

type PreviewPaneState = Pick<AppState, "focusMode" | "previewFullScreen"> & PreviewSettings;

/**
 * Stable presentation signals for the preview pane. Focus overlays such as
 * Extra mode can change `focusMode` without changing either derived value;
 * memos keep those no-op transitions from refreshing or redrawing the pane.
 */
export function createPreviewPanePresentation(args: {
  getState: () => PreviewPaneState;
  getConfig: () => PreviewConfig;
  getTerminalWidth: () => number;
}): Readonly<{
  fullScreen: Accessor<boolean>;
  shown: Accessor<boolean>;
}> {
  return {
    fullScreen: createMemo(() => isPreviewFullScreen(args.getState())),
    shown: createMemo(() =>
      isPreviewPaneShown(args.getState(), args.getConfig(), args.getTerminalWidth())
    ),
  };
}

/**
 * Stable identity for the content shown in the preview pane. Repository
 * refreshes can replace commit and row IDs for the same logical change, so
 * revision previews use the change ID and file previews add the focused path.
 */
export function getPreviewTargetKey(
  state: AppState,
  mode: LogSurfaceMode,
): string | null {
  const target = (() => {
    if (mode === "revisions") {
      const revision = getFocusedRevision(state);
      return revision ? [mode, revision.revisionId] : null;
    }

    if (mode === "files") {
      const revision = getExpandedRevision(state);
      const filePath = getFocusedFile(state)?.path ?? state.focusedFilePath;
      return revision && filePath ? [mode, revision.revisionId, filePath] : null;
    }

    if (mode === "op-log") {
      const operation = getFocusedOperationLogEntry(state);
      return operation ? [mode, operation.id] : null;
    }

    if (mode === "evolog") {
      const entry = state.evologEntries[state.focusedEvologIndex];
      return entry ? [mode, entry.commitId ?? entry.id] : null;
    }

    return null;
  })();

  return target ? JSON.stringify([state.repoPath, ...target]) : null;
}

export function resolvePreviewScrollPosition(
  renderedTargetKey: string | null,
  nextTargetKey: string | null,
  viewport: Readonly<{ scrollLeft: number; scrollTop: number }> | undefined,
): PreviewScrollPosition {
  if (nextTargetKey !== null && nextTargetKey === renderedTargetKey && viewport) {
    return { x: viewport.scrollLeft, y: viewport.scrollTop };
  }

  return { x: 0, y: 0 };
}
