import { expect, test } from "bun:test";
import { getVisibleCommands, type CommandController } from "../src/commands/definitions.ts";
import type { AppState } from "../src/domain/types.ts";
import { createInitialState } from "../src/state/store.ts";
import { dispatchGlobalKey } from "../src/ui/keybindings.ts";

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

function createController(calls: string[]): CommandController {
  return {
    moveFocus: () => calls.push("moveFocus"),
    openFocusedRevision: () => calls.push("openFocusedRevision"),
    closeFocusedRevision: () => calls.push("closeFocusedRevision"),
    quit: () => calls.push("quit"),
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
    toggleCondensedLayout: () => calls.push("toggleCondensedLayout"),
    toggleRebaseDescendants: () => calls.push("toggleRebaseDescendants"),
    undo: () => calls.push("undo"),
    redo: () => calls.push("redo"),
    focusWorkingCopy: () => calls.push("focusWorkingCopy"),
    openRevsetInput: () => calls.push("openRevsetInput"),
    toggleShortcutPanel: () => calls.push("toggleShortcutPanel"),
  };
}

test("dispatchGlobalKey routes ? to the shortcut panel toggle", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "?",
    state,
    visibleCommands: getVisibleCommands(state),
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["toggleShortcutPanel"]);
});

test("dispatchGlobalKey preserves h as collapse", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "h",
    state,
    visibleCommands: getVisibleCommands(state),
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["closeFocusedRevision"]);
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
    visibleCommands: getVisibleCommands(state),
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
    visibleCommands: getVisibleCommands(state),
    controller: createController(newCalls),
  });

  expect(newHandled).toBeTrue();
  expect(newCalls).toEqual(["startNewRevision"]);

  const editCalls: string[] = [];
  const editHandled = dispatchGlobalKey({
    normalizedKey: "e",
    state,
    visibleCommands: getVisibleCommands(state),
    controller: createController(editCalls),
  });

  expect(editHandled).toBeTrue();
  expect(editCalls).toEqual(["editRevision"]);
});
