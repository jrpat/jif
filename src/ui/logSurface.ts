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

function isLogSurfaceMode(mode: FocusMode): mode is LogSurfaceMode {
  return mode === "revisions" ||
    mode === "files" ||
    mode === "op-log" ||
    mode === "evolog" ||
    mode === "notifications";
}
