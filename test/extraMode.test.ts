import { describe, expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import {
  cancelOrBlurState,
  createInitialState,
  enterExtraMode,
  exitExtraMode,
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

describe("extra mode", () => {
  test("enterExtraMode switches getActiveMode to 'extra'", () => {
    const state = enterExtraMode(createState());
    expect(state.focusMode).toBe("extra");
    expect(getActiveMode(state)).toBe("extra");
  });

  test("exitExtraMode returns to revisions focus mode", () => {
    const entered = enterExtraMode(createState());
    const exited = exitExtraMode(entered);
    expect(exited.focusMode).toBe("revisions");
    expect(getActiveMode(exited)).toBe("normal");
  });

  test("cancelOrBlurState exits extra mode", () => {
    const entered = enterExtraMode(createState());
    const cancelled = cancelOrBlurState(entered);
    expect(cancelled.focusMode).toBe("revisions");
  });

  test("default keymap binds `;` in normal mode to enter-extra-mode", () => {
    expect(resolveCommand("normal", ";", defaultKeymap)).toBe("enter-extra-mode");
  });

  test("extra mode has no direct bindings by default", () => {
    const bindings = collectDirectCanonicalBindingsForMode("extra", defaultKeymap);
    expect(bindings).toHaveLength(0);
  });

  test("extra mode is a clean slate: only global bindings are inherited", () => {
    const bindings = collectCanonicalBindingsForMode("extra", defaultKeymap);
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

  test("user-defined bindings under keymap.extra resolve in extra mode", () => {
    const { keymap, commands } = resolveConfiguredKeymap({
      extra: {
        d: {
          title: "Deploy",
          description: "Run the deploy script",
          run: () => {},
        },
      },
    });

    const commandId = resolveCommand("extra", "d", keymap);
    expect(commandId).not.toBeNull();
    expect(commands.some((c) => c.id === commandId)).toBe(true);
  });
});
