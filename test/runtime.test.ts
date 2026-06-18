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
    afterRevisionId: string,
    beforeRevisionId: string | null,
    limit: number,
  ) => Promise<readonly RevisionSummary[]>;
}>) {
  const store = createAppStore(REPO_PATH);
  if (options.revisions) {
    applyRepositoryData(store, options.revisions);
  }

  const commandRuns: CommandRunOptions[] = [];
  const refreshCalls: Array<string | undefined> = [];
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
    refreshRepository: async (revset) => {
      refreshCalls.push(revset);
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

test("expandElidedRevisions replaces the elided row through the runtime seam", async () => {
  const replacement = createRevision({ rowId: "cccccccc", revisionId: "cccccccc", description: "unelided" });
  const harness = createRuntimeHarness({
    revisions: [
      createRevision({ rowId: "aaaaaaaa", revisionId: "aaaaaaaa", description: "before" }),
      createRevision({ rowId: "__elided_0", revisionId: "__elided_0", description: "(elided revisions)", marker: "elided", filesLoaded: true }),
      createRevision({ rowId: "bbbbbbbb", revisionId: "bbbbbbbb", description: "after" }),
    ],
    loadElidedRevisions: async (afterRevisionId, beforeRevisionId, limit) => {
      expect(afterRevisionId).toBe("bbbbbbbb");
      expect(beforeRevisionId).toBe("aaaaaaaa");
      expect(limit).toBe(20);
      return [replacement];
    },
  });

  await harness.runtime.expandElidedRevisions(1);

  expect(harness.store.state.revisions.map((revision) => revision.revisionId)).toEqual([
    "aaaaaaaa",
    "cccccccc",
    "bbbbbbbb",
  ]);
  harness.store.dispose();
});
