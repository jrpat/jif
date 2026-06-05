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
    moveFocusToNextDivergentSibling: () => calls.push("moveFocusToNextDivergentSibling"),
    moveFocusToWorkspace: (direction: 1 | -1) => calls.push(`moveFocusToWorkspace:${direction}`),
    focusLogBottom: () => calls.push("focusLogBottom"),
    focusCurrentOperation: () => calls.push("focusCurrentOperation"),
    openOperationLog: () => calls.push("openOperationLog"),
    openEvolog: () => calls.push("openEvolog"),
    openFocusedRevision: () => calls.push("openFocusedRevision"),
    closeFocusedRevision: () => calls.push("closeFocusedRevision"),
    quit: () => calls.push("quit"),
    suspend: () => calls.push("suspend"),
    cancelOrBlur: () => calls.push("cancelOrBlur"),
    confirm: () => calls.push("confirm"),
    focusCommandBar: () => calls.push("focusCommandBar"),
    focusShellCommandBar: () => calls.push("focusShellCommandBar"),
    startRebase: () => calls.push("startRebase"),
    startRestore: () => calls.push("startRestore"),
    startSplit: () => calls.push("startSplit"),
    startSquash: () => calls.push("startSquash"),
    startInterdiff: () => calls.push("startInterdiff"),
    startDiff: () => calls.push("startDiff"),
    startNewRevision: () => calls.push("startNewRevision"),
    editRevision: () => calls.push("editRevision"),
    toggleSelection: () => calls.push("toggleSelection"),
    toggleFileSelection: () => calls.push("toggleFileSelection"),
    selectAllFiles: () => calls.push("selectAllFiles"),
    restoreFiles: () => calls.push("restoreFiles"),
    untrackFiles: () => calls.push("untrackFiles"),
    selectPreviousInlineConfirmationOption: () => calls.push("selectPreviousInlineConfirmationOption"),
    selectNextInlineConfirmationOption: () => calls.push("selectNextInlineConfirmationOption"),
    toggleShortFlags: () => calls.push("toggleShortFlags"),
    cycleLayout: () => calls.push("cycleLayout"),
    setRebaseSourceKind: (kind) => calls.push(`setRebaseSourceKind(${kind})`),
    setRebaseTargetKind: (kind) => calls.push(`setRebaseTargetKind(${kind})`),
    toggleRebaseSkipEmptied: () => calls.push("toggleRebaseSkipEmptied"),
    confirmRebaseWithForce: () => calls.push("confirmRebaseWithForce"),
    toggleSquashAnchor: () => calls.push("toggleSquashAnchor"),
    toggleInterdiffSwap: () => calls.push("toggleInterdiffSwap"),
    undo: () => calls.push("undo"),
    redo: () => calls.push("redo"),
    focusWorkingCopy: () => calls.push("focusWorkingCopy"),
    openRevsetInput: () => calls.push("openRevsetInput"),
    toggleShortcutPanel: () => calls.push("toggleShortcutPanel"),
    forceLastCommand: () => calls.push("forceLastCommand"),
    commit: () => calls.push("commit"),
    describe: () => calls.push("describe"),
    showRevisionDiff: () => calls.push("showRevisionDiff"),
    showFileDiff: () => calls.push("showFileDiff"),
    restoreOperation: () => calls.push("restoreOperation"),
    revertOperation: () => calls.push("revertOperation"),
    showOperationDiff: () => calls.push("showOperationDiff"),
    scrollDiffViewer: (rowDelta, colDelta) =>
      calls.push(`scrollDiffViewer(${rowDelta},${colDelta})`),
    openNotifications: () => calls.push("openNotifications"),
    expandNotification: () => calls.push("expandNotification"),
    collapseNotification: () => calls.push("collapseNotification"),
    editFocusedNotification: () => calls.push("editFocusedNotification"),
    openSearch: () => calls.push("openSearch"),
    nextSearchMatch: () => calls.push("nextSearchMatch"),
    prevSearchMatch: () => calls.push("prevSearchMatch"),
    toggleSearchIdOnly: () => calls.push("toggleSearchIdOnly"),
    refreshRepository: () => calls.push("refreshRepository"),
    absorb: () => calls.push("absorb"),
    abandonRevision: () => calls.push("abandonRevision"),
    enterBookmarkMode: () => calls.push("enterBookmarkMode"),
    enterExtrasMode: () => calls.push("enterExtrasMode"),
    startBookmarkCreate: () => calls.push("startBookmarkCreate"),
    startBookmarkMoveFrom: () => calls.push("startBookmarkMoveFrom"),
    startBookmarkMoveTo: () => calls.push("startBookmarkMoveTo"),
    startBookmarkDelete: () => calls.push("startBookmarkDelete"),
    startBookmarkForget: () => calls.push("startBookmarkForget"),
    startBookmarkSet: () => calls.push("startBookmarkSet"),
    startBookmarkTrack: () => calls.push("startBookmarkTrack"),
    startBookmarkUntrack: () => calls.push("startBookmarkUntrack"),
    jj: async () => {
      calls.push("jj");
    },
    sh: async () => {
      calls.push("sh");
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

test("dispatchGlobalKey routes ctrl-; to the command bar", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-;",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["focusCommandBar"]);
});

