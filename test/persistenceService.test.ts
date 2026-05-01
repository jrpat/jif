import { expect, test } from "bun:test";
import { createPersistenceService } from "../src/persistence/service.ts";

test("persistence service routes layout preference through global settings", async () => {
  const entries: string[] = [];
  const service = createPersistenceService({
    loadGlobalSetting: async (key) => {
      entries.push(`loadGlobal:${key}`);
      return "condensed";
    },
    saveGlobalSetting: async (key, value) => {
      entries.push(`saveGlobal:${key}:${value}`);
    },
  });

  expect(await service.loadLayoutPreference()).toBe("condensed");
  await service.saveLayoutPreference("expanded");

  expect(entries).toEqual([
    "loadGlobal:layout",
    "saveGlobal:layout:expanded",
  ]);
});

test("persistence service routes workspace history and settings through a history store", async () => {
  const entries: string[] = [];
  const service = createPersistenceService({
    createHistoryStore: (workspaceRoot) => ({
      async load(kind) {
        entries.push(`load:${workspaceRoot}:${kind}`);
        return [`${kind}:entry`];
      },
      async loadSetting(key) {
        entries.push(`loadSetting:${workspaceRoot}:${key}`);
        return `${key}:value`;
      },
      async saveSetting(key, value) {
        entries.push(`saveSetting:${workspaceRoot}:${key}:${value}`);
      },
      async record(kind, value) {
        entries.push(`record:${workspaceRoot}:${kind}:${value}`);
        return [value];
      },
    }),
  });

  expect(await service.loadCommandHistory("/tmp/workspace")).toEqual(["command-history:entry"]);
  expect(await service.recordCommandHistory("/tmp/workspace", "describe -r a")).toEqual(["describe -r a"]);
  expect(await service.loadShellHistory("/tmp/workspace")).toEqual(["shell-history:entry"]);
  expect(await service.recordShellHistory("/tmp/workspace", "pwd | cat")).toEqual(["pwd | cat"]);
  expect(await service.loadRevsetHistory("/tmp/workspace")).toEqual(["revset-history:entry"]);
  expect(await service.recordRevsetHistory("/tmp/workspace", "main..@")).toEqual(["main..@"]);
  expect(await service.loadActiveRevset("/tmp/workspace")).toBe("active-revset:value");
  await service.saveActiveRevset("/tmp/workspace", "trunk()..");

  expect(entries).toEqual([
    "load:/tmp/workspace:command-history",
    "record:/tmp/workspace:command-history:describe -r a",
    "load:/tmp/workspace:shell-history",
    "record:/tmp/workspace:shell-history:pwd | cat",
    "load:/tmp/workspace:revset-history",
    "record:/tmp/workspace:revset-history:main..@",
    "loadSetting:/tmp/workspace:active-revset",
    "saveSetting:/tmp/workspace:active-revset:trunk()..",
  ]);
});