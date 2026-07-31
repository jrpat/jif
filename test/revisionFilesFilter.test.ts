import { expect, test } from "bun:test";
import {
  changedFileMatchesFilter,
  filterChangedFiles,
  getChangedFileFilterMatchRanges,
} from "../src/domain/fileFilter.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import type { AppState } from "../src/domain/types.ts";
import { commandDefinitions } from "../src/commands/definitions.ts";
import { getActiveMode, resolveCommand } from "../src/modes.ts";
import {
  applyRepositoryData,
  cancelOrBlurState,
  clearFileFilter,
  closeFocusedRevision,
  createInitialState,
  finalizeFileFilter,
  getFocusedFile,
  getVisibleExpandedFiles,
  moveFocus,
  openFileFilter,
  openFocusedRevision,
  selectAllFiles,
  setFileFilterText,
  setRevisionFiles,
  toggleFileSelection,
} from "../src/state/store.ts";

const ROW_ID = createRowId("11111111", "aaaaaaaa");

const FILES = [
  { status: "M", path: "src/ui/render.tsx" },
  { status: "M", path: "src/state/store.ts" },
  { status: "A", path: "test/render.test.ts" },
] as const;

function createExpandedState(): AppState {
  const base: AppState = {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      {
        rowId: ROW_ID,
        revisionId: "aaaaaaaa",
        parentRevisionIds: [],
        changeIdPrefixLength: 1,
        commitId: "11111111",
        description: "first",
        localTimestamp: "2026-03-30 07:22:39",
        bookmarks: [],
        workspaces: [],
        graphRows: ["@  "],
        isEmpty: false,
        hasConflict: false,
        marker: "working-copy",
        filesLoaded: true,
        files: FILES,
      },
    ],
  };

  return openFocusedRevision(base);
}

function filtered(state: AppState, query: string): AppState {
  return setFileFilterText(openFileFilter(state), query);
}

function visiblePaths(state: AppState): readonly string[] {
  return getVisibleExpandedFiles(state).map((file) => file.path);
}

test("filterChangedFiles keeps files whose path contains the query, ignoring case", () => {
  expect(filterChangedFiles(FILES, "RENDER").map((file) => file.path)).toEqual([
    "src/ui/render.tsx",
    "test/render.test.ts",
  ]);
});

test("filterChangedFiles returns every file for an empty query", () => {
  expect(filterChangedFiles(FILES, "")).toEqual(FILES);
});

test("changedFileMatchesFilter matches a rename on either its displayed or resolved path", () => {
  const rename = { status: "R", path: "src/new.ts", displayPath: "src/{old => new}.ts" };

  expect(changedFileMatchesFilter(rename, "old")).toBe(true);
  expect(changedFileMatchesFilter(rename, "src/new")).toBe(true);
  expect(changedFileMatchesFilter(rename, "missing")).toBe(false);
});

test("getChangedFileFilterMatchRanges reports every occurrence in the displayed text", () => {
  expect(getChangedFileFilterMatchRanges({ path: "src/render/render.tsx" }, "render")).toEqual([
    { start: 4, end: 10 },
    { start: 11, end: 17 },
  ]);
});

test("`/` opens the file filter from the revision-files mode", () => {
  const state = createExpandedState();

  expect(getActiveMode(state)).toBe("revision-files");
  expect(resolveCommand("revision-files", "/")).toBe("filter-files");

  const filtering = openFileFilter(state);
  expect(filtering.focusMode).toBe("file-filter");
  expect(filtering.focusModeStack).toEqual(["revisions", "files", "file-filter"]);
  expect(getActiveMode(filtering)).toBe("revision-files-filter");
});

test("filter-files is unavailable when no revision is expanded", () => {
  const command = commandDefinitions.find((definition) => definition.id === "filter-files")!;
  const collapsed = createInitialState("/tmp/repo");

  expect(command.canExecute?.(collapsed)).toBe(false);
  expect(command.canExecute?.(createExpandedState())).toBe(true);
  expect(openFileFilter(collapsed)).toBe(collapsed);
});

test("typing a filter narrows the visible files without touching the revision's files", () => {
  const state = filtered(createExpandedState(), "store");

  expect(visiblePaths(state)).toEqual(["src/state/store.ts"]);
  expect(state.revisions[0]!.files).toEqual(FILES);
});

test("a filter keeps existing file selections, including files it hides", () => {
  const selected = toggleFileSelection(createExpandedState());
  expect(selected.selectedFilePaths).toEqual(["src/ui/render.tsx"]);

  const state = filtered(selected, "store");
  expect(state.selectedFilePaths).toEqual(["src/ui/render.tsx"]);
  expect(visiblePaths(state)).toEqual(["src/state/store.ts"]);
});

test("the focused file follows its path through a narrowing filter", () => {
  const onSecondFile = moveFocus(createExpandedState(), 1);
  expect(getFocusedFile(onSecondFile)?.path).toBe("src/state/store.ts");

  const state = filtered(onSecondFile, "s");
  expect(getFocusedFile(state)?.path).toBe("src/state/store.ts");
  expect(state.focusedFileIndex).toBe(1);
});