test("dispatchGlobalKey routes ctrl-. to the shell command bar", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-.",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["focusShellCommandBar"]);
});

test("dispatchGlobalKey routes ctrl-l to the revset prompt", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-l",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["openRevsetInput"]);
});

test("dispatchGlobalKey routes > to the shell command bar", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: ">",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["focusShellCommandBar"]);
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

test("dispatchGlobalKey routes O to the operation log", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "O",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["openOperationLog"]);
});

test("dispatchGlobalKey routes E to open-evolog", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "E",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["openEvolog"]);
});

test("dispatchGlobalKey routes op-log actions to operation commands", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "op-log",
    focusModeStack: ["revisions", "op-log"],
    operationLogEntries: [{ id: "65d964491fc0", lines: ["65d964491fc0"] }],
    focusedOperationLogIndex: 0,
  };

  const restoreHandled = dispatchGlobalKey({
    normalizedKey: "r",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });
  const revertHandled = dispatchGlobalKey({
    normalizedKey: "R",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });
  const diffHandled = dispatchGlobalKey({
    normalizedKey: "d",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(restoreHandled).toBeTrue();
  expect(revertHandled).toBeTrue();
  expect(diffHandled).toBeTrue();
  expect(calls).toEqual(["restoreOperation", "revertOperation", "showOperationDiff"]);
});

test("dispatchGlobalKey routes @ to jump-to-current-operation in op-log mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "op-log",
    focusModeStack: ["revisions", "op-log"],
    operationLogEntries: [
      { id: "65d964491fc0", lines: ["65d964491fc0"] },
      { id: "0123456789ab", lines: ["0123456789ab"] },
    ],
    focusedOperationLogIndex: 1,
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "@",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["focusCurrentOperation"]);
});

test("dispatchGlobalKey routes : to the command bar in op-log mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "op-log",
    focusModeStack: ["revisions", "op-log"],
  };

  const handled = dispatchGlobalKey({
    normalizedKey: ":",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["focusCommandBar"]);
});

test("dispatchGlobalKey routes ctrl-; to the command bar in op-log mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "op-log",
    focusModeStack: ["revisions", "op-log"],
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-;",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["focusCommandBar"]);
});

test("dispatchGlobalKey routes : to the command bar in evolog mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "evolog",
    focusModeStack: ["revisions", "evolog"],
  };

  const handled = dispatchGlobalKey({
    normalizedKey: ":",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["focusCommandBar"]);
});

test("dispatchGlobalKey routes / to openSearch in op-log mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "op-log",
    focusModeStack: ["revisions", "op-log"],
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "/",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["openSearch"]);
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
  expect(calls).toEqual(["setRebaseSourceKind(source)"]);
});

