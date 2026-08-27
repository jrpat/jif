import { describe, expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import {
  cancelOrBlurState,
  createInitialState,
  enterCopyMode,
  exitCopyMode,
} from "../src/state/store.ts";
import {
  bindingCommand,
  collectDirectCanonicalBindingsForMode,
  defaultKeymap,
  getActiveMode,
  resolveModeCommandTitle,
  resolveCommand,
} from "../src/modes.ts";

const ROW_ONE = createRowId("11111111", "aaaaaaaa");

function createState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [{
      rowId: ROW_ONE,
      revisionId: "aaaaaaaa",
      parentRevisionIds: [],
      changeIdPrefixLength: 1,
      commitId: "11111111",
      description: "first",
      localTimestamp: "2026-03-30 07:22:39",
      bookmarks: ["main"],
      workspaces: [],
      graphRows: ["@  "],
      isEmpty: false,
      hasConflict: false,
      marker: "working-copy",
      filesLoaded: true,
      files: [],
    }],
  };
}

describe("copy mode", () => {
  test("enterCopyMode switches getActiveMode to copy and exit restores revisions", () => {
    const entered = enterCopyMode(createState());
    expect(entered.focusMode).toBe("copy");
    expect(getActiveMode(entered)).toBe("copy");

    const exited = exitCopyMode(entered);
    expect(exited.focusMode).toBe("revisions");
    expect(getActiveMode(exited)).toBe("revision-log");
  });

  test("cancelOrBlurState exits copy mode", () => {
    const cancelled = cancelOrBlurState(enterCopyMode(createState()));
    expect(cancelled.focusMode).toBe("revisions");
  });

  test("C enters copy mode only from the revision log", () => {
    expect(resolveCommand("revision-log", "C", defaultKeymap)).toBe("enter-copy-mode");
    expect(resolveCommand("revision-files", "C", defaultKeymap)).toBeNull();
    expect(resolveCommand("revision-log", "ctrl-c", defaultKeymap)).toBeNull();
  });

  test("copy mode binds every copy target with c as the revision ID key", () => {
    expect(resolveCommand("copy", "c", defaultKeymap)).toBe("copy-revision-id");
    expect(resolveCommand("copy", "ctrl-c", defaultKeymap)).toBeNull();
    expect(resolveCommand("copy", "g", defaultKeymap)).toBe("copy-git-commit-id");
    expect(resolveCommand("copy", "d", defaultKeymap)).toBe("copy-description-summary");
    expect(resolveCommand("copy", "D", defaultKeymap)).toBe("copy-description");
    expect(resolveCommand("copy", "b", defaultKeymap)).toBe("bookmark-copy-name");

    const canonical = new Map(
      collectDirectCanonicalBindingsForMode("copy", defaultKeymap)
        .map(({ key, commandId }) => [key, commandId]),
    );
    expect(canonical.get("c")).toBe("copy-revision-id");
    expect(bindingCommand(defaultKeymap.copy.c!)).toBe("copy-revision-id");
  });

  test("copy mode provides its dynamic bookmark title and defaults everything else", () => {
    const state = enterCopyMode(createState());

    expect(resolveModeCommandTitle("copy", state, "bookmark-copy-name", "Copy Name"))
      .toBe("Bookmark");
    expect(resolveModeCommandTitle("copy", {
      ...state,
      revisions: state.revisions.map((revision) => ({
        ...revision,
        bookmarks: ["main", "release"],
      })),
    }, "bookmark-copy-name", "Copy Name")).toBe("Bookmarks");
    expect(resolveModeCommandTitle("copy", state, "copy-revision-id", "Revision ID"))
      .toBe("Revision ID");
    expect(resolveModeCommandTitle("bookmark", state, "bookmark-copy-name", "Copy Name"))
      .toBe("Copy Name");
  });
});
