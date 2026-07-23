import { expect, test } from "bun:test";
import type { CommandRunOptions } from "../src/commands/runner.ts";
import { createAppStore } from "../src/state/appStore.ts";
import type { RepositoryData, RevisionSummary } from "../src/domain/types.ts";
import { createJifRuntime } from "../src/ui/runtime.ts";

const REPO_PATH = "/tmp/repo";

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

function createRuntimeHarness(options: Readonly<{
  workspaceRoot?: string | null;
  shellCwd?: string;
  refreshResults?: readonly boolean[];
  revisions?: readonly RevisionSummary[];
  defaultRevset?: string;
  revsetHistory?: readonly string[];
  loadElidedRevisions?: (
    descendantRevisionArg: string,
    excludeRevisionArgs: readonly string[],
    limit: number,
  ) => Promise<readonly RevisionSummary[]>;
  onRefresh?: (store: ReturnType<typeof createAppStore>) => void;
}>) {
  const store = createAppStore(REPO_PATH);
  if (options.revisions) {
    applyRepositoryData(store, options.revisions);
  }

  const commandRuns: CommandRunOptions[] = [];
  const refreshCalls: Array<string | undefined> = [];
  const refreshOptions: Array<{ workingCopy?: string }> = [];
  const recordedCommandHistory: string[] = [];
  const recordedShellHistory: string[] = [];
  const recordedRevsetHistory: string[] = [];
  const savedActiveRevsets: string[] = [];
  let refreshIndex = 0;

  const runtime = createJifRuntime({
    store,
    client: {
      loadElidedRevisions: options.loadElidedRevisions ?? (async () => []),
      loadDefaultRevset: async () => options.defaultRevset ?? "",
    },
    commandRunner: {
      async run(runOptions) {
        commandRuns.push(runOptions);
        return true;
      },
    },
    persistence: {
      async recordCommandHistory(_workspaceRoot, commandText) {
        recordedCommandHistory.push(commandText);
        return [];
      },
      async recordShellHistory(_workspaceRoot, commandText) {
        recordedShellHistory.push(commandText);
        return [];
      },
      async recordRevsetHistory(_workspaceRoot, query) {
        recordedRevsetHistory.push(query);
        return [];
      },
      async loadRevsetHistory(_workspaceRoot) {
        return [...(options.revsetHistory ?? [])];
      },
      async saveActiveRevset(_workspaceRoot, query) {
        savedActiveRevsets.push(query);
      },
    },
    getWorkspaceRoot: () => options.workspaceRoot === undefined ? REPO_PATH : options.workspaceRoot,
    getShellCwd: () => options.shellCwd ?? "/tmp/parent-shell",
    refreshRepository: async (revset, refreshOption) => {
      refreshCalls.push(revset);
      refreshOptions.push(refreshOption ?? {});
      options.onRefresh?.(store);
      const result = options.refreshResults?.[refreshIndex];
      refreshIndex += 1;
      return result ?? true;
    },
  });

  return {
    store,
    runtime,
    commandRuns,
    refreshCalls,
    refreshOptions,
    recordedCommandHistory,
    recordedShellHistory,
    recordedRevsetHistory,
    savedActiveRevsets,
  };
}

test("executeCurrentCommand forwards record-history policy through the runtime seam", async () => {
  const harness = createRuntimeHarness({});

  harness.store.actions.setCommandBarText(" log ");

  await harness.runtime.executeCurrentCommand(undefined, { recordHistory: true });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "log",
    cancelBeforeRun: true,
    successFeedback: "status-toast",
    failureFeedback: "status-toast",
  });
  expect(typeof harness.commandRuns[0]?.recordHistory).toBe("function");

  await harness.commandRuns[0]?.recordHistory?.("log");
  expect(harness.recordedCommandHistory).toEqual(["log"]);
  harness.store.dispose();
});

test("executeCurrentCommand uses shell execution and shell history for the shell command bar", async () => {
  const harness = createRuntimeHarness({ shellCwd: "/tmp/parent-shell" });

  harness.store.actions.focusShellCommandBar();
  harness.store.actions.setCommandBarText(" pwd | cat ");

  await harness.runtime.executeCurrentCommand(undefined, { recordHistory: true });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "pwd | cat",
    executor: "shell",
    cwd: "/tmp/parent-shell",
    cancelBeforeRun: true,
    successFeedback: "status-toast",
    failureFeedback: "status-toast",
  });
  expect(typeof harness.commandRuns[0]?.recordHistory).toBe("function");

  await harness.commandRuns[0]?.recordHistory?.("pwd | cat");
  expect(harness.recordedCommandHistory).toEqual([]);
  expect(harness.recordedShellHistory).toEqual(["pwd | cat"]);
  harness.store.dispose();
});

