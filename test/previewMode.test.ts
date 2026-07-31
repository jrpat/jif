import { describe, expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import {
  cancelOrBlurState,
  createInitialState,
  enterPreviewMode,
  exitPreviewMode,
} from "../src/state/store.ts";
import {
  collectDirectCanonicalBindingsForMode,
  defaultKeymap,
  getActiveMode,
  isKeyExplicitlyUnbound,
  resolveCommand,
} from "../src/modes.ts";
import { commandDefinitions } from "../src/commands/definitions.ts";

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

  test("preview mode exposes only the requested manipulation bindings", () => {
    const bindings = collectDirectCanonicalBindingsForMode("preview", defaultKeymap);
    expect(Object.fromEntries(bindings.map(({ key, commandId }) => [key, commandId]))).toEqual({
      P: "exit-preview-mode",
      j: "preview-mode-scroll-down",
      k: "preview-mode-scroll-up",
      J: "scroll-preview-down-large",
      K: "scroll-preview-up-large",
      "ctrl-d": "scroll-preview-down-half-page",
      "ctrl-u": "scroll-preview-up-half-page",
      "ctrl-f": "scroll-preview-down-page",
      "ctrl-b": "scroll-preview-up-page",
      h: "expand-preview-fine",
      l: "shrink-preview-fine",
      H: "preview-mode-expand",
      L: "preview-mode-shrink",
      "alt-p": "preview-mode-cycle-position",
      w: "preview-mode-toggle-word-wrap",
      "ctrl-enter": "preview-mode-toggle-full-file",
    });
  });

  test("q is inert so only escape and P exit preview mode", () => {
    expect(isKeyExplicitlyUnbound("preview", "q", defaultKeymap)).toBeTrue();
    expect(resolveCommand("preview", "q", defaultKeymap)).toBeNull();
  });

  test("P enters preview mode while alt-p owns position cycling in browse modes", () => {
    for (const mode of ["revision-log", "revision-files", "op-log", "evolog"] as const) {
      expect(resolveCommand(mode, "P", defaultKeymap)).toBe("enter-preview-mode");
      expect(resolveCommand(mode, "alt-p", defaultKeymap)).toBe("cycle-preview-position");
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
      "preview-mode-expand",
      "preview-mode-shrink",
      "expand-preview-fine",
      "shrink-preview-fine",
      "preview-mode-scroll-down",
      "preview-mode-scroll-up",
      "scroll-preview-down-large",
      "scroll-preview-up-large",
      "scroll-preview-down-half-page",
      "scroll-preview-up-half-page",
      "scroll-preview-down-page",
      "scroll-preview-up-page",
    ].map((id) => [id, titleById.get(id)]))).toEqual({
      "exit-preview-mode": "Close",
      "preview-mode-cycle-position": "Position",
      "preview-mode-toggle-word-wrap": "Word Wrap",
      "preview-mode-toggle-full-file": "Full File",
      "preview-mode-expand": "Grow",
      "preview-mode-shrink": "Shrink",
      "expand-preview-fine": "Grow 1 Cell",
      "shrink-preview-fine": "Shrink 1 Cell",
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
