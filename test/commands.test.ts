import { expect, test } from "bun:test";
import { getTextCommand } from "../src/commands/definitions.ts";
import type { AppState } from "../src/domain/types.ts";
import { createInitialState, draftConfigs, startCommandDraft } from "../src/state/store.ts";

function createState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      {
        changeId: "aaaaaaaa",
        changeIdPrefixLength: 1,
        commitId: "11111111",
        description: "first",
        localTimestamp: "2026-03-30 07:22:39",
        bookmarks: [],
        workspaces: [],
        graphRows: ["@  "],
        isEmpty: false,
        marker: "working-copy",
        filesLoaded: false,
        files: [],
      },
    ],
  };
}

test("getTextCommand resolves vim navigation when command bar is unfocused", () => {
  const state = createState();

  expect(getTextCommand("j", state)?.id).toBe("move-down");
  expect(getTextCommand("k", state)?.id).toBe("move-up");
  expect(getTextCommand("h", state)?.id).toBe("collapse");
  expect(getTextCommand("l", state)?.id).toBe("expand");
  expect(getTextCommand("q", state)?.id).toBe("quit");
  expect(getTextCommand("left", state)?.id).toBe("collapse");
});

test("getTextCommand respects command visibility state", () => {
  const focusedState = {
    ...createState(),
    focusMode: "command" as const,
    commandBar: {
      ...createState().commandBar,
      manual: true,
    },
  };
  expect(getTextCommand("j", focusedState)).toBeNull();

  const rebaseState = startCommandDraft(createState(), draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(getTextCommand("s", createState())).toBeNull();
  expect(getTextCommand("s", rebaseState)?.id).toBe("rebase-descendants");
});

test("undo and redo commands resolve in normal mode but not command mode", () => {
  const state = createState();
  expect(getTextCommand("u", state)?.id).toBe("undo");
  expect(getTextCommand("U", state)?.id).toBe("redo");

  const commandState: AppState = {
    ...state,
    focusMode: "command",
    commandBar: { ...state.commandBar, manual: true },
  };
  expect(getTextCommand("u", commandState)).toBeNull();
  expect(getTextCommand("U", commandState)).toBeNull();
});

test("short flags and condensed layout use - and _ respectively", () => {
  const state = createState();

  expect(getTextCommand("-", state)?.id).toBe("toggle-flags");
  expect(getTextCommand("_", state)?.id).toBe("toggle-condensed-layout");

  const commandState: AppState = {
    ...state,
    focusMode: "command",
    commandBar: { ...state.commandBar, manual: true },
  };
  expect(getTextCommand("-", commandState)).toBeNull();
  expect(getTextCommand("_", commandState)).toBeNull();
});

test("shortcut panel toggle uses ? outside text-entry modes", () => {
  const state = createState();
  expect(getTextCommand("?", state)?.id).toBe("shortcut-panel");

  const commandState: AppState = {
    ...state,
    focusMode: "command",
    commandBar: { ...state.commandBar, manual: true },
  };
  expect(getTextCommand("?", commandState)).toBeNull();

  const revsetState: AppState = {
    ...state,
    focusMode: "revset",
  };
  expect(getTextCommand("?", revsetState)).toBeNull();
});

test("new and edit commands resolve in revision mode only", () => {
  const state = createState();
  expect(getTextCommand("n", state)?.id).toBe("new-revision");
  expect(getTextCommand("e", state)?.id).toBe("edit-revision");

  const commandState: AppState = {
    ...state,
    focusMode: "command",
    commandBar: { ...state.commandBar, manual: true },
  };
  expect(getTextCommand("n", commandState)).toBeNull();
  expect(getTextCommand("e", commandState)).toBeNull();
});

test("new and edit commands do not resolve for elided revisions", () => {
  const state: AppState = {
    ...createState(),
    revisions: [
      {
        changeId: "__elided_0",
        changeIdPrefixLength: 0,
        commitId: "",
        description: "(elided revisions)",
        localTimestamp: "",
        bookmarks: [],
        workspaces: [],
        graphRows: ["~  "],
        isEmpty: false,
        marker: "elided",
        filesLoaded: true,
        files: [],
      },
    ],
  };

  expect(getTextCommand("n", state)).toBeNull();
  expect(getTextCommand("e", state)).toBeNull();
});
