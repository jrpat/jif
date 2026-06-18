import { expect, test } from "bun:test";
import { resolveConfiguredKeymap } from "../src/config/index.ts";
import { commandDefinitions, type CommandController } from "../src/commands/definitions.ts";
import type { AppState } from "../src/domain/types.ts";
import { getRevisionArg } from "../src/domain/revisionIds.ts";
import { createInitialState, draftConfigs, enterExtraMode, startCommandDraft } from "../src/state/store.ts";
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
    moveFocusToBookmark: (direction: 1 | -1) => calls.push(`moveFocusToBookmark:${direction}`),
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
    startDuplicate: () => calls.push("startDuplicate"),
    startRevert: () => calls.push("startRevert"),
    startRestore: () => calls.push("startRestore"),
    startSplit: () => calls.push("startSplit"),
    startSplitParallel: () => calls.push("startSplitParallel"),
    diffEditRevision: () => calls.push("diffEditRevision"),
    startSquash: () => calls.push("startSquash"),
    startSquashOnto: () => calls.push("startSquashOnto"),
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
    toggleSquashAnchor: () => calls.push("toggleSquashAnchor"),
    toggleInterdiffSwap: () => calls.push("toggleInterdiffSwap"),
    undo: () => calls.push("undo"),
    redo: () => calls.push("redo"),
    focusWorkingCopy: () => calls.push("focusWorkingCopy"),
    openRevsetInput: (initialQuery?: string) =>
      calls.push(initialQuery === undefined ? "openRevsetInput" : `openRevsetInput:${initialQuery}`),
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
    scrollHelpToast: (rowDelta) => calls.push(`scrollHelpToast(${rowDelta})`),
    openNotifications: () => calls.push("openNotifications"),
    expandNotification: () => calls.push("expandNotification"),
    collapseNotification: () => calls.push("collapseNotification"),
    editFocusedNotification: () => calls.push("editFocusedNotification"),
    openSearch: () => calls.push("openSearch"),
    openFileSearch: () => calls.push("openFileSearch"),
    restrictRevsetToFocusedFile: () => calls.push("restrictRevsetToFocusedFile"),
    nextSearchMatch: () => calls.push("nextSearchMatch"),
    prevSearchMatch: () => calls.push("prevSearchMatch"),
    toggleSearchIdOnly: () => calls.push("toggleSearchIdOnly"),
    reloadConfig: () => calls.push("reloadConfig"),
    refreshRepository: () => calls.push("refreshRepository"),
    startAbsorb: () => calls.push("startAbsorb"),
    abandonRevision: () => calls.push("abandonRevision"),
    enterBookmarkMode: () => calls.push("enterBookmarkMode"),
    enterExtraMode: () => calls.push("enterExtraMode"),
    startSetParents: () => calls.push("startSetParents"),
    toggleSetParentsPick: () => calls.push("toggleSetParentsPick"),
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

test("dispatchGlobalKey routes ctrl-f to file search in normal mode", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-f",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["openFileSearch"]);
});

