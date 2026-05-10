import { expect, test } from "bun:test";
import { createAppStore } from "../src/state/appStore.ts";
import type { OperationLogEntry, RevisionSummary } from "../src/domain/types.ts";

const REVISIONS: readonly RevisionSummary[] = [
  {
    rowId: "11111111:aaaaaaaa",
    revisionId: "aaaaaaaa",
    parentRevisionIds: [],
    changeIdPrefixLength: 1,
    commitId: "11111111",
    description: "first",
    localTimestamp: "2026-03-30 07:22:39",
    bookmarks: [],
    workspaces: [],
    graphRows: ["@  "],
    isEmpty: false,
    hasConflict: false,
    marker: "working-copy",
    filesLoaded: true,
    files: [],
  },
  {
    rowId: "22222222:bbbbbbbb",
    revisionId: "bbbbbbbb",
    parentRevisionIds: [],
    changeIdPrefixLength: 1,
    commitId: "22222222",
    description: "second",
    localTimestamp: "2026-03-30 07:22:40",
    bookmarks: [],
    workspaces: [],
    graphRows: ["○  "],
    isEmpty: false,
    hasConflict: false,
    marker: "plain",
    filesLoaded: true,
    files: [],
  },
];

const OP_LOG_ENTRIES: readonly OperationLogEntry[] = [
  { id: "op-1", lines: ["op-1 line"] },
  { id: "op-2", lines: ["op-2 line"] },
];

test("AppStore keeps all app state in one reactive store", () => {
  const store = createAppStore("/tmp/repo");

  store.actions.focusCommandBar();
  store.actions.setCommandBarText("log");

  expect(store.state.focusMode).toBe("command");
  expect(store.state.commandBar.text).toBe("log");

  store.dispose();
});

test("AppStore seeds layout from config options and cycles through all layouts", () => {
  const store = createAppStore("/tmp/repo", { layout: "condensed" });

  expect(store.state.layout).toBe("condensed");

  store.actions.cycleLayout();
  expect(store.state.layout).toBe("super-condensed");

  store.actions.cycleLayout();
  expect(store.state.layout).toBe("expanded");

  store.actions.cycleLayout();
  expect(store.state.layout).toBe("condensed");

  store.dispose();
});

test("AppStore exposes shortcut panel actions", () => {
  const store = createAppStore("/tmp/repo");

  store.actions.openShortcutPanel();
  expect(store.state.shortcutPanelExpanded).toBeTrue();

  store.actions.toggleShortcutPanel();
  expect(store.state.shortcutPanelExpanded).toBeFalse();

  store.dispose();
});

test("AppStore exposes last failed command actions", () => {
  const store = createAppStore("/tmp/repo");

  store.actions.setLastFailedCommand({
    commandText: "bookmark set main -r main-",
    commandArgs: ["bookmark", "set", "main", "-r", "main-"],
    interactive: false,
    errorText: "Error: Refusing to move bookmark backwards or sideways: main",
    stderr: "Error: Refusing to move bookmark backwards or sideways: main\nHint: Use --allow-backwards to allow it.",
  });
  expect(store.state.lastFailedCommand?.commandText).toBe("bookmark set main -r main-");

  store.actions.clearLastFailedCommand();
  expect(store.state.lastFailedCommand).toBeNull();

  store.dispose();
});

test("AppStore exposes focus-by-index actions for revisions, op log, and notifications", () => {
  const store = createAppStore("/tmp/repo");

  store.actions.applyRepositoryData({ repoPath: "/tmp/repo", revisions: REVISIONS });
  store.actions.focusRevisionAt(1);
  expect(store.state.focusedRevisionIndex).toBe(1);

  store.actions.setOperationLogEntries(OP_LOG_ENTRIES);
  store.actions.focusOperationLogEntryAt(1);
  expect(store.state.focusedOperationLogIndex).toBe(1);

  store.actions.pushEvent("first", "info");
  store.actions.pushEvent("second", "info");
  store.actions.focusNotificationAt(1);
  expect(store.state.focusedNotificationIndex).toBe(1);

  store.dispose();
});
