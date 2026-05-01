import { expect, test } from "bun:test";
import { commandDefinitions } from "../src/commands/definitions.ts";
import type { AppState } from "../src/domain/types.ts";
import {
  createInitialState,
  draftConfigs,
  openInlineConfirmation,
  startCommandDraft,
} from "../src/state/store.ts";
import {
  resolveCommand,
  getActiveMode,
  getDirectCommandsForMode,
  defaultKeymap,
} from "../src/modes.ts";

function createState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      {
        rowId: "aaaaaaaa",
        revisionId: "aaaaaaaa",
        parentRevisionIds: ["bbbbbbbb"],
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
        filesLoaded: false,
        files: [],
      },
      {
        rowId: "bbbbbbbb",
        revisionId: "bbbbbbbb",
        parentRevisionIds: [],
        changeIdPrefixLength: 1,
        commitId: "22222222",
        description: "second",
        localTimestamp: "2026-03-30 07:22:40",
        bookmarks: [],
        workspaces: [],
        graphRows: ["○  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: false,
        files: [],
      },
    ],
  };
}

function resolveForState(key: string, state: AppState): string | null {
  const mode = getActiveMode(state);
  const commandId = resolveCommand(mode, key);
  if (!commandId) return null;

  const command = commandDefinitions.find((c) => c.id === commandId);
  if (!command) return null;
  if (command.canExecute && !command.canExecute(state)) return null;

  return commandId;
}

test("resolveCommand resolves vim navigation in normal mode", () => {
  const state = createState();
  const parentState: AppState = { ...state, focusedRevisionIndex: 1 };

  expect(resolveForState("j", state)).toBe("move-down");
  expect(resolveForState("k", state)).toBe("move-up");
  expect(resolveForState("G", state)).toBe("jump-to-bottom");
  expect(resolveForState("J", state)).toBe("move-parent");
  expect(resolveForState("K", parentState)).toBe("move-child");
  expect(resolveForState("h", state)).toBe("collapse");
  expect(resolveForState("l", state)).toBe("expand");
  expect(resolveForState("q", state)).toBe("quit");
  expect(resolveForState("left", state)).toBe("collapse");
});

test("suspend uses ctrl-z canonically and Z as a normal-mode alias", () => {
  const state = createState();
  const revsetState: AppState = { ...state, focusMode: "revset" };

  expect(defaultKeymap._global["ctrl-z"]).toBe("suspend");
  expect(resolveForState("Z", state)).toBe("suspend");
  expect(resolveForState("Z", revsetState)).toBeNull();
  expect(commandDefinitions.find((command) => command.id === "suspend")?.canonicalKeys).toEqual(["ctrl-z"]);
});

test("resolveCommand returns null for unbound keys", () => {
  const state = createState();
  expect(resolveForState("z", state)).toBeNull();
});

test("resolveCommand returns null in command mode for browse keys", () => {
  const state: AppState = {
    ...createState(),
    focusMode: "command",
    commandBar: { text: "", manual: true },
  };

  expect(resolveForState("j", state)).toBeNull();
  expect(resolveForState("k", state)).toBeNull();
});

