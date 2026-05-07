import { expect, test } from "bun:test";
import { join } from "node:path";
import type { ScrollBoxRenderable } from "@opentui/core";
import { createAppStore } from "../src/state/appStore.ts";
import { draftConfigs, getDisplayedCommandText } from "../src/state/store.ts";
import type { ChangedFile, OperationLogEntry, RepositoryData, RevisionSummary } from "../src/domain/types.ts";
import { quoteCommand } from "../src/jj/process.ts";
import { createJifCommandController } from "../src/ui/controller.ts";

const REPO_PATH = "/tmp/repo";

const OP_LOG_ENTRIES: readonly OperationLogEntry[] = [
  {
    id: "65d964491fc0",
    lines: [
      "65d964491fc0 jrpat@host jif-3@ 9 minutes ago",
      "rebase commit 93f155d4a5345ccc3eb97e649e3ee0eab8878180 and 1 more",
      "args: jj rebase -r q -r xm -d n",
    ],
  },
  {
    id: "96df2f0afa0c",
    lines: [
      "96df2f0afa0c jrpat@host jif-3@ 9 minutes ago",
      "export git refs",
      "args: jj git export",
    ],
  },
];

function createRevision(
  overrides: Partial<RevisionSummary> & Pick<RevisionSummary, "rowId" | "revisionId" | "description">,
): RevisionSummary {
  const { rowId, revisionId, description, ...rest } = overrides;

  return {
    rowId,
    revisionId,
    parentRevisionIds: [],
    changeIdPrefixLength: 1,
    commitId: `${revisionId}-commit`,
    description,
    localTimestamp: "2026-04-26 12:00:00",
    bookmarks: [],
    workspaces: [],
    graphRows: ["○  "],
    isEmpty: false,
    hasConflict: false,
    marker: "plain",
    filesLoaded: false,
    files: [],
    ...rest,
  };
}

function applyRepositoryData(store: ReturnType<typeof createAppStore>, revisions: readonly RevisionSummary[]) {
  const repositoryData: RepositoryData = {
    repoPath: REPO_PATH,
    revisions,
  };
  store.actions.applyRepositoryData(repositoryData);
}

function createControllerHarness(harnessOptions: Readonly<{
  revisions?: readonly RevisionSummary[];
  changedFiles?: readonly ChangedFile[];
  conflictedFiles?: ReadonlySet<string>;
  runJjResult?: boolean;
  runInteractiveResult?: boolean;
  operationLogEntries?: readonly OperationLogEntry[];
  diffViewport?: ScrollBoxRenderable;
}>) {
  const store = createAppStore(REPO_PATH);
  if (harnessOptions.revisions) {
    applyRepositoryData(store, harnessOptions.revisions);
  }

  const runJjCommands: string[] = [];
  const runShellCommands: string[] = [];
  const runInteractiveCommands: string[] = [];
  const runJjCalls: Array<{
    commandText: string;
    options?: { focusWorkingCopyAfterRefresh?: boolean; cwd?: string };
  }> = [];
  const runShellCalls: Array<{
    commandText: string;
    options?: { focusWorkingCopyAfterRefresh?: boolean; cwd?: string };
  }> = [];
  const runInteractiveCalls: Array<{
    commandText: string;
    options?: { cwd?: string };
  }> = [];
  const expandElidedCalls: number[] = [];
  const persistedLayouts: string[] = [];
  let suspendCalls = 0;
  let executeCurrentCommandCalls = 0;

  const controller = createJifCommandController({
    store,
    client: {
      async loadChangedFiles() {
        return harnessOptions.changedFiles ?? [];
      },
      async loadConflictedFiles() {
        return harnessOptions.conflictedFiles ?? new Set<string>();
      },
      async loadOperationLog() {
        return harnessOptions.operationLogEntries ?? [];
      },
      async loadOperationDiff() {
        return "fake diff";
      },
      async resolveDescendants() {
        return ["bbbbbbbb"];
      },
      async loadBookmarkTargets() {
        return [];
      },
      async loadAncestorChangeIds() {
        return [];
      },
      async loadDescendantChangeIds() {
        return [];
      },
    },
    destroy: () => {},
    suspend: () => {
      suspendCalls += 1;
    },
    executeCurrentCommand: async () => {
      executeCurrentCommandCalls += 1;
    },
    runJjCommand: async (commandText, options) => {
      runJjCommands.push(commandText);
      runJjCalls.push({ commandText, options });
      return harnessOptions.runJjResult ?? true;
    },
    runShellCommand: async (commandText, options) => {
      runShellCommands.push(commandText);
      runShellCalls.push({ commandText, options });
    },
    runInteractiveJjCommand: async (commandText, options) => {
      runInteractiveCommands.push(commandText);
      runInteractiveCalls.push({ commandText, options });
      return harnessOptions.runInteractiveResult ?? true;
    },
    refreshRepository: async () => true,
    expandElidedRevisions: async (index) => {
      expandElidedCalls.push(index);
    },
    persistLayout: async (layout) => {
      persistedLayouts.push(layout);
    },
    getDiffViewport: () => harnessOptions.diffViewport,
    logShortcutPanelToggle: () => {},
  });

  return {
    store,
    controller,
    runJjCommands,
    runShellCommands,
    runInteractiveCommands,
    runJjCalls,
    runShellCalls,
    runInteractiveCalls,
    expandElidedCalls,
    persistedLayouts,
    get suspendCalls() {
      return suspendCalls;
    },
    get executeCurrentCommandCalls() {
      return executeCurrentCommandCalls;
    },
  };
}

