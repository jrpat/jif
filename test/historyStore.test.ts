import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  HistoryStore,
  matchHistoryEntries,
  type HistoryKind,
  resolveHistoryFilePath,
} from "../src/history/store.ts";
import { createTempDir } from "./helpers/tempRepo.ts";

describe("resolveHistoryFilePath", () => {
  test("stores command history in the workspace .jj folder", () => {
    expect(resolveHistoryFilePath("/tmp/worktree", "command-history")).toBe(
      "/tmp/worktree/.jj/jif/command-history",
    );
  });

  test("stores shell history in the workspace .jj folder", () => {
    expect(resolveHistoryFilePath("/tmp/worktree", "shell-history")).toBe(
      "/tmp/worktree/.jj/jif/shell-history",
    );
  });

  test("stores revset history in the workspace .jj folder", () => {
    expect(resolveHistoryFilePath("/tmp/worktree", "revset-history")).toBe(
      "/tmp/worktree/.jj/jif/revset-history",
    );
  });
});

describe("HistoryStore", () => {
  async function createStore(kind: HistoryKind = "command-history") {
    const workspaceRoot = await createTempDir("history-store");
    await mkdir(join(workspaceRoot, ".jj"), { recursive: true });
    return {
      workspaceRoot,
      kind,
      store: new HistoryStore(workspaceRoot),
    };
  }

  test("returns an empty list when the history file does not exist", async () => {
    const { store } = await createStore();
    expect(await store.load("command-history")).toEqual([]);
  });

  test("records newest entries first", async () => {
    const { store } = await createStore();
    await store.record("command-history", "log");
    const history = await store.record("command-history", "rebase -r a -d b");

    expect(history).toEqual(["rebase -r a -d b", "log"]);
    expect(await store.load("command-history")).toEqual(["rebase -r a -d b", "log"]);
  });

  test("deduplicates by exact text and promotes an existing entry to the front", async () => {
    const { store } = await createStore();
    await store.record("command-history", "log");
    await store.record("command-history", "undo");
    const history = await store.record("command-history", "log");

    expect(history).toEqual(["log", "undo"]);
  });

  test("trims history to 200 entries", async () => {
    const { store } = await createStore();

    for (let index = 0; index < 205; index += 1) {
      await store.record("command-history", `command-${index}`);
    }

    const history = await store.load("command-history");
    expect(history).toHaveLength(200);
    expect(history[0]).toBe("command-204");
    expect(history.at(-1)).toBe("command-5");
  });

  test("keeps command and revset histories isolated", async () => {
    const { store } = await createStore();
    await store.record("command-history", "log");
    await store.record("shell-history", "pwd | cat");
    await store.record("revset-history", "ancestors(main, 5)");

    expect(await store.load("command-history")).toEqual(["log"]);
    expect(await store.load("shell-history")).toEqual(["pwd | cat"]);
    expect(await store.load("revset-history")).toEqual(["ancestors(main, 5)"]);
  });

  test("ignores blank values", async () => {
    const { store } = await createStore();
    await store.record("command-history", "log");
    const history = await store.record("command-history", "   ");

    expect(history).toEqual(["log"]);
  });

  test("remove deletes a matching entry and persists the result", async () => {
    const { store } = await createStore();
    await store.record("command-history", "log");
    await store.record("command-history", "undo");
    await store.record("command-history", "rebase -r a -d b");

    const afterRemove = await store.remove("command-history", "undo");
    expect(afterRemove).toEqual(["rebase -r a -d b", "log"]);
    expect(await store.load("command-history")).toEqual(["rebase -r a -d b", "log"]);
  });

  test("remove is a no-op when no entry matches", async () => {
    const { store } = await createStore();
    await store.record("command-history", "log");

    const afterRemove = await store.remove("command-history", "undo");
    expect(afterRemove).toEqual(["log"]);
    expect(await store.load("command-history")).toEqual(["log"]);
  });

  test("remove empties the history file when the last entry is removed", async () => {
    const { store } = await createStore();
    await store.record("command-history", "log");

    expect(await store.remove("command-history", "log")).toEqual([]);
    expect(await store.load("command-history")).toEqual([]);
  });

  test("saveSetting writes and loadSetting reads a single value", async () => {
    const { store } = await createStore();
    await store.saveSetting("active-revset", "trunk()..");
    expect(await store.loadSetting("active-revset")).toBe("trunk()..");
  });

  test("loadSetting returns empty string when file does not exist", async () => {
    const { store } = await createStore();
    expect(await store.loadSetting("nonexistent")).toBe("");
  });

  test("saveSetting overwrites previous value", async () => {
    const { store } = await createStore();
    await store.saveSetting("active-revset", "trunk()..");
    await store.saveSetting("active-revset", "main..");
    expect(await store.loadSetting("active-revset")).toBe("main..");
  });
});

describe("matchHistoryEntries", () => {
  test("returns entries in MRU order for a blank query", () => {
    expect(matchHistoryEntries("", ["log", "undo", "rebase -r a -d b"])).toEqual([
      "log",
      "undo",
      "rebase -r a -d b",
    ]);
  });

  test("returns best fuzzy matches first", () => {
    expect(matchHistoryEntries("rb", [
      "log",
      "rebase -r a -d b",
      "restore src/app.ts --from b",
    ])).toEqual(["rebase -r a -d b", "restore src/app.ts --from b"]);
  });
});
