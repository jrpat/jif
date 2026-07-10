import { expect, test } from "bun:test";
import type { StatusLevel, WorkspaceRef } from "../src/domain/types.ts";
import { DEFAULT_REPOSITORY_LOAD_LIMIT } from "../src/jj/client.ts";
import { switchWorkspace } from "../src/ui/workspaceSwitch.ts";

function createWorkspaceSwitchHarness(options: Readonly<{
  repoPath?: string;
  workspaceRefs?: readonly WorkspaceRef[];
  activeRevset?: string;
  defaultRevset?: string;
  refreshResult?: boolean;
  applyRuntimeConfig?: (rootPath: string) => Promise<void>;
}> = {}) {
  let workspaceState = {
    repoPath: options.repoPath ?? "/repo/default",
    workspaceRefs: options.workspaceRefs ?? [
      { name: "default", rootPath: "/repo/default" },
      { name: "review", rootPath: "/repo/review" },
    ],
  };
  const activatedRoots: string[] = [];
  const appliedConfigRoots: string[] = [];
  const loadedActiveRevsetRoots: string[] = [];
  const revsetQueries: string[] = [];
  const refreshCalls: Array<{
    revset?: string;
    limit?: number;
    options?: { workingCopy?: string; force?: boolean };
  }> = [];
  const events: Array<{ text: string; level: StatusLevel }> = [];
  let resetViewCalls = 0;
  let focusWorkingCopyCalls = 0;
  let loadDefaultRevsetCalls = 0;

  const run = (workspaceName: string) => switchWorkspace({
    workspaceName,
    getWorkspaceState: () => workspaceState,
    actions: {
      activateWorkspace(rootPath) {
        activatedRoots.push(rootPath);
        workspaceState = { ...workspaceState, repoPath: rootPath };
      },
      setRevsetQuery(query) {
        revsetQueries.push(query);
      },
      focusWorkingCopy() {
        focusWorkingCopyCalls += 1;
      },
      pushEvent(text, level) {
        events.push({ text, level });
      },
    },
    resetViewState() {
      resetViewCalls += 1;
    },
    async applyRuntimeConfig(rootPath) {
      appliedConfigRoots.push(rootPath);
      await options.applyRuntimeConfig?.(rootPath);
    },
    async loadDefaultRevset() {
      loadDefaultRevsetCalls += 1;
      return options.defaultRevset ?? "trunk()";
    },
    async loadActiveRevset(rootPath) {
      loadedActiveRevsetRoots.push(rootPath);
      return options.activeRevset ?? "mine()";
    },
    async refreshRepository(revset, limit, refreshOptions) {
      refreshCalls.push({ revset, limit, options: refreshOptions });
      return options.refreshResult ?? true;
    },
  });

  return {
    run,
    get workspaceState() {
      return workspaceState;
    },
    activatedRoots,
    appliedConfigRoots,
    loadedActiveRevsetRoots,
    revsetQueries,
    refreshCalls,
    events,
    get resetViewCalls() {
      return resetViewCalls;
    },
    get focusWorkingCopyCalls() {
      return focusWorkingCopyCalls;
    },
    get loadDefaultRevsetCalls() {
      return loadDefaultRevsetCalls;
    },
  };
}

test("switchWorkspace switches to any known workspace by name", async () => {
  const harness = createWorkspaceSwitchHarness();

  await harness.run("review");

  expect(harness.workspaceState.repoPath).toBe("/repo/review");
  expect(harness.activatedRoots).toEqual(["/repo/review"]);
  expect(harness.appliedConfigRoots).toEqual(["/repo/review"]);
  expect(harness.loadedActiveRevsetRoots).toEqual(["/repo/review"]);
  expect(harness.revsetQueries).toEqual(["mine()"]);
  expect(harness.refreshCalls).toEqual([{
    revset: "mine()",
    limit: DEFAULT_REPOSITORY_LOAD_LIMIT,
    options: { workingCopy: "snapshot", force: true },
  }]);
  expect(harness.resetViewCalls).toBe(1);
  expect(harness.focusWorkingCopyCalls).toBe(1);
  expect(harness.events).toEqual([{
    text: "Switched to workspace review@.",
    level: "success",
  }]);
});

test("switchWorkspace falls back to the target workspace's default revset", async () => {
  const harness = createWorkspaceSwitchHarness({
    activeRevset: "",
    defaultRevset: "trunk()..",
  });

  await harness.run("review");

  expect(harness.revsetQueries).toEqual(["trunk().."]);
  expect(harness.refreshCalls[0]?.revset).toBe("trunk()..");
});

test("switchWorkspace warns and does nothing for an unknown workspace name", async () => {
  const harness = createWorkspaceSwitchHarness();

  await harness.run("missing");

  expect(harness.workspaceState.repoPath).toBe("/repo/default");
  expect(harness.activatedRoots).toEqual([]);
  expect(harness.resetViewCalls).toBe(0);
  expect(harness.loadDefaultRevsetCalls).toBe(0);
  expect(harness.events).toEqual([{
    text: "Cannot switch workspace: root for missing@ is unavailable.",
    level: "warning",
  }]);
});

test("switchWorkspace silently does nothing when the workspace is already active", async () => {
  const harness = createWorkspaceSwitchHarness();

  await harness.run("default");

  expect(harness.activatedRoots).toEqual([]);
  expect(harness.resetViewCalls).toBe(0);
  expect(harness.events).toEqual([]);
});

test("switchWorkspace reports success only after a successful refresh", async () => {
  const harness = createWorkspaceSwitchHarness({ refreshResult: false });

  await harness.run("review");

  expect(harness.workspaceState.repoPath).toBe("/repo/review");
  expect(harness.focusWorkingCopyCalls).toBe(0);
  expect(harness.events).toEqual([]);
});

test("switchWorkspace propagates dependency failures", async () => {
  const failure = new Error("config failed");
  const harness = createWorkspaceSwitchHarness({
    applyRuntimeConfig: async () => {
      throw failure;
    },
  });

  await expect(harness.run("review")).rejects.toThrow(failure);
  expect(harness.workspaceState.repoPath).toBe("/repo/review");
  expect(harness.focusWorkingCopyCalls).toBe(0);
  expect(harness.events).toEqual([]);
});