test("suspend delegates to the injected renderer suspend hook", () => {
  const harness = createControllerHarness({ revisions: [] });

  harness.controller.suspend();

  expect(harness.suspendCalls).toBe(1);
  harness.store.dispose();
});

test("jj defaults cwd to repoPath for user-defined commands", () => {
  const harness = createControllerHarness({ revisions: [] });

  harness.controller.jj("status");

  expect(harness.runJjCalls).toEqual([
    {
      commandText: "status",
      options: { cwd: REPO_PATH },
    },
  ]);
  harness.store.dispose();
});

test("sh defaults cwd to repoPath for user-defined commands", () => {
  const harness = createControllerHarness({ revisions: [] });

  harness.controller.sh("pwd | cat");

  expect(harness.runShellCalls).toEqual([
    {
      commandText: "pwd | cat",
      options: { cwd: REPO_PATH },
    },
  ]);
  harness.store.dispose();
});

test("jji preserves an explicit cwd override", () => {
  const harness = createControllerHarness({ revisions: [] });

  harness.controller.jji("show -r @", { cwd: "/tmp/other" });

  expect(harness.runInteractiveCalls).toEqual([
    {
      commandText: "show -r @",
      options: { cwd: "/tmp/other" },
    },
  ]);
  harness.store.dispose();
});

test("confirm uses the interactive squash flow when both source and target have user descriptions", () => {
  const harness = createControllerHarness({
    revisions: [
      createRevision({ rowId: "aaaaaaaa", revisionId: "aaaaaaaa", description: "source revision" }),
      createRevision({ rowId: "bbbbbbbb", revisionId: "bbbbbbbb", description: "target revision" }),
    ],
  });

  harness.store.actions.startCommandDraft(draftConfigs.squash);
  const expectedCommand = getDisplayedCommandText(harness.store.snapshot()).trim();

  harness.controller.confirm();

  expect(harness.runInteractiveCommands).toEqual([expectedCommand]);
  expect(harness.executeCurrentCommandCalls).toBe(0);
  harness.store.dispose();
});

test("startSplit opens inline confirmation when specific files are selected", () => {
  const harness = createControllerHarness({
    revisions: [
      createRevision({
        rowId: "aaaaaaaa",
        revisionId: "aaaaaaaa",
        description: "working copy",
        marker: "working-copy",
        filesLoaded: true,
        files: [
          { path: "src/app.ts", status: "M" },
          { path: "src/ui/render.tsx", status: "M" },
        ],
      }),
    ],
  });

  harness.store.actions.openFocusedRevision();
  harness.store.actions.toggleFileSelection();

  harness.controller.startSplit();

  expect(harness.store.state.focusMode).toBe("inline-confirmation");
  expect(harness.store.state.inlineConfirmation?.kind).toBe("split-files");
  expect(harness.store.state.inlineConfirmation?.selectedOption).toBe("yes");
  expect(harness.runInteractiveCommands).toEqual([]);
  expect(harness.runJjCommands).toEqual([]);
  harness.store.dispose();
});