test("executeCurrentCommand for the jj command bar does not pass a cwd", async () => {
  const harness = createRuntimeHarness({ shellCwd: "/tmp/parent-shell" });

  harness.store.actions.setCommandBarText(" log ");

  await harness.runtime.executeCurrentCommand(undefined, { recordHistory: true });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]?.cwd).toBeUndefined();
  harness.store.dispose();
});

test("executeCurrentCommand marks `jj diff` as interactive", async () => {
  const harness = createRuntimeHarness({});

  harness.store.actions.setCommandBarText("diff");

  await harness.runtime.executeCurrentCommand(undefined, { recordHistory: true });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "diff",
    executor: "jj",
    interactive: true,
    successFeedback: "none",
    failureFeedback: "event",
  });
  harness.store.dispose();
});

test("executeCurrentCommand marks `jj show` as interactive even with extra args", async () => {
  const harness = createRuntimeHarness({});

  harness.store.actions.setCommandBarText("show -r @");

  await harness.runtime.executeCurrentCommand(undefined, { recordHistory: true });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "show -r @",
    executor: "jj",
    interactive: true,
  });
  harness.store.dispose();
});

test("executeCurrentCommand does not mark non-interactive jj subcommands as interactive", async () => {
  const harness = createRuntimeHarness({});

  harness.store.actions.setCommandBarText("log");

  await harness.runtime.executeCurrentCommand(undefined, { recordHistory: true });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "log",
    executor: "jj",
    interactive: false,
    successFeedback: "status-toast",
    failureFeedback: "status-toast",
  });
  harness.store.dispose();
});

test("executeCurrentCommand does not mark shell commands as interactive", async () => {
  const harness = createRuntimeHarness({});

  harness.store.actions.focusShellCommandBar();
  harness.store.actions.setCommandBarText("diff foo bar");

  await harness.runtime.executeCurrentCommand(undefined, { recordHistory: true });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "diff foo bar",
    executor: "shell",
    interactive: false,
  });
  harness.store.dispose();
});

test("runInteractiveJjCommand is a no-op when workspace root is unavailable", async () => {
  const harness = createRuntimeHarness({ workspaceRoot: null });

  await harness.runtime.runInteractiveJjCommand("status");

  expect(harness.commandRuns).toEqual([]);
  harness.store.dispose();
});

test("runJjCommand forwards an explicit cwd override", async () => {
  const harness = createRuntimeHarness({ workspaceRoot: null });

  await harness.runtime.runJjCommand("status", { cwd: "/tmp/other" });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "status",
    cwd: "/tmp/other",
    cancelOnSuccess: true,
    successFeedback: "status-toast",
    failureFeedback: "status-toast",
  });
  expect(harness.commandRuns[0]?.showLoading).toBeUndefined();
  harness.store.dispose();
});

test("dry-run mode previews direct jj commands and submits the edited command", async () => {
  const harness = createRuntimeHarness({});
  harness.store.actions.toggleDryRun();

  const executed = await harness.runtime.runJjCommand("new a", {
    cwd: "/tmp/other",
    focusWorkingCopyAfterRefresh: true,
  });

  expect(executed).toBeFalse();
  expect(harness.commandRuns).toEqual([]);
  expect(harness.store.state.focusMode).toBe("command");
  expect(harness.store.state.commandBar.text).toBe("new a");

  harness.store.actions.setCommandBarText("new b");
  await harness.runtime.executeCurrentCommand(undefined, { recordHistory: true });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "new b",
    interactive: false,
    cwd: "/tmp/other",
    focusWorkingCopyAfterRefresh: true,
    cancelBeforeRun: true,
  });
  harness.store.dispose();
});

test("dry-run mode preserves interactive execution through the command prompt", async () => {
  const harness = createRuntimeHarness({});
  harness.store.actions.toggleDryRun();

  const executed = await harness.runtime.runInteractiveJjCommand("commit");

  expect(executed).toBeFalse();
  expect(harness.commandRuns).toEqual([]);
  expect(harness.store.state.commandBar.text).toBe("commit");
  expect(harness.store.state.commandBar.submissionOptions?.interactive).toBeTrue();

  await harness.runtime.executeCurrentCommand(undefined, { recordHistory: true });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "commit",
    executor: "jj",
    interactive: true,
    successFeedback: "none",
    failureFeedback: "event",
  });
  harness.store.dispose();
});

