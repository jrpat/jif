import { expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import { createInitialState } from "../src/state/store.ts";
import { resolveLogSurfaceMode } from "../src/ui/logSurface.ts";

function createState(): AppState {
  return createInitialState("/tmp/repo");
}

test("command prompts preserve their originating shared-log surface", () => {
  for (const origin of ["op-log", "evolog"] as const) {
    const state: AppState = {
      ...createState(),
      focusMode: "command",
      focusModeStack: ["revisions", origin, "command"],
    };

    expect(resolveLogSurfaceMode(state)).toBe(origin);
  }
});

test("active log surfaces and notifications render themselves", () => {
  for (const focusMode of ["revisions", "files", "op-log", "evolog", "notifications"] as const) {
    const state: AppState = {
      ...createState(),
      focusMode,
      focusModeStack: focusMode === "revisions"
        ? ["revisions"]
        : ["revisions", focusMode],
    };

    expect(resolveLogSurfaceMode(state)).toBe(focusMode);
  }
});