test("dispatchGlobalKey routes ctrl-f to focused-file revset restriction in files mode", () => {
  const calls: string[] = [];
  const state: AppState = {
    ...createState(),
    focusMode: "files",
    focusModeStack: ["revisions", "files"],
    expandedRowId: "aaaaaaaa",
    revisions: createState().revisions.map((revision, index) =>
      index === 0
        ? { ...revision, filesLoaded: true, files: [{ path: "src/app.ts", status: "M" }] }
        : revision
    ),
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-f",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["restrictRevsetToFocusedFile"]);
});

test("dispatchGlobalKey routes ctrl-comma to reload config", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-,",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["reloadConfig"]);
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

test("dispatchGlobalKey exposes the focused revision object on app.focusedRevision", () => {
  const calls: string[] = [];
  const state = createState();
  let focusedRevisionId: string | null = null;

  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Read Focused Revision",
        run: (_controller, app) => {
          calls.push("custom");
          focusedRevisionId = app.focusedRevision?.revisionId ?? null;
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

test("app.rev is the focused revision's jj argument; app.focusedRevision is the object", () => {
  const calls: string[] = [];
  const state = createState();
  const captured: {
    rev?: string;
    interpolated?: string;
    fullRevisionId?: string;
    prefixLength?: number;
  } = {};

  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Read app.rev",
        run: (_controller, app) => {
          captured.rev = app.rev;
          captured.interpolated = `show -r ${app.rev}`;
          captured.fullRevisionId = app.focusedRevision?.revisionId;
          captured.prefixLength = app.focusedRevision?.changeIdPrefixLength;
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
  // createState's focused revision is "aaaaaaaa" with changeIdPrefixLength 1.
  expect(captured.rev).toBe(getRevisionArg("aaaaaaaa", 1));
  expect(captured.rev).toBe("a");
  expect(captured.interpolated).toBe("show -r a");
  // The full object remains available under focusedRevision.
  expect(captured.fullRevisionId).toBe("aaaaaaaa");
  expect(captured.prefixLength).toBe(1);
});

test("app.rev keeps the full id for divergent revisions", () => {
  const calls: string[] = [];
  const base = createState();
  const state: AppState = {
    ...base,
    revisions: [
      { ...base.revisions[0]!, revisionId: "abc1234/2", changeIdPrefixLength: 3 },
      base.revisions[1]!,
    ],
  };
  const captured: { rev?: string } = {};

  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Read divergent app.rev",
        run: (_controller, app) => {
          captured.rev = app.rev;
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
  expect(captured.rev).toBe(getRevisionArg("abc1234/2", 3));
  expect(captured.rev).toBe("abc1234/2");
});

test("app.file is the focused file's path; app.focusedFile is the object", () => {
  const calls: string[] = [];
  const base = createState();
  const state: AppState = {
    ...base,
    expandedRowId: "aaaaaaaa",
    focusedFileIndex: 0,
    revisions: [
      {
        ...base.revisions[0]!,
        filesLoaded: true,
        files: [{ path: "src/foo.ts", status: "M" }],
      },
      base.revisions[1]!,
    ],
  };
  const captured: { file?: string; path?: string; status?: string } = {};

  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Read app.file",
        run: (_controller, app) => {
          captured.file = app.file;
          captured.path = app.focusedFile?.path;
          captured.status = app.focusedFile?.status;
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
  expect(captured.file).toBe("src/foo.ts");
  expect(captured.path).toBe("src/foo.ts");
  expect(captured.status).toBe("M");
});

test("app.rev is empty and app.focusedRevision is null when there are no revisions", () => {
  const calls: string[] = [];
  const base = createState();
  const state: AppState = { ...base, revisions: [], focusedRevisionIndex: 0 };
  const captured: { rev?: string; focusedRevisionIsNull?: boolean } = {};
  let guarded = false;

  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Read empty app.rev",
        run: (_controller, app) => {
          captured.rev = app.rev;
          captured.focusedRevisionIsNull = app.focusedRevision === null;
          if (!app.rev) {
            guarded = true;
            return;
          }
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
  expect(captured.rev).toBe("");
  expect(captured.focusedRevisionIsNull).toBeTrue();
  expect(guarded).toBeTrue();
});

test("dispatchGlobalKey reports rejected inline handlers through the controller", async () => {
  const calls: string[] = [];
  const errors: string[] = [];
  const state = createState();
  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Reject",
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

test("dispatchGlobalKey dismisses shortcuts before running an async extra binding", async () => {
  const calls: string[] = [];
  const state = enterExtraMode(createState());
  let releaseCommand!: () => void;

  const resolved = resolveConfiguredKeymap({
    extra: {
      d: {
        title: "Deploy",
        run: async () => {
          calls.push("run-start");
          await new Promise<void>((resolve) => {
            releaseCommand = resolve;
          });
          calls.push("run-end");
        },
      },
    },
  });

  const handled = dispatchGlobalKey({
    normalizedKey: "d",
    state,
    commands: resolved.commands,
    controller: createController(calls),
    keymap: resolved.keymap,
    onBeforeCommandRun: ({ commandId, mode }) => {
      calls.push(`dismiss:${mode}:${commandId}`);
    },
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["dismiss:extra:user:extra:d", "run-start"]);

  releaseCommand();
  await Promise.resolve();
  await Promise.resolve();

  expect(calls).toEqual(["dismiss:extra:user:extra:d", "run-start", "run-end"]);
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

test("dispatchGlobalKey routes ctrl-o to the operation log", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-o",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["openOperationLog"]);
});

test("dispatchGlobalKey routes ctrl-e to open-evolog", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-e",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["openEvolog"]);
});

test("dispatchGlobalKey routes E to diff-edit-revision", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "E",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["diffEditRevision"]);
});

test("dispatchGlobalKey routes alt-j to jump-to-next-divergent", () => {
  const calls: string[] = [];
  const base = createState();
  // Make the focused revision divergent with a visible sibling so the command
  // passes its canExecute guard.
  const state: AppState = {
    ...base,
    focusedRevisionIndex: 0,
    revisions: [
      { ...base.revisions[0]!, revisionId: "abc1234/1", changeIdPrefixLength: 4 },
      { ...base.revisions[1]!, revisionId: "abc1234/2", changeIdPrefixLength: 4 },
    ],
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "alt-j",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["moveFocusToNextDivergentSibling"]);
});

test("dispatchGlobalKey routes y to duplicate and alt-r to revert", () => {
  const dupCalls: string[] = [];
  const state = createState();

  expect(
    dispatchGlobalKey({
      normalizedKey: "y",
      state,
      commands: commandDefinitions,
      controller: createController(dupCalls),
    }),
  ).toBeTrue();
  expect(dupCalls).toEqual(["startDuplicate"]);

  const revertCalls: string[] = [];
  expect(
    dispatchGlobalKey({
      normalizedKey: "alt-r",
      state,
      commands: commandDefinitions,
      controller: createController(revertCalls),
    }),
  ).toBeTrue();
  expect(revertCalls).toEqual(["startRevert"]);
});

test("dispatchGlobalKey routes alt-s to split-parallel", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "alt-s",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["startSplitParallel"]);
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

test("dispatchGlobalKey routes ] to the next bookmark", () => {
  const calls: string[] = [];
  const base = createState();
  const state: AppState = {
    ...base,
    focusedRevisionIndex: 0,
    revisions: base.revisions.map((revision, index) =>
      index === 1 ? { ...revision, bookmarks: ["feature"] } : revision
    ),
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "]",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["moveFocusToBookmark:1"]);
});

test("dispatchGlobalKey routes [ to the previous bookmark", () => {
  const calls: string[] = [];
  const base = createState();
  const state: AppState = {
    ...base,
    focusedRevisionIndex: 1,
    revisions: base.revisions.map((revision, index) =>
      index === 0 ? { ...revision, bookmarks: ["feature"] } : revision
    ),
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "[",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["moveFocusToBookmark:-1"]);
});

test("dispatchGlobalKey routes } to the next workspace", () => {
  const calls: string[] = [];
  const base = createState();
  const state: AppState = {
    ...base,
    focusedRevisionIndex: 0,
    revisions: base.revisions.map((revision, index) =>
      index === 1 ? { ...revision, workspaces: ["default"] } : revision
    ),
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "}",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["moveFocusToWorkspace:1"]);
});

test("dispatchGlobalKey routes { to the previous workspace", () => {
  const calls: string[] = [];
  const base = createState();
  const state: AppState = {
    ...base,
    focusedRevisionIndex: 1,
    revisions: base.revisions.map((revision, index) =>
      index === 0 ? { ...revision, workspaces: ["default"] } : revision
    ),
  };

  const handled = dispatchGlobalKey({
    normalizedKey: "{",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["moveFocusToWorkspace:-1"]);
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

test("dispatchGlobalKey routes shift-a to start absorb", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "A",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["startAbsorb"]);
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

test("dispatchGlobalKey routes S to squash-from-anchor in squash mode (alias for s)", () => {
  const calls: string[] = [];
  let state = createState();
  state = startCommandDraft(state, draftConfigs.squash);

  const handled = dispatchGlobalKey({
    normalizedKey: "S",
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

test("dispatchGlobalKey routes s to squash in normal mode", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "s",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["startSquash"]);
});

test("dispatchGlobalKey routes S to squash-onto in normal mode", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "S",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["startSquashOnto"]);
});

test("dispatchGlobalKey routes ctrl-s to split in normal mode", () => {
  const calls: string[] = [];
  const state = createState();

  const handled = dispatchGlobalKey({
    normalizedKey: "ctrl-s",
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

function helpToastState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...createState(),
    statusMessages: [
      {
        id: "help-toast",
        text: "Usage: jj rebase [OPTIONS]\nmore\nlines",
        level: "success",
        variant: "help",
        createdAt: 0,
        lastInteractedAt: 0,
      },
    ],
    ...overrides,
  };
}

test("dispatchGlobalKey routes j/k to log navigation while a help toast is visible", () => {
  const calls: string[] = [];
  const state = helpToastState();

  // A help toast no longer captures the keyboard: j/k navigate the revision
  // log exactly as they do without a toast on screen.
  dispatchGlobalKey({ normalizedKey: "j", state, commands: commandDefinitions, controller: createController(calls) });
  dispatchGlobalKey({ normalizedKey: "k", state, commands: commandDefinitions, controller: createController(calls) });

  expect(calls).toEqual(["moveFocus", "moveFocus"]);
});

test("revision shortcuts stay active while a help toast is visible", () => {
  const calls: string[] = [];
  const state = helpToastState();

  // `r` (rebase) and `:` (command bar) keep working: the help toast is not its
  // own mode, so normal-mode bindings remain in force.
  const rebaseHandled = dispatchGlobalKey({
    normalizedKey: "r",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });
  const commandBarHandled = dispatchGlobalKey({
    normalizedKey: ":",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(rebaseHandled).toBeTrue();
  expect(commandBarHandled).toBeTrue();
  expect(calls).toEqual(["startRebase", "focusCommandBar"]);
});

test("escape dismisses a visible help toast via the global cancel binding", () => {
  const calls: string[] = [];
  const state = helpToastState();

  const handled = dispatchGlobalKey({
    normalizedKey: "escape",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(handled).toBeTrue();
  expect(calls).toEqual(["cancelOrBlur"]);
});

test("ctrl-j/ctrl-k scroll the visible help toast one line while j/k still navigate", () => {
  const calls: string[] = [];
  const state = helpToastState();

  const downHandled = dispatchGlobalKey({
    normalizedKey: "ctrl-j",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });
  const upHandled = dispatchGlobalKey({
    normalizedKey: "ctrl-k",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(downHandled).toBeTrue();
  expect(upHandled).toBeTrue();
  expect(calls).toEqual(["scrollHelpToast(1)", "scrollHelpToast(-1)"]);
});

test("ctrl-j/ctrl-k are inert when no help toast is visible", () => {
  const calls: string[] = [];
  const state = createState();

  const downHandled = dispatchGlobalKey({
    normalizedKey: "ctrl-j",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });
  const upHandled = dispatchGlobalKey({
    normalizedKey: "ctrl-k",
    state,
    commands: commandDefinitions,
    controller: createController(calls),
  });

  expect(downHandled).toBeFalse();
  expect(upHandled).toBeFalse();
  expect(calls).toEqual([]);
});