test("runShellCommand forwards an explicit cwd override", async () => {
  const harness = createRuntimeHarness({ workspaceRoot: null });

  await harness.runtime.runShellCommand("pwd | cat", { cwd: "/tmp/other" });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "pwd | cat",
    executor: "shell",
    cwd: "/tmp/other",
    cancelOnSuccess: true,
    successFeedback: "status-toast",
    failureFeedback: "status-toast",
  });
  expect(harness.commandRuns[0]?.showLoading).toBeUndefined();
  harness.store.dispose();
});

test("runInteractiveJjCommand uses an explicit cwd override even without workspace root", async () => {
  const harness = createRuntimeHarness({ workspaceRoot: null });

  await harness.runtime.runInteractiveJjCommand("status", { cwd: "/tmp/other" });

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "status",
    interactive: true,
    cwd: "/tmp/other",
    cancelOnSuccess: true,
    successFeedback: "none",
    failureFeedback: "event",
  });
  harness.store.dispose();
});

test("runInteractiveShellCommand uses the shell executor interactively", async () => {
  const harness = createRuntimeHarness({ shellCwd: "/tmp/shell-cwd" });

  await harness.runtime.runInteractiveShellCommand("vim README.md");

  expect(harness.commandRuns).toHaveLength(1);
  expect(harness.commandRuns[0]).toMatchObject({
    commandText: "vim README.md",
    executor: "shell",
    interactive: true,
    cwd: "/tmp/shell-cwd",
    cancelOnSuccess: true,
    successFeedback: "none",
    failureFeedback: "event",
  });
  harness.store.dispose();
});

test("applyRevsetQuery persists successful revset changes", async () => {
  const harness = createRuntimeHarness({});

  harness.store.actions.setRevsetQuery("old()");
  harness.store.actions.openRevsetInput();

  await harness.runtime.applyRevsetQuery("mine()");

  expect(harness.store.state.revsetQuery).toBe("mine()");
  expect(harness.store.state.focusMode).toBe("revisions");
  expect(harness.refreshCalls).toEqual(["mine()"]);
  expect(harness.refreshOptions).toEqual([{ workingCopy: "read-only" }]);
  // The revset switched away from ("old()") becomes the most recent history
  // entry, so the previous revset is one keystroke away.
  expect(harness.recordedRevsetHistory).toEqual(["old()"]);
  expect(harness.savedActiveRevsets).toEqual(["mine()"]);
  harness.store.dispose();
});

test("applyRevsetQuery does not record history when there is no previous revset", async () => {
  const harness = createRuntimeHarness({});

  harness.store.actions.openRevsetInput();

  await harness.runtime.applyRevsetQuery("mine()");

  expect(harness.recordedRevsetHistory).toEqual([]);
  expect(harness.savedActiveRevsets).toEqual(["mine()"]);
  harness.store.dispose();
});

test("applyRevsetQuery restores the previous revset after a failed refresh", async () => {
  const harness = createRuntimeHarness({ refreshResults: [false, true] });

  harness.store.actions.setRevsetQuery("old()");
  harness.store.actions.openRevsetInput();

  await harness.runtime.applyRevsetQuery("mine()");

  expect(harness.store.state.revsetQuery).toBe("old()");
  expect(harness.refreshCalls).toEqual(["mine()", "old()"]);
  expect(harness.refreshOptions).toEqual([
    { workingCopy: "read-only" },
    { workingCopy: "read-only" },
  ]);
  expect(harness.recordedRevsetHistory).toEqual([]);
  expect(harness.savedActiveRevsets).toEqual([]);
  harness.store.dispose();
});

test("restoreLogRevsetFromFileFilter switches to the newest non-file revset from history", async () => {
  const harness = createRuntimeHarness({
    revsetHistory: ['files("src/other.ts")', "mine()", "all()"],
  });

  harness.store.actions.setRevsetQuery('files("src/app.ts")');

  await harness.runtime.restoreLogRevsetFromFileFilter();

  expect(harness.store.state.revsetQuery).toBe("mine()");
  expect(harness.refreshCalls).toEqual(["mine()"]);
  expect(harness.savedActiveRevsets).toEqual(["mine()"]);
  harness.store.dispose();
});

test("restoreLogRevsetFromFileFilter falls back to the jj default revset", async () => {
  const harness = createRuntimeHarness({
    defaultRevset: "default()",
    revsetHistory: ['files("src/other.ts")'],
  });

  harness.store.actions.setRevsetQuery('files("src/app.ts")');

  await harness.runtime.restoreLogRevsetFromFileFilter();

  expect(harness.store.state.revsetQuery).toBe("default()");
  expect(harness.refreshCalls).toEqual(["default()"]);
  harness.store.dispose();
});