test("focus clamps into the filtered list when the focused file is filtered out", () => {
  const onLastFile = moveFocus(moveFocus(createExpandedState(), 1), 1);
  expect(getFocusedFile(onLastFile)?.path).toBe("test/render.test.ts");

  const state = filtered(onLastFile, "src/");
  expect(state.focusedFileIndex).toBe(1);
  expect(getFocusedFile(state)?.path).toBe("src/state/store.ts");
});

test("focus stays inside the filtered list while moving", () => {
  const state = moveFocus(moveFocus(filtered(createExpandedState(), "render"), 1), 1);

  expect(state.focusedFileIndex).toBe(1);
  expect(getFocusedFile(state)?.path).toBe("test/render.test.ts");
});

test("space selects the focused file from the filtered list and advances within it", () => {
  const state = toggleFileSelection(filtered(createExpandedState(), "render"));

  expect(state.selectedFilePaths).toEqual(["src/ui/render.tsx"]);
  expect(state.focusedFileIndex).toBe(1);
  expect(getFocusedFile(state)?.path).toBe("test/render.test.ts");
});

test("select-all-files covers the visible files and leaves hidden selections alone", () => {
  const withHiddenSelection = toggleFileSelection(moveFocus(createExpandedState(), 1));
  expect(withHiddenSelection.selectedFilePaths).toEqual(["src/state/store.ts"]);

  const selected = selectAllFiles(filtered(withHiddenSelection, "render"));
  expect(selected.selectedFilePaths).toEqual([
    "src/state/store.ts",
    "src/ui/render.tsx",
    "test/render.test.ts",
  ]);

  const cleared = selectAllFiles(selected);
  expect(cleared.selectedFilePaths).toEqual(["src/state/store.ts"]);
});

test("enter keeps the filter applied and returns to the file list", () => {
  const state = finalizeFileFilter(filtered(createExpandedState(), "render"));

  expect(state.focusMode).toBe("files");
  expect(state.focusModeStack).toEqual(["revisions", "files"]);
  expect(state.fileFilterQuery).toBe("render");
  expect(visiblePaths(state)).toHaveLength(2);
});

test("escape clears the filter and returns to the file list", () => {
  const state = cancelOrBlurState(filtered(createExpandedState(), "render"));

  expect(state.focusMode).toBe("files");
  expect(state.fileFilterQuery).toBe("");
  expect(visiblePaths(state)).toHaveLength(3);
});

test("escape clears a committed filter before it collapses the revision", () => {
  const committed = finalizeFileFilter(filtered(createExpandedState(), "render"));

  const cleared = cancelOrBlurState(committed);
  expect(cleared.fileFilterQuery).toBe("");
  expect(cleared.expandedRowId).toBe(ROW_ID);

  const collapsed = cancelOrBlurState(cleared);
  expect(collapsed.expandedRowId).toBeNull();
});

test("clearFileFilter restores focus to the file the filter had narrowed to", () => {
  const state = clearFileFilter(filtered(moveFocus(createExpandedState(), 2), "render"));

  expect(state.fileFilterQuery).toBe("");
  expect(getFocusedFile(state)?.path).toBe("test/render.test.ts");
  expect(state.focusedFileIndex).toBe(2);
});

test("collapsing the revision drops the filter", () => {
  const state = closeFocusedRevision(finalizeFileFilter(filtered(createExpandedState(), "render")));

  expect(state.fileFilterQuery).toBe("");
  expect(state.focusMode).toBe("revisions");
});

test("the filter mode is dropped when the expanded revision goes away", () => {
  const state = applyRepositoryData(filtered(createExpandedState(), "render"), {
    repoPath: "/tmp/repo",
    revisions: [],
  });

  expect(state.focusMode).toBe("revisions");
  expect(state.focusModeStack).toEqual(["revisions"]);
  expect(state.fileFilterQuery).toBe("");
});

test("a refresh that keeps the expanded revision keeps its filter and focused file", () => {
  const before = filtered(moveFocus(createExpandedState(), 2), "render");
  expect(getFocusedFile(before)?.path).toBe("test/render.test.ts");

  const state = applyRepositoryData(before, {
    repoPath: "/tmp/repo",
    revisions: [createExpandedState().revisions[0]!],
  });

  expect(state.focusMode).toBe("file-filter");
  expect(state.fileFilterQuery).toBe("render");
  expect(getFocusedFile(state)?.path).toBe("test/render.test.ts");
});

test("reloaded files re-clamp focus against the filtered list", () => {
  const state = setRevisionFiles(
    filtered(moveFocus(createExpandedState(), 2), "render"),
    ROW_ID,
    [{ status: "M", path: "src/ui/render.tsx" }],
  );

  expect(state.focusedFileIndex).toBe(0);
  expect(getFocusedFile(state)?.path).toBe("src/ui/render.tsx");
});

test("only the focused filter input can change the query", () => {
  const committed = finalizeFileFilter(filtered(createExpandedState(), "render"));

  // The inline input replays its initial value as an INPUT event when it
  // remounts; that must not wipe a committed query.
  expect(setFileFilterText(committed, "").fileFilterQuery).toBe("render");
});

test("file commands report no focused file when the filter hides everything", () => {
  const state = filtered(createExpandedState(), "nothing-matches-this");
  const showDiff = commandDefinitions.find((definition) => definition.id === "show-diff")!;

  expect(getFocusedFile(state)).toBeNull();
  expect(showDiff.canExecute?.(state)).toBe(false);
});
