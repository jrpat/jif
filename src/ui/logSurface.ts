import type { AppState, FocusMode } from "../domain/types.ts";

export type LogSurfaceMode =
  | "revisions"
  | "files"
  | "op-log"
  | "evolog"
  | "notifications";

export function resolveLogSurfaceMode(
  state: Pick<AppState, "focusMode" | "focusModeStack">,
): LogSurfaceMode {
  if (isLogSurfaceMode(state.focusMode)) {
    return state.focusMode;
  }

  for (let index = state.focusModeStack.length - 1; index >= 0; index -= 1) {
    const mode = state.focusModeStack[index];
    if (mode !== undefined && isLogSurfaceMode(mode)) {
      return mode;
    }
  }

  return "revisions";
}

export function getFocusedLogRowId(
  state: Pick<
    AppState,
    | "focusMode"
    | "focusModeStack"
    | "revisions"
    | "focusedRevisionIndex"
    | "focusedOperationLogIndex"
    | "focusedEvologIndex"
  >,
): string | null {
  switch (resolveLogSurfaceMode(state)) {
    case "revisions": {
      const revision = state.revisions[state.focusedRevisionIndex];
      return revision ? `revision-slot-header-${revision.rowId}` : null;
    }
    case "op-log":
      return `operation-log-entry-${state.focusedOperationLogIndex}`;
    case "evolog":
      return `evolog-entry-${state.focusedEvologIndex}`;
    case "files":
    case "notifications":
      return null;
  }
}

function isLogSurfaceMode(mode: FocusMode): mode is LogSurfaceMode {
  return mode === "revisions" ||
    mode === "files" ||
    mode === "op-log" ||
    mode === "evolog" ||
    mode === "notifications";
}