function createElidedRow(index: number): RevisionSummary {
  return createRevision({
    rowId: `synthetic:elided:${index}`,
    revisionId: `__elided_${index}`,
    description: "(elided revisions)",
    marker: "elided",
    filesLoaded: true,
  });
}

test("expandElidedRevisions anchors on the revision above and reveals through a refresh", async () => {
  // Mirrors a real graph log: the row below an elided marker can be a sibling
  // branch, so the descendant above is the only reliable anchor.
  const replacement = createRevision({ rowId: "cccccccc", revisionId: "cccccccc", description: "unelided", changeIdPrefixLength: 8 });
  const harness = createRuntimeHarness({
    revisions: [
      createRevision({ rowId: "aaaaaaaa", revisionId: "aaaaaaaa", description: "descendant", changeIdPrefixLength: 8 }),
      createElidedRow(1),
      createRevision({ rowId: "bbbbbbbb", revisionId: "bbbbbbbb", description: "sibling branch", changeIdPrefixLength: 8 }),
      createRevision({ rowId: "dddddddd", revisionId: "dddddddd", description: "shared ancestor", changeIdPrefixLength: 8 }),
    ],
    loadElidedRevisions: async (descendantRevisionArg, excludeRevisionArgs, limit) => {
      expect(descendantRevisionArg).toBe("aaaaaaaa");
      expect(excludeRevisionArgs).toEqual(["aaaaaaaa", "bbbbbbbb", "dddddddd"]);
      expect(limit).toBe(20);
      return [replacement];
    },
  });

  await harness.runtime.expandElidedRevisions(1);

  expect(harness.store.state.revealedCommitIds).toEqual(["cccccccc-commit"]);
  expect(harness.refreshCalls).toEqual([undefined]);
  expect(harness.refreshOptions).toEqual([{ workingCopy: "read-only" }]);
  harness.store.dispose();
});

test("expandElidedRevisions skips adjacent elided rows when resolving the descendant", async () => {
  // A merge revision renders one elided marker per elided parent edge, so an
  // elided row's display neighbor above can itself be elided.
  const replacement = createRevision({ rowId: "cccccccc", revisionId: "cccccccc", description: "unelided", changeIdPrefixLength: 8 });
  const calls: string[] = [];
  const harness = createRuntimeHarness({
    revisions: [
      createRevision({ rowId: "aaaaaaaa", revisionId: "aaaaaaaa", description: "merge", changeIdPrefixLength: 8 }),
      createElidedRow(1),
      createElidedRow(2),
      createRevision({ rowId: "bbbbbbbb", revisionId: "bbbbbbbb", description: "parent branch", changeIdPrefixLength: 8 }),
    ],
    loadElidedRevisions: async (descendantRevisionArg) => {
      calls.push(descendantRevisionArg);
      return [replacement];
    },
  });

  await harness.runtime.expandElidedRevisions(2);

  expect(calls).toEqual(["aaaaaaaa"]);
  expect(harness.store.state.revealedCommitIds).toEqual(["cccccccc-commit"]);
  harness.store.dispose();
});

test("expandElidedRevisions truncates divergent revision ids to jj-safe arguments", async () => {
  const harness = createRuntimeHarness({
    revisions: [
      createRevision({ rowId: "aaaaaaaa", revisionId: "aaaaaaaa/2", description: "divergent", changeIdPrefixLength: 8 }),
      createElidedRow(1),
      createRevision({ rowId: "bbbbbbbb", revisionId: "bbbbbbbb", description: "ancestor", changeIdPrefixLength: 4 }),
    ],
    loadElidedRevisions: async (descendantRevisionArg, excludeRevisionArgs) => {
      expect(descendantRevisionArg).toBe("aaaaaaaa/2");
      expect(excludeRevisionArgs).toEqual(["aaaaaaaa/2", "bbbb"]);
      return [];
    },
  });

  await harness.runtime.expandElidedRevisions(1);
  harness.store.dispose();
});

test("expandElidedRevisions does not reveal nested elided marker rows", async () => {
  // The expansion sub-log carries its own elided marker rows; only real
  // revisions are revealed.
  const replacements = [
    createRevision({ rowId: "cccccccc", revisionId: "cccccccc", description: "hidden", changeIdPrefixLength: 8 }),
    createElidedRow(1),
  ];
  const harness = createRuntimeHarness({
    revisions: [
      createRevision({ rowId: "aaaaaaaa", revisionId: "aaaaaaaa", description: "descendant", changeIdPrefixLength: 8 }),
      createElidedRow(1),
      createRevision({ rowId: "bbbbbbbb", revisionId: "bbbbbbbb", description: "ancestor", changeIdPrefixLength: 8 }),
    ],
    loadElidedRevisions: async () => replacements,
  });

  await harness.runtime.expandElidedRevisions(1);

  expect(harness.store.state.revealedCommitIds).toEqual(["cccccccc-commit"]);
  harness.store.dispose();
});