test("dispatchGlobalKey routes s to squash-from-anchor in squash mode", () => {
  const calls: string[] = [];
  let state = createState();
  state = startCommandDraft(state, draftConfigs.squash);

  const handled = dispatchGlobalKey({
    normalizedKey: "s",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["toggleSquashAnchor"]);
});

test("dispatchGlobalKey routes = to interdiff-swap in interdiff mode", () => {
  const calls: string[] = [];
  let state = createState();
  state = startCommandDraft(state, draftConfigs.interdiff);

  const handled = dispatchGlobalKey({
    normalizedKey: "=",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["toggleInterdiffSwap"]);
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

test("dispatchGlobalKey routes ctrl-u to untrack in files mode", () => {
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
    normalizedKey: "ctrl-u",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["untrackFiles"]);
});

test("dispatchGlobalKey handles escape even in input modes", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "command",
    commandBar: { kind: "jj", text: "log", manual: true },
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

test("dispatchGlobalKey routes ctrl-n to search-next when searchQuery is set", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    searchQuery: "something",
    searchScope: "revision-log",
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-n",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["nextSearchMatch"]);
});

test("dispatchGlobalKey layers search-result keys over op-log mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "op-log",
    focusModeStack: ["revisions", "op-log"],
    searchQuery: "operation",
    searchScope: "operation-log",
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-n",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["nextSearchMatch"]);
});

test("dispatchGlobalKey routes q to quit in normal mode", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "q",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["quit"]);
});

test("dispatchGlobalKey routes q to cancelOrBlur in files mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "files",
    expandedRowId: "aaaaaaaa",
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "q",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["cancelOrBlur"]);
});

test("dispatchGlobalKey routes q to cancelOrBlur in op-log mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "op-log",
    focusModeStack: ["revisions", "op-log"],
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "q",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["cancelOrBlur"]);
});

test("dispatchGlobalKey does not route q to quit in command mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "command",
    commandBar: { kind: "jj", text: "", manual: true },
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "q",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeFalse();
  expect(calls).toEqual([]);
});

test("dispatchGlobalKey does not route q to quit in search mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "search",
    searchQuery: "",
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "q",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeFalse();
  expect(calls).toEqual([]);
});

test("dispatchGlobalKey does not route q to quit in revset mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "revset",
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "q",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeFalse();
  expect(calls).toEqual([]);
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

function diffViewerState(): AppState {
  return {
    ...createState(),
    focusMode: "diff-viewer",
    focusModeStack: ["revisions", "op-log", "diff-viewer"],
    diffViewer: { content: "line a\nline b\nline c" },
  };
}

test("dispatchGlobalKey routes j/k to scrollDiffViewer in diff-viewer mode", () => {
  const calls: string[] = [];
  const state = diffViewerState();

  const downHandled = dispatchGlobalKey({
    normalizedKey: "j",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });
  const upHandled = dispatchGlobalKey({
    normalizedKey: "k",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(downHandled).toBeTrue();
  expect(upHandled).toBeTrue();
  expect(calls).toEqual(["scrollDiffViewer(1,0)", "scrollDiffViewer(-1,0)"]);
});

test("dispatchGlobalKey routes uppercase J/K to large vertical scroll in diff-viewer mode", () => {
  const calls: string[] = [];
  const state = diffViewerState();

  const downHandled = dispatchGlobalKey({
    normalizedKey: "J",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });
  const upHandled = dispatchGlobalKey({
    normalizedKey: "K",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(downHandled).toBeTrue();
  expect(upHandled).toBeTrue();
  expect(calls).toEqual(["scrollDiffViewer(10,0)", "scrollDiffViewer(-10,0)"]);
});

test("dispatchGlobalKey routes h/l to horizontal scroll in diff-viewer mode", () => {
  const calls: string[] = [];
  const state = diffViewerState();

  const leftHandled = dispatchGlobalKey({
    normalizedKey: "h",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });
  const rightHandled = dispatchGlobalKey({
    normalizedKey: "l",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(leftHandled).toBeTrue();
  expect(rightHandled).toBeTrue();
  expect(calls).toEqual(["scrollDiffViewer(0,-1)", "scrollDiffViewer(0,1)"]);
});

test("dispatchGlobalKey routes uppercase H/L to large horizontal scroll in diff-viewer mode", () => {
  const calls: string[] = [];
  const state = diffViewerState();

  const leftHandled = dispatchGlobalKey({
    normalizedKey: "H",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });
  const rightHandled = dispatchGlobalKey({
    normalizedKey: "L",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(leftHandled).toBeTrue();
  expect(rightHandled).toBeTrue();
  expect(calls).toEqual(["scrollDiffViewer(0,-10)", "scrollDiffViewer(0,10)"]);
});

test("scroll-* commands are gated by canExecute when no diff viewer is open", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "j",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["moveFocus"]);
});
