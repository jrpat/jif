import { expect, test } from "bun:test";
import { join } from "node:path";
import { createAppStore } from "../src/state/appStore.ts";
import { draftConfigs, getDisplayedCommandText } from "../src/state/store.ts";
import type { ChangedFile, RepositoryData, RevisionSummary } from "../src/domain/types.ts";
import { quoteCommand } from "../src/jj/process.ts";
import { createJifCommandController } from "../src/ui/controller.ts";

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

function createControllerHarness(options: Readonly<{
  revisions?: readonly RevisionSummary[];
  changedFiles?: readonly ChangedFile[];
  conflictedFiles?: ReadonlySet<string>;
}>) {
  const store = createAppStore(REPO_PATH);
  if (options.revisions) {
    applyRepositoryData(store, options.revisions);
  }

  const runJjCommands: string[] = [];
  const runInteractiveCommands: string[] = [];
  const runJjCalls: Array<{
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
        return options.changedFiles ?? [];
      },
      async loadConflictedFiles() {
        return options.conflictedFiles ?? new Set<string>();
      },
      async resolveDescendants() {
        return ["bbbbbbbb"];
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
    },
    runInteractiveJjCommand: async (commandText, options) => {
      runInteractiveCommands.push(commandText);
      runInteractiveCalls.push({ commandText, options });
    },
    refreshRepository: async () => true,
    expandElidedRevisions: async (index) => {
      expandElidedCalls.push(index);
    },
    persistLayout: async (layout) => {
      persistedLayouts.push(layout);
    },
    logShortcutPanelToggle: () => {},
  });

  return {
    store,
    controller,
    runJjCommands,
    runInteractiveCommands,
    runJjCalls,
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

test("forceLastCommand retries supported failed commands through the shared runner path", () => {
  const harness = createControllerHarness({ revisions: [] });

  harness.store.actions.setLastFailedCommand({
    commandText: "bookmark set main -r main-",
    commandArgs: ["bookmark", "set", "main", "-r", "main-"],
    interactive: false,
    errorText: "Error: Refusing to move bookmark backwards or sideways: main",
    stderr: "Error: Refusing to move bookmark backwards or sideways: main\nHint: Use --allow-backwards to allow it.",
  });

  harness.controller.forceLastCommand();

  expect(harness.runJjCommands).toHaveLength(1);
  expect(harness.runJjCommands[0]).toContain("--allow-backwards");
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

test("showDiff uses an absolute file path for focused files", async () => {
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

  harness.controller.showDiff();

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