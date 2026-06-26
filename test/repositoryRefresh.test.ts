import { EventEmitter } from "node:events";
import { expect, test } from "bun:test";
import { CliRenderEvents } from "@opentui/core";
import type { RepositoryData, StatusLevel } from "../src/domain/types.ts";
import {
  bindAutoRefresh,
  bindRefreshOnFocus,
  createRepositoryRefresher,
  type RepositoryRefreshOptions,
} from "../src/ui/repositoryRefresh.ts";

function createRepositoryData(): RepositoryData {
  return {
    repoPath: "/tmp/repo",
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

test("bindRefreshOnFocus refreshes on focus and unsubscribes cleanly", async () => {
  class FakeRenderer extends EventEmitter {}

  const renderer = new FakeRenderer();
  let refreshCalls = 0;
  const dispose = bindRefreshOnFocus(renderer, async () => {
    refreshCalls += 1;
    return true;
  });

  renderer.emit(CliRenderEvents.FOCUS);
  await Promise.resolve();
  expect(refreshCalls).toBe(1);

  dispose();
  renderer.emit(CliRenderEvents.FOCUS);
  await Promise.resolve();
  expect(refreshCalls).toBe(1);
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
