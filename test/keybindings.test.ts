import { expect, test } from "bun:test";
import { resolveConfiguredKeymap } from "../src/config/index.ts";
import { commandDefinitions, type CommandController } from "../src/commands/definitions.ts";
import type { AppState } from "../src/domain/types.ts";
import { createInitialState, draftConfigs, startCommandDraft } from "../src/state/store.ts";
import { defaultKeymap } from "../src/modes.ts";
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

function createController(calls: string[], errors: string[] = []): CommandController {
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
    startSplit: () => calls.push("startSplit"),
    startSquash: () => calls.push("startSquash"),
    startNewRevision: () => calls.push("startNewRevision"),
    editRevision: () => calls.push("editRevision"),
    toggleSelection: () => calls.push("toggleSelection"),
    toggleFileSelection: () => calls.push("toggleFileSelection"),
    restoreFiles: () => calls.push("restoreFiles"),
    selectPreviousInlineConfirmationOption: () => calls.push("selectPreviousInlineConfirmationOption"),
    selectNextInlineConfirmationOption: () => calls.push("selectNextInlineConfirmationOption"),
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
    jj: async () => {
      calls.push("jj");
    },
    jji: async () => {
      calls.push("jji");
    },
    reportError: (error) => {
      errors.push(error instanceof Error ? error.message : String(error));
    },
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

test("dispatchGlobalKey passes the full app state values to inline configured handlers", () => {
  const calls: string[] = [];
  const state = createState();
  let receivedState: { repoPath: string; focusedRevisionIndex: number } | null = null;

  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Capture State",
        description: "Capture the current app state",
        run: (_controller, app) => {
          calls.push("custom");
          receivedState = {
            repoPath: app.repoPath,
            focusedRevisionIndex: app.focusedRevisionIndex,
          };
        },
      },
    },
  });

  const handled = dispatchGlobalKey({
    normalizedKey: "g",
    state,
    commands: resolved.commands,
    controller: createController(calls),
    keymap: resolved.keymap,
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["custom"]);
  if (receivedState === null) {
    throw new Error("expected receivedState to be set");
  }
  expect(receivedState as { repoPath: string; focusedRevisionIndex: number }).toEqual({
    repoPath: state.repoPath,
    focusedRevisionIndex: state.focusedRevisionIndex,
  });
});

test("dispatchGlobalKey exposes the focused revision on app.rev for inline handlers", () => {
  const calls: string[] = [];
  const state = createState();
  let focusedRevisionId: string | null = null;

  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Read Focused Revision",
        description: "Capture the focused revision via app.rev",
        run: (_controller, app) => {
          calls.push("custom");
          focusedRevisionId = app.rev?.revisionId ?? null;
        },
      },
    },
  });

  const handled = dispatchGlobalKey({
    normalizedKey: "g",
    state,
    commands: resolved.commands,
    controller: createController(calls),
    keymap: resolved.keymap,
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["custom"]);
  if (focusedRevisionId === null) {
    throw new Error("expected focused revision id to be set");
  }
  expect(focusedRevisionId as string).toBe("aaaaaaaa");
});

test("dispatchGlobalKey reports rejected inline handlers through the controller", async () => {
  const calls: string[] = [];
  const errors: string[] = [];
  const state = createState();
  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Reject",
        description: "Reject from an async handler",
        run: async () => {
          throw new Error("boom");
        },
      },
    },
  });

  const handled = dispatchGlobalKey({
    normalizedKey: "g",
    state,
    commands: resolved.commands,
    controller: createController(calls, errors),
    keymap: resolved.keymap,
  });

  await Promise.resolve();

  expect(handled).toBeTrue();
  expect(errors).toEqual(["boom"]);
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

test("dispatchGlobalKey routes s to split in normal mode", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "s",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["startSplit"]);
});

test("dispatchGlobalKey routes h/l inside inline confirmation mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "inline-confirmation",
    inlineConfirmation: {
      kind: "split-files",
      rowId: "aaaaaaaa",
      message: "Split selected files?",
      options: ["yes", "interactive", "no"],
      selectedOption: "interactive",
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
    },
  };

  const handledLeft = dispatchGlobalKey({
    normalizedKey: "h",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });
  const handledRight = dispatchGlobalKey({
    normalizedKey: "l",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handledLeft).toBeTrue();
  expect(handledRight).toBeTrue();
  expect(calls).toEqual([
    "selectPreviousInlineConfirmationOption",
    "selectNextInlineConfirmationOption",
  ]);
});

test("dispatchGlobalKey prefers current mode bindings over global bindings on the same key", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "files",
    expandedRowId: "aaaaaaaa",
    revisions: createState().revisions.map((revision, index) =>
      index === 0
        ? {
          ...revision,
          filesLoaded: true,
          files: [{ path: "src/app.ts", status: "M" }],
        }
        : revision
    ),
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "s",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
    keymap: {
      ...defaultKeymap,
      _global: {
        ...defaultKeymap._global,
        s: "quit",
      },
      files: {
        ...defaultKeymap.files,
        s: "split",
      },
    },
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["startSplit"]);
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
