import { expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import {
  getPreviewTargetKey,
  resolvePreviewScrollPosition,
} from "../src/ui/previewRefresh.ts";
import { createInitialState } from "../src/state/store.ts";

function createFilesState(overrides: Partial<AppState> = {}): AppState {
  const revisionId = "aaaaaaaa";
  const commitId = "11111111";
  return {
    ...createInitialState("/tmp/repo"),
    focusMode: "files",
    focusModeStack: ["revisions", "files"],
    revisions: [{
      rowId: createRowId(commitId, revisionId),
      revisionId,
      parentRevisionIds: [],
      changeIdPrefixLength: 1,
      commitId,
      description: "working copy",
      localTimestamp: "2026-03-30 07:22:39",
      bookmarks: [],
      workspaces: [],
      graphRows: ["@  "],
      isEmpty: false,
      hasConflict: false,
      marker: "working-copy",
      filesLoaded: true,
      files: [{ status: "M", path: "src/app.ts" }],
    }],
    expandedRowId: createRowId(commitId, revisionId),
    focusedFileIndex: 0,
    focusedFilePath: "src/app.ts",
    ...overrides,
  };
}

test("file preview target survives a rewritten commit and temporary file reload", () => {
  const before = createFilesState();
  const rewritten = createFilesState({
    revisions: [{
      ...before.revisions[0]!,
      rowId: createRowId("99999999", "aaaaaaaa"),
      commitId: "99999999",
      filesLoaded: false,
      files: [],
    }],
    expandedRowId: createRowId("99999999", "aaaaaaaa"),
    focusedFilePath: "src/app.ts",
  });

  expect(getPreviewTargetKey(before, "files")).toBe(getPreviewTargetKey(rewritten, "files"));
});

test("file preview target changes when file focus changes", () => {
  const before = createFilesState();
  const after = createFilesState({
    focusedFilePath: "src/other.ts",
    revisions: [{
      ...before.revisions[0]!,
      files: [
        { status: "M", path: "src/app.ts" },
        { status: "M", path: "src/other.ts" },
      ],
    }],
    focusedFileIndex: 1,
  });

  expect(getPreviewTargetKey(after, "files")).not.toBe(getPreviewTargetKey(before, "files"));
});

test("preview refresh preserves both scroll axes for the same logical target", () => {
  expect(resolvePreviewScrollPosition("same", "same", {
    scrollLeft: 7,
    scrollTop: 23,
  })).toEqual({ x: 7, y: 23 });
});

test("preview navigation resets scroll for a different logical target", () => {
  expect(resolvePreviewScrollPosition("before", "after", {
    scrollLeft: 7,
    scrollTop: 23,
  })).toEqual({ x: 0, y: 0 });
});
