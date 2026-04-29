import { expect, test } from "bun:test";
import { commandDefinitions, type CommandController } from "../src/commands/definitions.ts";
import type { AppState } from "../src/domain/types.ts";
import { createInitialState, draftConfigs, startCommandDraft } from "../src/state/store.ts";
import { dispatchGlobalKey } from "../src/ui/keybindings.ts";

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

function createController(calls: string[]): CommandController {
  return {
    moveFocus: () => calls.push("moveFocus"),
    moveFocusToParent: () => calls.push("moveFocusToParent"),
    moveFocusToChild: () => calls.push("moveFocusToChild"),
    focusLogBottom: () => calls.push("focusLogBottom"),
    openFocusedRevision: () => calls.push("openFocusedRevision"),
    closeFocusedRevision: () => calls.push("closeFocusedRevision"),
    quit: () => calls.push("quit"),
    suspend: () => calls.push("suspend"),
    cancelOrBlur: () => calls.push("cancelOrBlur"),
    confirm: () => calls.push("confirm"),
    focusCommandBar: () => calls.push("focusCommandBar"),
    startRebase: () => calls.push("startRebase"),
    startSquash: () => calls.push("startSquash"),
    startNewRevision: () => calls.push("startNewRevision"),
    editRevision: () => calls.push("editRevision"),
    toggleSelection: () => calls.push("toggleSelection"),
    toggleFileSelection: () => calls.push("toggleFileSelection"),
    restoreFiles: () => calls.push("restoreFiles"),
    toggleShortFlags: () => calls.push("toggleShortFlags"),
    cycleLayout: () => calls.push("cycleLayout"),
    toggleRebaseDescendants: () => calls.push("toggleRebaseDescendants"),
    undo: () => calls.push("undo"),
    redo: () => calls.push("redo"),
    focusWorkingCopy: () => calls.push("focusWorkingCopy"),
    openRevsetInput: () => calls.push("openRevsetInput"),
    toggleShortcutPanel: () => calls.push("toggleShortcutPanel"),
    forceLastCommand: () => calls.push("forceLastCommand"),
    commit: () => calls.push("commit"),
    describe: () => calls.push("describe"),
    showDiff: () => calls.push("showDiff"),
    openSearch: () => calls.push("openSearch"),
    nextSearchMatch: () => calls.push("nextSearchMatch"),
    prevSearchMatch: () => calls.push("prevSearchMatch"),
    refreshRepository: () => calls.push("refreshRepository"),
    absorb: () => calls.push("absorb"),
    abandonRevision: () => calls.push("abandonRevision"),
  };
}

test("dispatchGlobalKey routes ? to the shortcut panel toggle", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "?",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["toggleShortcutPanel"]);
});

test("dispatchGlobalKey routes ! to forceLastCommand", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "!",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["forceLastCommand"]);
});

test("dispatchGlobalKey routes escape to cancelOrBlur", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "escape",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["cancelOrBlur"]);
});

test("dispatchGlobalKey routes ctrl-z globally to suspend", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "revset",
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-z",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["suspend"]);
});

test("dispatchGlobalKey routes uppercase Z to suspend in normal mode", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "Z",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["suspend"]);
});

test("dispatchGlobalKey preserves h as collapse", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "h",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["closeFocusedRevision"]);
});

test("dispatchGlobalKey routes uppercase parent navigation to moveFocusToParent", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "J",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["moveFocusToParent"]);
});

test("dispatchGlobalKey routes uppercase reverse navigation to moveFocusToChild", () => {
  const calls: string[] = [];
  const state: AppState = { ...createState(), focusedRevisionIndex: 1 };

  const handled = dispatchGlobalKey({
    normalizedKey: "K",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["moveFocusToChild"]);
});

test("dispatchGlobalKey routes G to the bottom of the log", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "G",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["focusLogBottom"]);
});

test("dispatchGlobalKey ignores ? in revset mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "revset",
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "?",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeFalse();
  expect(calls).toEqual([]);
});

test("dispatchGlobalKey routes n and e to immediate revision actions", () => {
  const newCalls: string[] = [];
  const state = createState();

  const newHandled = dispatchGlobalKey({
    normalizedKey: "n",
    state,
    commands: commandDefinitions,
    controller: createController(newCalls),
  });

  expect(newHandled).toBeTrue();
  expect(newCalls).toEqual(["startNewRevision"]);

  const editCalls: string[] = [];
  const editHandled = dispatchGlobalKey({
    normalizedKey: "e",
    state,
    commands: commandDefinitions,
    controller: createController(editCalls),
  });

  expect(editHandled).toBeTrue();
  expect(editCalls).toEqual(["editRevision"]);
});

test("dispatchGlobalKey routes shift-a to absorb", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "A",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["absorb"]);
});

test("dispatchGlobalKey routes s to rebase-descendants in rebase mode", () => {
  const calls: string[] = [];
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });

  const handled = dispatchGlobalKey({
    normalizedKey: "s",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["toggleRebaseDescendants"]);
});

test("dispatchGlobalKey does not route s in normal mode", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "s",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeFalse();
  expect(calls).toEqual([]);
});

test("dispatchGlobalKey handles escape even in input modes", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "command",
    commandBar: { text: "log", manual: true },
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "escape",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["cancelOrBlur"]);
});

test("dispatchGlobalKey routes / to openSearch in normal mode", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "/",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["openSearch"]);
});

test("dispatchGlobalKey passes keys through in search mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "search",
    searchQuery: "",
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "a",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeFalse();
  expect(calls).toEqual([]);
});

test("dispatchGlobalKey routes n to search-next when searchQuery is set", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    searchQuery: "something",
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "n",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["nextSearchMatch"]);
});

test("dispatchGlobalKey routes n to new-revision when searchQuery is empty", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "n",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["startNewRevision"]);
});