test("confirm runs the split command selected by inline confirmation through the interactive runner", () => {
  const harness = createControllerHarness({
    revisions: [
      createRevision({
        rowId: "aaaaaaaa",
        revisionId: "aaaaaaaa",
        description: "working copy",
        marker: "working-copy",
        filesLoaded: true,
        files: [{ path: "src/app.ts", status: "M" }],
      }),
    ],
  });

  harness.store.actions.openFocusedRevision();
  harness.store.actions.toggleFileSelection();
  harness.controller.startSplit();

  expect(harness.store.state.inlineConfirmation?.selectedOption).toBe("yes");
  harness.controller.confirm();
  expect(harness.runJjCommands).toEqual([]);
  expect(harness.runInteractiveCommands).toHaveLength(1);
  expect(harness.runInteractiveCommands[0]).toContain("split -r a");
  expect(harness.runInteractiveCommands[0]).toContain(join(REPO_PATH, "src/app.ts"));
  harness.store.dispose();
});

test("forceLastCommand retries supported failed commands through the shared runner path", async () => {
  const harness = createControllerHarness({ revisions: [] });

  harness.store.actions.setLastFailedCommand({
    commandText: "bookmark set main -r main-",
    commandArgs: ["bookmark", "set", "main", "-r", "main-"],
    interactive: false,
    errorText: "Error: Refusing to move bookmark backwards or sideways: main",
    stderr: "Error: Refusing to move bookmark backwards or sideways: main\nHint: Use --allow-backwards to allow it.",
    statusMessageId: "failure-toast",
  });
  harness.store.actions.pushStatusMessage(
    "failure-toast",
    "Error: Refusing to move bookmark backwards or sideways: main",
    "error",
  );

  harness.controller.forceLastCommand();
  await Promise.resolve();

  expect(harness.runJjCommands).toHaveLength(1);
  expect(harness.runJjCommands[0]).toContain("--allow-backwards");
  expect(harness.store.state.statusMessages).toEqual([]);
  harness.store.dispose();
});

test("forceLastCommand leaves the original toast visible when the forced retry fails", async () => {
  const harness = createControllerHarness({
    revisions: [],
    runJjResult: false,
  });

  harness.store.actions.setLastFailedCommand({
    commandText: "bookmark set main -r main-",
    commandArgs: ["bookmark", "set", "main", "-r", "main-"],
    interactive: false,
    errorText: "Error: Refusing to move bookmark backwards or sideways: main",
    stderr: "Error: Refusing to move bookmark backwards or sideways: main\nHint: Use --allow-backwards to allow it.",
    statusMessageId: "failure-toast",
  });
  harness.store.actions.pushStatusMessage(
    "failure-toast",
    "Error: Refusing to move bookmark backwards or sideways: main",
    "error",
  );

  harness.controller.forceLastCommand();
  await Promise.resolve();

  expect(harness.runJjCommands).toHaveLength(1);
  expect(harness.store.state.statusMessages).toHaveLength(1);
  harness.store.dispose();
});

test("openFocusedRevision expands elided revisions through the injected expansion callback", () => {
  const harness = createControllerHarness({
    revisions: [
      createRevision({
        rowId: "__elided_0",
        revisionId: "__elided_0",
        description: "(elided revisions)",
        marker: "elided",
        filesLoaded: true,
      }),
    ],
  });

  harness.controller.openFocusedRevision();

  expect(harness.expandElidedCalls).toEqual([0]);
  harness.store.dispose();
});

test("openFocusedRevision loads changed files and conflict flags for unloaded revisions", async () => {
  const harness = createControllerHarness({
    revisions: [
      createRevision({
        rowId: "aaaaaaaa",
        revisionId: "aaaaaaaa",
        description: "loaded on demand",
        hasConflict: true,
      }),
    ],
    changedFiles: [{ path: "src/app.ts", status: "M" }],
    conflictedFiles: new Set(["src/app.ts"]),
  });

  harness.controller.openFocusedRevision();
  await Promise.resolve();
  await Promise.resolve();

  expect(harness.store.state.expandedRowId).toBe("aaaaaaaa");
  expect(harness.store.state.focusMode).toBe("files");
  expect(harness.store.state.revisions[0]?.filesLoaded).toBeTrue();
  expect(harness.store.state.revisions[0]?.files).toEqual([
    { path: "src/app.ts", status: "M", hasConflict: true },
  ]);
  harness.store.dispose();
});

