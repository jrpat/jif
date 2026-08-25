import { expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import { createInitialState } from "../src/state/store.ts";
import { getFocusedLogRowId, resolveLogSurfaceMode } from "../src/ui/logSurface.ts";

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

test("focused log rows resolve to their rendered ids", () => {
  const revisionState: AppState = {
    ...createState(),
    revisions: [{ rowId: "revision-row" } as AppState["revisions"][number]],
  };
  expect(getFocusedLogRowId(revisionState)).toBe("revision-slot-header-revision-row");

  expect(getFocusedLogRowId({
    ...createState(),
    focusMode: "op-log",
    focusModeStack: ["revisions", "op-log"],
    focusedOperationLogIndex: 2,
  })).toBe("operation-log-entry-2");

  expect(getFocusedLogRowId({
    ...createState(),
    focusMode: "evolog",
    focusModeStack: ["revisions", "evolog"],
    focusedEvologIndex: 3,
  })).toBe("evolog-entry-3");
});
