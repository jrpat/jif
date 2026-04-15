import { EventEmitter } from "node:events";
import { expect, test } from "bun:test";
import { CliRenderEvents } from "@opentui/core";
import type { RepositoryData, StatusLevel } from "../src/domain/types.ts";
import { bindRefreshOnFocus, createRepositoryRefresher } from "../src/ui/repositoryRefresh.ts";

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

  await refreshRepository();

  expect(calls).toEqual([
    "verify",
    "load:mine()",
  ]);
  expect(appliedRepositoryData).toEqual(repositoryData);
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

  await refreshRepository();

  expect(loadingStates).toEqual([false]);
  expect(events).toEqual([{ text: "Not a jj workspace", level: "error" }]);
});

test("bindRefreshOnFocus refreshes on focus and unsubscribes cleanly", async () => {
  class FakeRenderer extends EventEmitter {}

  const renderer = new FakeRenderer();
  let refreshCalls = 0;
  const dispose = bindRefreshOnFocus(renderer, async () => {
    refreshCalls += 1;
  });

  renderer.emit(CliRenderEvents.FOCUS);
  await Promise.resolve();
  expect(refreshCalls).toBe(1);

  dispose();
  renderer.emit(CliRenderEvents.FOCUS);
  await Promise.resolve();
  expect(refreshCalls).toBe(1);
});
