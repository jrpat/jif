import { describe, expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import {
  cancelOrBlurState,
  createInitialState,
  enterExtrasMode,
  exitExtrasMode,
} from "../src/state/store.ts";
import {
  collectCanonicalBindingsForMode,
  collectDirectCanonicalBindingsForMode,
  defaultKeymap,
  getActiveMode,
  resolveCommand,
} from "../src/modes.ts";
import { resolveConfiguredKeymap } from "../src/config/keymap.ts";

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
        files: [],
      },
    ],
  };
}

describe("extras mode", () => {
  test("enterExtrasMode switches getActiveMode to 'extras'", () => {
    const state = enterExtrasMode(createState());
    expect(state.focusMode).toBe("extras");
    expect(getActiveMode(state)).toBe("extras");
  });

  test("exitExtrasMode returns to revisions focus mode", () => {
    const entered = enterExtrasMode(createState());
    const exited = exitExtrasMode(entered);
    expect(exited.focusMode).toBe("revisions");
    expect(getActiveMode(exited)).toBe("normal");
  });

  test("cancelOrBlurState exits extras mode", () => {
    const entered = enterExtrasMode(createState());
    const cancelled = cancelOrBlurState(entered);
    expect(cancelled.focusMode).toBe("revisions");
  });

  test("default keymap binds `;` in normal mode to enter-extras-mode", () => {
    expect(resolveCommand("normal", ";", defaultKeymap)).toBe("enter-extras-mode");
  });

  test("extras mode has no direct bindings by default", () => {
    const bindings = collectDirectCanonicalBindingsForMode("extras", defaultKeymap);
    expect(bindings).toHaveLength(0);
  });

  test("extras mode is a clean slate: only global bindings are inherited", () => {
    const bindings = collectCanonicalBindingsForMode("extras", defaultKeymap);
    const commandIds = bindings.map((binding) => binding.commandId).sort();
    expect(commandIds).toEqual([
      "cancel",
      "open-notifications",
      "quit",
      "refresh-repository",
      "scroll-help-down",
      "scroll-help-up",
      "search-next",
      "search-prev",
      "suspend",
    ]);
  });

  test("user-defined bindings under keymap.extras resolve in extras mode", () => {
    const { keymap, commands } = resolveConfiguredKeymap({
      extras: {
        d: {
          title: "Deploy",
          description: "Run the deploy script",
          run: () => {},
        },
      },
    });

    const commandId = resolveCommand("extras", "d", keymap);
    expect(commandId).not.toBeNull();
    expect(commands.some((c) => c.id === commandId)).toBe(true);
  });
});
