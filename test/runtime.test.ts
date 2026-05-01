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
  refreshResults?: readonly boolean[];
  revisions?: readonly RevisionSummary[];
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
  const recordedRevsetHistory: string[] = [];
  const savedActiveRevsets: string[] = [];
  let refreshIndex = 0;

  const runtime = createJifRuntime({
    store,
    client: {
      loadElidedRevisions: options.loadElidedRevisions ?? (async () => []),
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
      async recordRevsetHistory(_workspaceRoot, query) {
        recordedRevsetHistory.push(query);
        return [];
      },
      async saveActiveRevset(_workspaceRoot, query) {
        savedActiveRevsets.push(query);
      },
    },
    getWorkspaceRoot: () => options.workspaceRoot === undefined ? REPO_PATH : options.workspaceRoot,
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
    successFeedback: "event",
    failureFeedback: "event",
  });
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

test("applyRevsetQuery persists successful revset changes", async () => {
  const harness = createRuntimeHarness({});

  harness.store.actions.setRevsetQuery("old()");
  harness.store.actions.openRevsetInput();

  await harness.runtime.applyRevsetQuery("mine()");

  expect(harness.store.state.revsetQuery).toBe("mine()");
  expect(harness.store.state.focusMode).toBe("revisions");
  expect(harness.refreshCalls).toEqual(["mine()"]);
  expect(harness.recordedRevsetHistory).toEqual(["mine()"]);
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