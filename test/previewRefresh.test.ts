import { expect, test } from "bun:test";
import { createComputed, createRoot, createSignal } from "solid-js";
import type { AppState } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import { resolveAppConfig } from "../src/config/index.ts";
import {
  EMPTY_RENDERED_PREVIEW,
  completePreviewRefresh,
  createPreviewPanePresentation,
  failPreviewRefresh,
  getPreviewTargetKey,
  resolvePreviewScrollPosition,
  startPreviewRefresh,
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

test("starting a preview refresh retains the complete rendered preview", () => {
  const rendered = {
    targetKey: "old-target",
    header: "old metadata\n\nold description",
    diff: "old diff",
    loading: false,
  };

  expect(startPreviewRefresh(rendered)).toEqual({
    ...rendered,
    loading: true,
  });
});

test("completing a preview refresh swaps the whole rendered preview", () => {
  expect(completePreviewRefresh("new-target", {
    header: "new metadata\n\nnew description",
    diff: "new diff",
  })).toEqual({
    targetKey: "new-target",
    header: "new metadata\n\nnew description",
    diff: "new diff",
    loading: false,
  });
});

test("a failed preview refresh keeps the previous content", () => {
  const rendered = startPreviewRefresh({
    targetKey: "old-target",
    header: "old header",
    diff: "old diff",
    loading: false,
  });

  expect(failPreviewRefresh(rendered)).toEqual({
    targetKey: "old-target",
    header: "old header",
    diff: "old diff",
    loading: false,
  });
  expect(failPreviewRefresh(EMPTY_RENDERED_PREVIEW)).toBe(EMPTY_RENDERED_PREVIEW);
});

test("extra mode leaves preview presentation consumers undisturbed", () => {
  createRoot((dispose) => {
    const [state, setState] = createSignal<AppState>(createFilesState({
      focusMode: "revisions",
      focusModeStack: ["revisions"],
    }));
    const config = resolveAppConfig({});
    const presentation = createPreviewPanePresentation({
      getState: state,
      getConfig: () => config.preview,
      getTerminalWidth: () => 160,
    });
    let shownConsumerRuns = 0;
    let fullScreenConsumerRuns = 0;

    createComputed(() => {
      presentation.shown();
      shownConsumerRuns += 1;
    });
    createComputed(() => {
      presentation.fullScreen();
      fullScreenConsumerRuns += 1;
    });

    setState((current) => ({
      ...current,
      focusMode: "extra",
      focusModeStack: ["revisions", "extra"],
    }));
    setState((current) => ({
      ...current,
      focusMode: "revisions",
      focusModeStack: ["revisions"],
    }));

    expect(shownConsumerRuns).toBe(1);
    expect(fullScreenConsumerRuns).toBe(1);
    dispose();
  });
});
