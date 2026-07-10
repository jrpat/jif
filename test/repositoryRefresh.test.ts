import { EventEmitter } from "node:events";
import { expect, test } from "bun:test";
import { CliRenderEvents } from "@opentui/core";
import type { RepositoryData, StatusLevel } from "../src/domain/types.ts";
import {
  bindAutoRefresh,
  bindOpHeadsWatcher,
  bindRefreshOnFocus,
  createRepositoryRefresher,
  type RepositoryRefreshOptions,
} from "../src/ui/repositoryRefresh.ts";

function createRepositoryData(repoPath = "/tmp/repo"): RepositoryData {
  return {
    repoPath,
    revisions: [],
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

test("createRepositoryRefresher reloads using the active revset", async () => {
  const calls: string[] = [];
  const repositoryData = createRepositoryData();
  let appliedRepositoryData: RepositoryData | undefined;

  const refreshRepository = createRepositoryRefresher({
    client: {
      async verifyRepository() {
        calls.push("verify");
      },
      async loadRepository(_limit, revset) {
        calls.push(`load:${revset ?? ""}`);
        return repositoryData;
      },
    },
    actions: {
      setLoading(loading) {
        calls.push(`loading:${loading}`);
      },
      applyRepositoryData(nextRepositoryData) {
        appliedRepositoryData = nextRepositoryData;
      },
      pushEvent() {
        throw new Error("refresh should not fail");
      },
    },
    getRevsetQuery: () => "mine()",
  });

  const result = await refreshRepository();

  expect(result).toBe(true);
  expect(calls).toEqual([
    "verify",
    "load:mine()",
  ]);
  expect(appliedRepositoryData).toEqual(repositoryData);
});

test("createRepositoryRefresher forwards the working-copy refresh mode", async () => {
  const calls: string[] = [];

  const refreshRepository = createRepositoryRefresher({
    client: {
      async verifyRepository(options) {
        calls.push(`verify:${options?.workingCopy ?? "snapshot"}`);
      },
      async loadRepository(_limit, _revset, options) {
        calls.push(`load:${options?.workingCopy ?? "snapshot"}`);
        return createRepositoryData();
      },
    },
    actions: {
      setLoading() {},
      applyRepositoryData() {},
      pushEvent() {
        throw new Error("refresh should not fail");
      },
    },
    getRevsetQuery: () => "",
  });

  await refreshRepository(undefined, undefined, { workingCopy: "read-only" });
  await refreshRepository(undefined, undefined, { workingCopy: "snapshot" });

  expect(calls).toEqual([
    "verify:read-only",
    "load:read-only",
    "verify:snapshot",
    "load:snapshot",
  ]);
});

test("createRepositoryRefresher forwards an explicit revision load limit", async () => {
  const calls: string[] = [];

  const refreshRepository = createRepositoryRefresher({
    client: {
      async verifyRepository() {
        calls.push("verify");
      },
      async loadRepository(limit, revset) {
        calls.push(`load:${revset ?? ""}:${limit ?? ""}`);
        return createRepositoryData();
      },
    },
    actions: {
      setLoading() {},
      applyRepositoryData() {},
      pushEvent() {
        throw new Error("refresh should not fail");
      },
    },
    getRevsetQuery: () => "mine()",
  });

  const result = await refreshRepository(undefined, 21);

  expect(result).toBe(true);
  expect(calls).toEqual([
    "verify",
    "load:mine():21",
  ]);
});

test("createRepositoryRefresher reuses the last explicit revision load limit", async () => {
  const calls: string[] = [];

  const refreshRepository = createRepositoryRefresher({
    client: {
      async verifyRepository() {
        calls.push("verify");
      },
      async loadRepository(limit) {
        calls.push(`load:${limit ?? ""}`);
        return createRepositoryData();
      },
    },
    actions: {
      setLoading() {},
      applyRepositoryData() {},
      pushEvent() {
        throw new Error("refresh should not fail");
      },
    },
    getRevsetQuery: () => "",
  });

  await refreshRepository(undefined, 21);
  await refreshRepository();

  expect(calls).toEqual([
    "verify",
    "load:21",
    "verify",
    "load:21",
  ]);
});

test("createRepositoryRefresher reports refresh metadata for lazy loading", async () => {
  const refreshUpdates: Array<{ requestedLimit: number; revisionCount: number; canLoadMore: boolean }> = [];

  const refreshRepository = createRepositoryRefresher({
    client: {
      async verifyRepository() {},
      async loadRepository() {
        return {
          repoPath: "/tmp/repo",
          revisions: Array.from({ length: 21 }, (_, index) => ({ rowId: `r${index}` })) as any,
        };
      },
    },
    actions: {
      setLoading() {},
      applyRepositoryData() {},
      pushEvent() {
        throw new Error("refresh should not fail");
      },
    },
    getRevsetQuery: () => "",
    onRefreshSuccess(details) {
      refreshUpdates.push({
        requestedLimit: details.requestedLimit,
        revisionCount: details.repositoryData.revisions.length,
        canLoadMore: details.canLoadMore,
      });
    },
  });

  await refreshRepository(undefined, 21);

  expect(refreshUpdates).toEqual([
    { requestedLimit: 21, revisionCount: 21, canLoadMore: true },
  ]);
});

test("createRepositoryRefresher skips applying unchanged repository data", async () => {
  const calls: string[] = [];
  let refreshSuccessCount = 0;

  const refreshRepository = createRepositoryRefresher({
    client: {
      async verifyRepository() {},
      async loadRepository() {
        return {
          repoPath: "/tmp/repo",
          revisions: [{ rowId: "r0", revisionId: "abc" }] as any,
        };
      },
    },
    actions: {
      setLoading(loading) {
        calls.push(`loading:${loading}`);
      },
      applyRepositoryData() {
        calls.push("apply");
      },
      pushEvent() {
        throw new Error("refresh should not fail");
      },
    },
    getRevsetQuery: () => "",
    onRefreshSuccess() {
      refreshSuccessCount += 1;
    },
  });

  expect(await refreshRepository()).toBe(true);
  expect(await refreshRepository()).toBe(true);

  expect(calls).toEqual(["apply", "loading:false"]);
  expect(refreshSuccessCount).toBe(2);
});

test("createRepositoryRefresher applies unchanged repository data when forced", async () => {
  let applied = 0;

  const refreshRepository = createRepositoryRefresher({
    client: {
      async verifyRepository() {},
      async loadRepository() {
        return { repoPath: "/tmp/repo", revisions: [] };
      },
    },
    actions: {
      setLoading() {},
      applyRepositoryData() {
        applied += 1;
      },
      pushEvent() {
        throw new Error("refresh should not fail");
      },
    },
    getRevsetQuery: () => "",
  });

  await refreshRepository();
  await refreshRepository();
  expect(applied).toBe(1);

  await refreshRepository(undefined, undefined, { force: true });
  expect(applied).toBe(2);

  await refreshRepository();
  expect(applied).toBe(2);
});

test("createRepositoryRefresher applies repository data again once it changes", async () => {
  const applied: string[] = [];
  let description = "first";

  const refreshRepository = createRepositoryRefresher({
    client: {
      async verifyRepository() {},
      async loadRepository() {
        return {
          repoPath: "/tmp/repo",
          revisions: [{ rowId: "r0", description }] as any,
        };
      },
    },
    actions: {
      setLoading() {},
      applyRepositoryData(repositoryData) {
        applied.push((repositoryData.revisions[0] as any).description);
      },
      pushEvent() {
        throw new Error("refresh should not fail");
      },
    },
    getRevsetQuery: () => "",
  });

  await refreshRepository();
  description = "second";
  await refreshRepository();
  await refreshRepository();

  expect(applied).toEqual(["first", "second"]);
});

test("createRepositoryRefresher coalesces concurrent refresh requests", async () => {
  const loadDeferred = createDeferred<RepositoryData>();
  let loadCalls = 0;

  const refreshRepository = createRepositoryRefresher({
    client: {
      async verifyRepository() {},
      loadRepository() {
        loadCalls += 1;
        return loadDeferred.promise;
      },
    },
    actions: {
      setLoading() {},
      applyRepositoryData() {},
      pushEvent() {
        throw new Error("refresh should not fail");
      },
    },
    getRevsetQuery: () => "",
  });

  const firstRefresh = refreshRepository();
  const secondRefresh = refreshRepository("heads(main)");

  await Promise.resolve();
  expect(loadCalls).toBe(1);

  loadDeferred.resolve(createRepositoryData());
  await Promise.all([firstRefresh, secondRefresh]);
});

test("createRepositoryRefresher does not coalesce or apply stale refreshes across scopes", async () => {
  const firstLoad = createDeferred<RepositoryData>();
  const secondLoad = createDeferred<RepositoryData>();
  const applied: string[] = [];
  let activeScope = "/repo/one";
  let loadCalls = 0;

  const refreshRepository = createRepositoryRefresher({
    client: {
      async verifyRepository() {},
      loadRepository() {
        loadCalls += 1;
        return loadCalls === 1 ? firstLoad.promise : secondLoad.promise;
      },
    },
    actions: {
      setLoading() {},
      applyRepositoryData(repositoryData) {
        applied.push(repositoryData.repoPath);
      },
      pushEvent() {
        throw new Error("refresh should not fail");
      },
    },
    getRevsetQuery: () => "",
    getRefreshScope: () => activeScope,
  });

  const firstRefresh = refreshRepository();
  activeScope = "/repo/two";
  const secondRefresh = refreshRepository();

  secondLoad.resolve(createRepositoryData("/repo/two"));
  firstLoad.resolve(createRepositoryData("/repo/one"));

  expect(await secondRefresh).toBe(true);
  expect(await firstRefresh).toBe(false);
  expect(loadCalls).toBe(2);
  expect(applied).toEqual(["/repo/two"]);
});

test("createRepositoryRefresher reports refresh failures and clears loading", async () => {
  const loadingStates: boolean[] = [];
  const events: Array<{ text: string; level: StatusLevel }> = [];

  const refreshRepository = createRepositoryRefresher({
    client: {
      async verifyRepository() {
        throw new Error("Not a jj workspace");
      },
      async loadRepository() {
        throw new Error("should not load");
      },
    },
    actions: {
      setLoading(loading) {
        loadingStates.push(loading);
      },
      applyRepositoryData() {
        throw new Error("refresh should not succeed");
      },
      pushEvent(text, level) {
        events.push({ text, level });
      },
    },
    getRevsetQuery: () => "",
  });

  const result = await refreshRepository();

  expect(result).toBe(false);
  expect(loadingStates).toEqual([false]);
  expect(events).toEqual([{ text: "Not a jj workspace", level: "error" }]);
});

test("bindRefreshOnFocus snapshots the working copy on focus and unsubscribes cleanly", async () => {
  class FakeRenderer extends EventEmitter {}

  const renderer = new FakeRenderer();
  const refreshOptions: RepositoryRefreshOptions[] = [];
  const dispose = bindRefreshOnFocus(renderer, async (options) => {
    refreshOptions.push(options ?? {});
    return true;
  });

  renderer.emit(CliRenderEvents.FOCUS);
  await Promise.resolve();
  expect(refreshOptions).toEqual([{ workingCopy: "snapshot", force: true }]);

  dispose();
  renderer.emit(CliRenderEvents.FOCUS);
  await Promise.resolve();
  expect(refreshOptions).toEqual([{ workingCopy: "snapshot", force: true }]);
});

test("bindAutoRefresh schedules read-only refreshes and unsubscribes cleanly", async () => {
  const callbacks: Array<() => void> = [];
  const cleared: unknown[] = [];
  const refreshOptions: RepositoryRefreshOptions[] = [];

  const dispose = bindAutoRefresh({
    intervalMs: 5000,
    refreshRepository: async (options) => {
      refreshOptions.push(options ?? {});
      return true;
    },
    scheduler: {
      setInterval(callback, delayMs) {
        expect(delayMs).toBe(5000);
        callbacks.push(callback);
        return "handle" as unknown as ReturnType<typeof globalThis.setInterval>;
      },
      clearInterval(handle) {
        cleared.push(handle);
      },
    },
  });

  expect(callbacks).toHaveLength(1);
  callbacks[0]!();
  await Promise.resolve();

  expect(refreshOptions).toEqual([{ workingCopy: "read-only" }]);
  dispose();
  expect(cleared).toEqual(["handle"]);
});

function createFakeDebounceScheduler() {
  const pending: Array<{ callback: () => void; handle: number }> = [];
  let nextHandle = 0;
  const cleared: number[] = [];

  return {
    scheduler: {
      setTimeout(callback: () => void, delayMs: number) {
        expect(delayMs).toBe(1000);
        const handle = nextHandle++;
        pending.push({ callback, handle });
        return handle as unknown as ReturnType<typeof globalThis.setTimeout>;
      },
      clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>) {
        cleared.push(handle as unknown as number);
        const index = pending.findIndex((entry) => entry.handle === (handle as unknown as number));
        if (index !== -1) {
          pending.splice(index, 1);
        }
      },
    },
    firePending() {
      const entries = pending.splice(0);
      for (const entry of entries) {
        entry.callback();
      }
    },
    get pendingCount() {
      return pending.length;
    },
    cleared,
  };
}

test("bindOpHeadsWatcher debounces change bursts into one read-only refresh", async () => {
  const refreshOptions: RepositoryRefreshOptions[] = [];
  let watchedPath: string | undefined;
  let emitChange!: () => void;
  const fake = createFakeDebounceScheduler();

  const dispose = bindOpHeadsWatcher({
    opHeadsPath: "/tmp/repo/.jj/repo/op_heads/heads",
    refreshRepository: async (options) => {
      refreshOptions.push(options ?? {});
      return true;
    },
    watch: (path, onChange) => {
      watchedPath = path;
      emitChange = onChange;
      return { close() {} };
    },
    scheduler: fake.scheduler,
  });

  expect(watchedPath).toBe("/tmp/repo/.jj/repo/op_heads/heads");

  emitChange();
  emitChange();
  emitChange();
  expect(fake.pendingCount).toBe(1);
  expect(refreshOptions).toEqual([]);

  fake.firePending();
  await Promise.resolve();
  expect(refreshOptions).toEqual([{ workingCopy: "read-only" }]);

  emitChange();
  fake.firePending();
  await Promise.resolve();
  expect(refreshOptions).toEqual([
    { workingCopy: "read-only" },
    { workingCopy: "read-only" },
  ]);

  dispose();
});

test("bindOpHeadsWatcher dispose closes the watcher and cancels pending refreshes", () => {
  let closed = 0;
  let emitChange!: () => void;
  const fake = createFakeDebounceScheduler();

  const dispose = bindOpHeadsWatcher({
    opHeadsPath: "/tmp/heads",
    refreshRepository: async () => {
      throw new Error("disposed watcher should not refresh");
    },
    watch: (_path, onChange) => {
      emitChange = onChange;
      return {
        close() {
          closed += 1;
        },
      };
    },
    scheduler: fake.scheduler,
  });

  emitChange();
  dispose();

  expect(closed).toBe(1);
  expect(fake.pendingCount).toBe(0);
});

test("bindOpHeadsWatcher tolerates a watch setup failure", () => {
  const dispose = bindOpHeadsWatcher({
    opHeadsPath: "/tmp/missing",
    refreshRepository: async () => true,
    watch: () => {
      throw new Error("watch unavailable");
    },
  });

  dispose();
});

test("bindAutoRefresh skips disabled intervals", () => {
  const dispose = bindAutoRefresh({
    intervalMs: 0,
    refreshRepository: async () => true,
    scheduler: {
      setInterval() {
        throw new Error("disabled auto-refresh should not schedule");
      },
      clearInterval() {
        throw new Error("disabled auto-refresh should not clear");
      },
    },
  });

  dispose();
});