test("rebase-descendants resolves in rebase mode but not normal mode", () => {
  expect(resolveForState("s", createState())).toBe("split");

  const rebaseState = startCommandDraft(createState(), draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(resolveForState("s", rebaseState)).toBe("rebase-descendants");
});

test("getDirectCommandsForMode returns only rebase-local bindings", () => {
  const commands = getDirectCommandsForMode("rebase", defaultKeymap, commandDefinitions);

  expect(commands.map((command) => command.id)).toEqual(["rebase-descendants"]);
});

test("inline confirmation uses a dedicated mode with local option navigation", () => {
  let state = createState();
  state = {
    ...state,
    focusMode: "files",
    expandedRowId: "aaaaaaaa",
    revisions: state.revisions.map((revision, index) =>
      index === 0
        ? {
          ...revision,
          filesLoaded: true,
          files: [{ path: "src/app.ts", status: "M" }],
        }
        : revision
    ),
    selectedFilePaths: ["src/app.ts"],
  };

  state = openInlineConfirmation(state, {
    kind: "split-files",
    rowId: "aaaaaaaa",
    message: "Split selected files?",
    options: ["yes", "interactive", "no"],
    selectedOption: "yes",
    actualCommandByOption: {
      yes: "split -r a /tmp/repo/src/app.ts",
      interactive: "split -i -r a /tmp/repo/src/app.ts",
      no: "split -r a",
    },
    previewCommandByOption: {
      yes: "split -r a …files…",
      interactive: "split -i -r a …files…",
      no: "split -r a",
    },
  });

  expect(getActiveMode(state)).toBe("inline-confirmation");
  expect(resolveForState("h", state)).toBe("inline-confirmation-prev-option");
  expect(resolveForState("left", state)).toBe("inline-confirmation-prev-option");
  expect(resolveForState("l", state)).toBe("inline-confirmation-next-option");
  expect(resolveForState("right", state)).toBe("inline-confirmation-next-option");
  expect(resolveForState("j", state)).toBeNull();
});
test("undo and redo resolve in normal mode", () => {
  const state = createState();
  expect(resolveForState("u", state)).toBe("undo");
  expect(resolveForState("U", state)).toBe("redo");
  expect(commandDefinitions.find((command) => command.id === "jump-to-bottom")?.canonicalKeys).toEqual(["G"]);
});

test("absorb resolves on shift-a in normal mode", () => {
  const state = createState();
  expect(resolveForState("A", state)).toBe("absorb");
});

test("short flags and layout cycling use - and _ respectively", () => {
  const state = createState();
  expect(resolveForState("-", state)).toBe("toggle-flags");
  expect(resolveForState("_", state)).toBe("cycle-layout");
});

test("shortcut panel toggle uses ? in normal mode", () => {
  const state = createState();
  expect(resolveForState("?", state)).toBe("shortcut-panel");
  expect(resolveForState("!", state)).toBe("force-last-command");
  expect(resolveForState(">", state)).toBe("shell-command-bar");
  expect(defaultKeymap.normal[">"]).toBe("shell-command-bar");
  expect(commandDefinitions.find((command) => command.id === "shell-command-bar")?.canonicalKeys).toEqual([">"]);

  const revsetState: AppState = { ...state, focusMode: "revset" };
  expect(resolveForState("?", revsetState)).toBeNull();
  expect(resolveForState("!", revsetState)).toBeNull();
  expect(resolveForState(">", revsetState)).toBeNull();
});

test("new and edit resolve in normal mode only", () => {
  const state = createState();
  expect(resolveForState("n", state)).toBe("new-revision");
  expect(resolveForState("e", state)).toBe("edit-revision");

  const commandState: AppState = {
    ...state,
    focusMode: "command",
    commandBar: { text: "", manual: true },
  };
  expect(resolveForState("n", commandState)).toBeNull();
  expect(resolveForState("e", commandState)).toBeNull();
});

test("canExecute blocks commands on elided revisions", () => {
  const state: AppState = {
    ...createState(),
    revisions: [
      {
        rowId: "__elided_0",
        revisionId: "__elided_0",
        changeIdPrefixLength: 0,
        commitId: "",
        description: "(elided revisions)",
        localTimestamp: "",
        bookmarks: [],
        workspaces: [],
        graphRows: ["~  "],
        isEmpty: false,
        hasConflict: false,
        marker: "elided",
        filesLoaded: true,
        files: [],
      },
    ],
  };

  expect(resolveForState("n", state)).toBeNull();
  expect(resolveForState("e", state)).toBeNull();
  expect(resolveForState("h", state)).toBeNull();
  // expand still works (controller handles elided expansion)
  expect(resolveForState("l", state)).toBe("expand");
});

test("mode inheritance lets files mode use normal keys", () => {
  const state: AppState = {
    ...createState(),
    focusMode: "files",
    expandedRowId: "aaaaaaaa",
  };

  // Inherited from normal
  expect(resolveForState("j", state)).toBe("move-down");
  expect(resolveForState("k", state)).toBe("move-up");
  expect(resolveForState("?", state)).toBe("shortcut-panel");

  // Mode-local in files
  expect(defaultKeymap.files.s).toBe("split");
  expect(resolveForState("s", state)).toBe("split");
  expect(resolveForState("r", state)).toBe("restore");
  expect(resolveForState(" ", state)).toBe("toggle-file-selection");
});

test("_global escape binding resolves regardless of mode", () => {
  expect(defaultKeymap._global["escape"]).toBe("cancel");
});
