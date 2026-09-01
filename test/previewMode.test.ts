import { describe, expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import {
  cancelOrBlurState,
  createInitialState,
  enterPreviewMode,
  exitPreviewMode,
  openShortcutFilter,
  openShortcutPanel,
  openPreviewPin,
  togglePreviewFullScreen,
} from "../src/state/store.ts";
import {
  collectDirectCanonicalBindingsForMode,
  defaultKeymap,
  getActiveMode,
  isKeyExplicitlyUnbound,
  resolveCommand,
} from "../src/modes.ts";
import { commandDefinitions } from "../src/commands/definitions.ts";
import { draftConfigs } from "../src/state/store.ts";

const ROW_ONE = createRowId("11111111", "aaaaaaaa");

function createState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      {
        rowId: ROW_ONE,
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
        files: [{ path: "src/index.ts", status: "M" }],
      },
    ],
  };
}

describe("preview mode", () => {
  test("enterPreviewMode preserves and restores the originating log surface", () => {
    const revisionPreview = enterPreviewMode(createState());
    expect(revisionPreview.focusMode).toBe("preview");
    expect(revisionPreview.focusModeStack).toEqual(["revisions", "preview"]);
    expect(getActiveMode(revisionPreview)).toBe("preview");
    expect(exitPreviewMode(revisionPreview).focusMode).toBe("revisions");

    const files = {
      ...createState(),
      expandedRowId: ROW_ONE,
      focusMode: "files" as const,
      focusModeStack: ["revisions", "files"] as const,
    };
    const filePreview = enterPreviewMode(files);
    expect(filePreview.focusModeStack).toEqual(["revisions", "files", "preview"]);
    expect(exitPreviewMode(filePreview).focusMode).toBe("files");
  });

  test("cancelOrBlurState exits preview mode", () => {
    expect(cancelOrBlurState(enterPreviewMode(createState())).focusMode).toBe("revisions");
  });

  test("shortcut filtering layers above a full-screen preview", () => {
    let state = enterPreviewMode(createState(), { fullScreen: true });
    state = openShortcutPanel(state);
    state = openShortcutFilter(state);

    expect(state.focusMode).toBe("shortcut-filter");
    expect(state.focusModeStack).toEqual(["revisions", "preview", "shortcut-filter"]);

    state = cancelOrBlurState(state);
    expect(state.focusMode).toBe("preview");
    expect(state.shortcutPanelExpanded).toBeTrue();
    expect(state.previewFullScreen).toBeTrue();

    state = cancelOrBlurState(state);
    expect(state.focusMode).toBe("preview");
    expect(state.shortcutPanelExpanded).toBeFalse();
    expect(state.previewFullScreen).toBeTrue();

    state = cancelOrBlurState(state);
    expect(state.focusMode).toBe("revisions");
  });

  test("enterPreviewMode opts into the full-screen takeover", () => {
    const split = enterPreviewMode(createState());
    expect(split.previewFullScreen).toBeFalse();

    const full = enterPreviewMode(createState(), { fullScreen: true });
    expect(full.focusMode).toBe("preview");
    expect(full.previewFullScreen).toBeTrue();
    expect(full.focusModeStack).toEqual(["revisions", "preview"]);
  });

  test("togglePreviewFullScreen flips the takeover only inside preview mode", () => {
    const full = enterPreviewMode(createState(), { fullScreen: true });
    expect(togglePreviewFullScreen(full).previewFullScreen).toBeFalse();
    expect(togglePreviewFullScreen(togglePreviewFullScreen(full)).previewFullScreen).toBeTrue();

    const browsing = createState();
    expect(togglePreviewFullScreen(browsing)).toBe(browsing);
  });

  test("leaving preview mode drops the takeover and any pinned diff", () => {
    const pinned = openPreviewPin(createState(), { header: "jj diff -r a::b", diff: "patch" });
    expect(pinned.focusMode).toBe("preview");
    expect(pinned.previewFullScreen).toBeTrue();
    expect(pinned.previewPin).toEqual({ header: "jj diff -r a::b", diff: "patch" });

    for (const exited of [exitPreviewMode(pinned), cancelOrBlurState(pinned)]) {
      expect(exited.focusMode).toBe("revisions");
      expect(exited.previewFullScreen).toBeFalse();
      expect(exited.previewPin).toBeNull();
    }
  });

  test("openPreviewPin clears a draft so the pinned diff replaces its composition", () => {
    const drafting = {
      ...createState(),
      selectedRowIds: [ROW_ONE],
      markedRowIds: [ROW_ONE],
      commandDraft: { config: draftConfigs.diff },
    };
    const pinned = openPreviewPin(drafting, { header: "jj diff -r a::b", diff: "patch" });
    expect(pinned.commandDraft).toBeNull();
    expect(pinned.selectedRowIds).toEqual([]);
    expect(pinned.focusModeStack).toEqual(["revisions", "preview"]);
  });

  test("preview mode exposes only reading controls, no pane resizing", () => {
    const bindings = collectDirectCanonicalBindingsForMode("preview", defaultKeymap);
    expect(Object.fromEntries(bindings.map(({ key, commandId }) => [key, commandId]))).toEqual({
      j: "preview-mode-scroll-down",
      k: "preview-mode-scroll-up",
      J: "scroll-preview-down-large",
      K: "scroll-preview-up-large",
      "ctrl-d": "scroll-preview-down-half-page",
      "ctrl-u": "scroll-preview-up-half-page",
      "ctrl-f": "scroll-preview-down-page",
      "ctrl-b": "scroll-preview-up-page",
      "alt-p": "preview-mode-cycle-position",
      w: "preview-mode-toggle-word-wrap",
      "ctrl-enter": "preview-mode-toggle-full-file",
      " ": "toggle-preview-full-screen",
      escape: "exit-preview-mode",
    });
  });

  test("resizing is only reachable from the log, where the split is visible", () => {
    for (const key of ["h", "l", "H", "L"]) {
      expect(resolveCommand("preview", key, defaultKeymap)).toBeNull();
    }
    for (const mode of ["revision-log", "revision-files", "op-log", "evolog"] as const) {
      expect(resolveCommand(mode, "ctrl-[", defaultKeymap)).toBe("expand-preview");
      expect(resolveCommand(mode, "ctrl-]", defaultKeymap)).toBe("shrink-preview");
    }
  });

  test("d opens the full-screen preview from every surface the pane follows", () => {
    for (const mode of ["revision-log", "revision-files", "evolog"] as const) {
      expect(resolveCommand(mode, "d", defaultKeymap)).toBe("show-diff");
    }
    // The operation log keeps its own richer `jj op diff` viewer.
    expect(resolveCommand("op-log", "d", defaultKeymap)).toBe("show-operation-diff");
  });

  test("q can fall through to global cancel while P remains unbound", () => {
    expect(isKeyExplicitlyUnbound("preview", "q", defaultKeymap)).toBeFalse();
    expect(resolveCommand("preview", "q", defaultKeymap)).toBeNull();
    expect(resolveCommand("preview", "escape", defaultKeymap)).toBe("exit-preview-mode");
    expect(resolveCommand("preview", "P", defaultKeymap)).toBeNull();
  });

  test("P no longer enters preview mode, while alt-p still cycles position", () => {
    for (const mode of ["revision-log", "revision-files", "op-log", "evolog"] as const) {
      expect(resolveCommand(mode, "P", defaultKeymap)).toBeNull();
      expect(resolveCommand(mode, "alt-p", defaultKeymap)).toBe("cycle-preview-position");
    }
  });

  test("enter aliases p on every browse surface with a split preview", () => {
    for (const mode of ["revision-log", "revision-files", "op-log", "evolog"] as const) {
      expect(resolveCommand(mode, "p", defaultKeymap)).toBe("toggle-preview");
      expect(resolveCommand(mode, "enter", defaultKeymap)).toBe("toggle-preview");
    }
  });

  test("browse-mode preview bindings retain explicit labels", () => {
    const titleById = new Map(commandDefinitions.map(({ id, title }) => [id, title]));
    expect(Object.fromEntries([
      "toggle-preview",
      "enter-preview-mode",
      "cycle-preview-position",
      "toggle-preview-word-wrap",
      "toggle-preview-full-file",
      "expand-preview",
      "shrink-preview",
      "scroll-preview-down",
      "scroll-preview-up",
    ].map((id) => [id, titleById.get(id)]))).toEqual({
      "toggle-preview": "Toggle Preview",
      "enter-preview-mode": "Preview Mode",
      "cycle-preview-position": "Preview Position",
      "toggle-preview-word-wrap": "Preview Word Wrap",
      "toggle-preview-full-file": "Full File Preview",
      "expand-preview": "Grow Preview",
      "shrink-preview": "Shrink Preview",
      "scroll-preview-down": "Scroll Preview Down",
      "scroll-preview-up": "Scroll Preview Up",
    });
  });

  test("preview-mode bindings use concise labels within their pane context", () => {
    const titleById = new Map(commandDefinitions.map(({ id, title }) => [id, title]));
    expect(Object.fromEntries([
      "exit-preview-mode",
      "preview-mode-cycle-position",
      "preview-mode-toggle-word-wrap",
      "preview-mode-toggle-full-file",
      "preview-mode-scroll-down",
      "preview-mode-scroll-up",
      "scroll-preview-down-large",
      "scroll-preview-up-large",
      "scroll-preview-down-half-page",
      "scroll-preview-up-half-page",
      "scroll-preview-down-page",
      "scroll-preview-up-page",
      "toggle-preview-full-screen",
    ].map((id) => [id, titleById.get(id)]))).toEqual({
      "exit-preview-mode": "Close",
      "preview-mode-cycle-position": "Position",
      "preview-mode-toggle-word-wrap": "Word Wrap",
      "preview-mode-toggle-full-file": "Full File",
      "toggle-preview-full-screen": "Full Screen",
      "preview-mode-scroll-down": "Scroll Down",
      "preview-mode-scroll-up": "Scroll Up",
      "scroll-preview-down-large": "Scroll Down 10",
      "scroll-preview-up-large": "Scroll Up 10",
      "scroll-preview-down-half-page": "Half Page Down",
      "scroll-preview-up-half-page": "Half Page Up",
      "scroll-preview-down-page": "Page Down",
      "scroll-preview-up-page": "Page Up",
    });
  });
});