test("expandElidedRevisions focuses the first revealed revision once the refresh applies", async () => {
  const revealed = createRevision({ rowId: "cccccccc", revisionId: "cccccccc", description: "revealed", changeIdPrefixLength: 8 });
  const harness = createRuntimeHarness({
    revisions: [
      createRevision({ rowId: "aaaaaaaa", revisionId: "aaaaaaaa", description: "descendant", changeIdPrefixLength: 8 }),
      createElidedRow(1),
      createRevision({ rowId: "bbbbbbbb", revisionId: "bbbbbbbb", description: "ancestor", changeIdPrefixLength: 8 }),
    ],
    loadElidedRevisions: async () => [revealed],
    onRefresh: (store) => {
      // Simulate the refresher re-rendering the log with the revealed
      // revision included and the marker recomputed by jj.
      applyRepositoryData(store, [
        createRevision({ rowId: "aaaaaaaa", revisionId: "aaaaaaaa", description: "descendant", changeIdPrefixLength: 8 }),
        revealed,
        createElidedRow(2),
        createRevision({ rowId: "bbbbbbbb", revisionId: "bbbbbbbb", description: "ancestor", changeIdPrefixLength: 8 }),
      ]);
    },
  });

  await harness.runtime.expandElidedRevisions(1);

  expect(harness.store.state.focusedRevisionIndex).toBe(1);
  expect(harness.store.state.revisions[1]?.revisionId).toBe("cccccccc");
  harness.store.dispose();
});

test("applyRevsetQuery restores revealed commits when the new revset fails to apply", async () => {
  const harness = createRuntimeHarness({
    revisions: [
      createRevision({ rowId: "aaaaaaaa", revisionId: "aaaaaaaa", description: "descendant", changeIdPrefixLength: 8 }),
      createElidedRow(1),
    ],
    loadElidedRevisions: async () => [
      createRevision({ rowId: "cccccccc", revisionId: "cccccccc", description: "hidden", changeIdPrefixLength: 8 }),
    ],
    // First refresh: the expansion reveal. Second: the failing revset apply.
    refreshResults: [true, false, true],
  });

  await harness.runtime.expandElidedRevisions(1);
  expect(harness.store.state.revealedCommitIds).toEqual(["cccccccc-commit"]);

  await harness.runtime.applyRevsetQuery("this is not a revset");

  expect(harness.store.state.revsetQuery).toBe("");
  expect(harness.store.state.revealedCommitIds).toEqual(["cccccccc-commit"]);
  harness.store.dispose();
});

test("applyRevsetQuery clears revealed commits when a new revset applies", async () => {
  const harness = createRuntimeHarness({
    revisions: [
      createRevision({ rowId: "aaaaaaaa", revisionId: "aaaaaaaa", description: "descendant", changeIdPrefixLength: 8 }),
      createElidedRow(1),
    ],
    loadElidedRevisions: async () => [
      createRevision({ rowId: "cccccccc", revisionId: "cccccccc", description: "hidden", changeIdPrefixLength: 8 }),
    ],
  });

  await harness.runtime.expandElidedRevisions(1);
  expect(harness.store.state.revealedCommitIds).toEqual(["cccccccc-commit"]);

  await harness.runtime.applyRevsetQuery("mine()");

  expect(harness.store.state.revsetQuery).toBe("mine()");
  expect(harness.store.state.revealedCommitIds).toEqual([]);
  harness.store.dispose();
});

test("expandElidedRevisions reports when nothing is hidden and skips the refresh", async () => {
  const harness = createRuntimeHarness({
    revisions: [
      createRevision({ rowId: "aaaaaaaa", revisionId: "aaaaaaaa", description: "descendant", changeIdPrefixLength: 8 }),
      createElidedRow(1),
      createRevision({ rowId: "bbbbbbbb", revisionId: "bbbbbbbb", description: "ancestor", changeIdPrefixLength: 8 }),
    ],
    loadElidedRevisions: async () => [],
  });

  await harness.runtime.expandElidedRevisions(1);

  expect(harness.store.state.revealedCommitIds).toEqual([]);
  expect(harness.refreshCalls).toEqual([]);
  expect(harness.store.state.eventLog.at(-1)?.text).toContain("No hidden revisions");
  harness.store.dispose();
});