test("showFileDiff uses an absolute file path for focused files", async () => {
  const harness = createControllerHarness({
    revisions: [
      createRevision({
        rowId: "aaaaaaaa",
        revisionId: "aaaaaaaa",
        description: "loaded on demand",
        filesLoaded: true,
        files: [{ path: "src/app.ts", status: "M" }],
      }),
    ],
  });

  harness.store.actions.openFocusedRevision();

  harness.controller.showFileDiff();

  expect(harness.runInteractiveCommands).toEqual([
    quoteCommand(["diff", "-r", "a", join(REPO_PATH, "src/app.ts")]),
  ]);
  harness.store.dispose();
});

test("cycleLayout persists the updated layout after mutating store state", () => {
  const harness = createControllerHarness({ revisions: [] });

  harness.controller.cycleLayout();

  expect(harness.store.state.layout).toBe("condensed");
  expect(harness.persistedLayouts).toEqual(["condensed"]);
  harness.store.dispose();
});

test("openOperationLog loads entries and switches focus to op-log mode", async () => {
  const harness = createControllerHarness({ operationLogEntries: OP_LOG_ENTRIES });

  harness.controller.openOperationLog();
  await Promise.resolve();
  await Promise.resolve();

  expect(harness.store.state.focusMode).toBe("op-log");
  expect(harness.store.state.operationLogEntries).toEqual(OP_LOG_ENTRIES);
  expect(harness.store.state.focusedOperationLogIndex).toBe(0);
  harness.store.dispose();
});

test("restoreOperation runs jj op restore for the focused operation", () => {
  const harness = createControllerHarness({ operationLogEntries: OP_LOG_ENTRIES });

  harness.store.actions.setOperationLogEntries(OP_LOG_ENTRIES);
  harness.store.actions.openOperationLog();
  harness.store.actions.moveFocus(1);

  harness.controller.restoreOperation();

  expect(harness.runJjCommands).toEqual(["op restore 96df2f0afa0c"]);
  harness.store.dispose();
});

test("revertOperation runs jj op revert for the focused operation", () => {
  const harness = createControllerHarness({ operationLogEntries: OP_LOG_ENTRIES });

  harness.store.actions.setOperationLogEntries(OP_LOG_ENTRIES);
  harness.store.actions.openOperationLog();

  harness.controller.revertOperation();

  expect(harness.runJjCommands).toEqual(["op revert 65d964491fc0"]);
  harness.store.dispose();
});

test("showOperationDiff uses jj operation diff against the focused operation", async () => {
  const harness = createControllerHarness({ operationLogEntries: OP_LOG_ENTRIES });

  harness.store.actions.setOperationLogEntries(OP_LOG_ENTRIES);
  harness.store.actions.openOperationLog();
  harness.store.actions.moveFocus(1);

  harness.controller.showOperationDiff();

  // Wait for the async implementation to complete
  await Promise.resolve();
  await Promise.resolve();

  const state = harness.store.snapshot();
  expect(state.focusMode).toBe("diff-viewer");
  expect(state.diffViewer?.content).toBe("fake diff");
  harness.store.dispose();
});

test("scrollDiffViewer forwards row and column deltas to the registered scrollbox", () => {
  const calls: Array<{ x: number; y: number }> = [];
  const fakeScrollbox = {
    scrollBy: (delta: { x: number; y: number }) => {
      calls.push(delta);
    },
  } as unknown as ScrollBoxRenderable;
  const harness = createControllerHarness({ diffViewport: fakeScrollbox });

  harness.controller.scrollDiffViewer(1, 0);
  harness.controller.scrollDiffViewer(-10, 0);
  harness.controller.scrollDiffViewer(0, 1);
  harness.controller.scrollDiffViewer(0, -10);

  expect(calls).toEqual([
    { x: 0, y: 1 },
    { x: 0, y: -10 },
    { x: 1, y: 0 },
    { x: -10, y: 0 },
  ]);
  harness.store.dispose();
});

test("scrollDiffViewer is a no-op when no scrollbox is registered", () => {
  const harness = createControllerHarness({});

  expect(() => harness.controller.scrollDiffViewer(1, 0)).not.toThrow();
  harness.store.dispose();
});
