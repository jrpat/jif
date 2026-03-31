import { expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import {
  applyRepositoryData,
  cancelCommandDraft,
  cancelCommandState,
  clearStatusMessage,
  clearRevisionSelection,
  closeFocusedRevision,
  createInitialState,
  dismissStatusMessage,
  draftConfigs,
  focusCommandBar,
  getFocusedRevisionArg,
  focusWorkingCopy,
  getDisplayedCommandSegments,
  getDisplayedCommandText,
  getSelectedRevisionIds,
  openShortcutPanel,
  pushEvent,
  setCommandBarText,
  moveFocus,
  openFocusedRevision,
  closeShortcutPanel,
  toggleShortcutPanel,
  toggleCondensedLayout,
  setRevisionFiles,
  startCommandDraft,
  toggleFileSelection,
  toggleRebaseDescendants,
  toggleRevisionSelection,
  expandElidedRevision,
  openRevsetInput,
  closeRevsetInput,
  setRevsetQuery,
} from "../src/state/store.ts";

function createState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      {
        changeId: "aaaaaaaa",
        changeIdPrefixLength: 1,
        commitId: "11111111",
        description: "first",
        localTimestamp: "2026-03-30 07:22:39",
        bookmarks: ["main"],
        workspaces: [],
        graphHead: "@  ",
        graphTail: [],
        isEmpty: false,
        marker: "working-copy",
        filesLoaded: true,
        files: [{ status: "M", path: "src/a.ts" }],
      },
      {
        changeId: "bbbbbbbb",
        changeIdPrefixLength: 1,
        commitId: "22222222",
        description: "second",
        localTimestamp: "2026-03-30 07:22:40",
        bookmarks: [],
        workspaces: [],
        graphHead: "○  ",
        graphTail: [],
        isEmpty: false,
        marker: "plain",
        filesLoaded: true,
        files: [{ status: "M", path: "src/b.ts" }],
      },
    ],
  };
}

test("moveFocus enters file navigation when details are open", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = moveFocus(state, 1);
  expect(state.focusedFileIndex).toBe(0);

  state = setRevisionFiles(state, "aaaaaaaa", [
    { status: "M", path: "src/a.ts" },
    { status: "M", path: "src/b.ts" },
  ]);
  state = moveFocus(state, 1);
  expect(state.focusedFileIndex).toBe(1);
  expect(state.focusedRevisionIndex).toBe(0);
});

test("command bar editing is controlled by reducer state", () => {
  let state = createState();
  state = focusCommandBar(state);
  state = setCommandBarText(state, "log");
  expect(getDisplayedCommandText(state)).toBe("log");
  expect(state.focusMode).toBe("command");

  state = cancelCommandState(state);
  expect(getDisplayedCommandText(state)).toBe("");
  expect(state.focusMode).toBe("revisions");
});

test("cancelCommandState returns to file navigation when a revision is expanded", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = focusCommandBar(state);

  state = cancelCommandState(state);

  expect(state.focusMode).toBe("files");
  expect(state.expandedRevisionId).toBe("aaaaaaaa");
});

test("startCommandDraft advances focus to parent revision", () => {
  let state = createState();
  expect(state.focusedRevisionIndex).toBe(0);
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] });
  expect(state.focusedRevisionIndex).toBe(1);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");
});

test("rebase command text updates when descendants are toggled", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] });
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");

  state = toggleRebaseDescendants(state, ["aaaaaaaa", "bbbbbbbb"]);
  expect(getDisplayedCommandText(state)).toBe("rebase -s a -d b");
});

test("pushEvent appends visible status messages instead of replacing them", () => {
  let state = createState();
  state = pushEvent(state, "command failed", "error");
  state = pushEvent(state, "all good", "success");

  expect(state.statusMessages.map((message) => message.text)).toEqual([
    "command failed",
    "all good",
  ]);
  expect(state.eventLog).toHaveLength(2);
});

test("dismissStatusMessage clears the oldest visible status message first", () => {
  let state = createState();
  state = pushEvent(state, "command failed", "error", 10);
  state = pushEvent(state, "all good", "success", 20);
  expect(state.statusMessages).toHaveLength(2);

  state = dismissStatusMessage(state);
  expect(state.statusMessages.map((message) => message.text)).toEqual(["all good"]);
  expect(state.eventLog.length).toBe(2);
});

test("dismissStatusMessage can target a specific status message id", () => {
  let state = createState();
  state = pushEvent(state, "first", "info", 10);
  state = pushEvent(state, "second", "success", 20);
  const targetId = state.statusMessages[1]?.id;

  state = dismissStatusMessage(state, targetId);
  expect(state.statusMessages.map((message) => message.text)).toEqual(["first"]);
});

test("dismissStatusMessage is a no-op when no status message exists", () => {
  const state = createState();
  const next = dismissStatusMessage(state);
  expect(next).toBe(state);
});

test("clearStatusMessage removes all visible status messages", () => {
  let state = createState();
  state = pushEvent(state, "first", "info", 10);
  state = pushEvent(state, "second", "success", 20);

  state = clearStatusMessage(state);
  expect(state.statusMessages).toEqual([]);
});

test("pushEvent keeps a maximum of 100 entries in the event log", () => {
  let state = createState();
  for (let i = 0; i < 105; i++) {
    state = pushEvent(state, `event ${i}`, "info", i);
  }
  expect(state.eventLog.length).toBe(100);
  expect(state.eventLog[0]?.text).toBe("event 5");
  expect(state.eventLog[99]?.text).toBe("event 104");
});

test("selected revision ids are populated when starting a command draft", () => {
  let state = createState();
  expect(getSelectedRevisionIds(state).size).toBe(0);

  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] });
  expect(getSelectedRevisionIds(state).has("aaaaaaaa")).toBeTrue();
});

test("squash command text updates when target is selected", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.squash);
  expect(getDisplayedCommandText(state)).toBe("squash -f a -t b");
  expect(getSelectedRevisionIds(state).has("aaaaaaaa")).toBeTrue();
});

test("toggleRevisionSelection works without a command draft", () => {
  let state = createState();
  expect(state.selectedRevisionIds).toEqual([]);

  state = toggleRevisionSelection(state);
  expect(state.selectedRevisionIds).toEqual(["aaaaaaaa"]);

  state = toggleRevisionSelection(state);
  expect(state.selectedRevisionIds).toEqual([]);
});

test("toggleFileSelection adds and removes file paths", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = setRevisionFiles(state, "aaaaaaaa", [
    { status: "M", path: "src/a.ts" },
    { status: "A", path: "src/b.ts" },
  ]);
  expect(state.selectedFilePaths).toEqual([]);

  state = toggleFileSelection(state);
  expect(state.selectedFilePaths).toEqual(["src/a.ts"]);

  state = moveFocus(state, 1);
  state = toggleFileSelection(state);
  expect(state.selectedFilePaths).toEqual(["src/a.ts", "src/b.ts"]);

  state = toggleFileSelection(state);
  expect(state.selectedFilePaths).toEqual(["src/a.ts"]);
});

test("closeFocusedRevision clears file selections", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = toggleFileSelection(state);
  expect(state.selectedFilePaths.length).toBe(1);

  state = closeFocusedRevision(state);
  expect(state.selectedFilePaths).toEqual([]);
  expect(state.focusMode).toBe("revisions");
});

test("clearRevisionSelection clears only revision selections", () => {
  let state = createState();
  state = toggleRevisionSelection(state);
  expect(state.selectedRevisionIds).toEqual(["aaaaaaaa"]);

  state = clearRevisionSelection(state);
  expect(state.selectedRevisionIds).toEqual([]);
});

test("cancelCommandDraft clears draft and selections but keeps focus mode", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(state.commandDraft).not.toBeNull();
  expect(state.selectedRevisionIds.length).toBeGreaterThan(0);

  state = cancelCommandDraft(state);
  expect(state.commandDraft).toBeNull();
  expect(state.selectedRevisionIds).toEqual([]);
});

test("focusWorkingCopy jumps to the working-copy revision", () => {
  let state = createState();
  state = moveFocus(state, 1);
  expect(state.focusedRevisionIndex).toBe(1);

  state = focusWorkingCopy(state);
  expect(state.focusedRevisionIndex).toBe(0);
  expect(state.focusedFileIndex).toBe(0);
});

test("focusWorkingCopy is a no-op when no working copy exists", () => {
  let state = createState();
  state = {
    ...state,
    revisions: state.revisions.map((r) => ({ ...r, marker: "plain" as const })),
  };
  state = moveFocus(state, 1);
  const before = state.focusedRevisionIndex;

  state = focusWorkingCopy(state);
  expect(state.focusedRevisionIndex).toBe(before);
});

test("getFocusedRevisionArg uses the focused revision prefix length", () => {
  const state = createState();
  expect(getFocusedRevisionArg(state)).toBe("a");
});

test("focusWorkingCopy selects the new working-copy revision after repository refresh", () => {
  const state = createState();

  const refreshed = applyRepositoryData(state, {
    repoPath: state.repoPath,
    revisions: [
      {
        changeId: "cccccccc",
        changeIdPrefixLength: 1,
        commitId: "33333333",
        description: "new child",
        localTimestamp: "2026-03-30 07:22:41",
        bookmarks: [],
        workspaces: [],
        graphHead: "@  ",
        graphTail: [],
        isEmpty: true,
        marker: "working-copy",
        filesLoaded: true,
        files: [],
      },
      {
        ...state.revisions[0]!,
        marker: "plain",
      },
      state.revisions[1]!,
    ],
  });

  expect(refreshed.focusedRevisionIndex).toBe(1);

  const focusedWorkingCopy = focusWorkingCopy(refreshed);
  expect(focusedWorkingCopy.focusedRevisionIndex).toBe(0);
  expect(focusedWorkingCopy.revisions[0]?.changeId).toBe("cccccccc");
});

test("startCommandDraft uses pre-selected revisions and does not advance focus", () => {
  let state = createState();
  state = toggleRevisionSelection(state);
  state = moveFocus(state, 1);
  state = toggleRevisionSelection(state);
  expect(state.selectedRevisionIds).toEqual(["aaaaaaaa", "bbbbbbbb"]);

  const prevFocusIndex = state.focusedRevisionIndex;
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });
  expect(state.focusedRevisionIndex).toBe(prevFocusIndex);
  expect(state.selectedRevisionIds).toEqual(["aaaaaaaa", "bbbbbbbb"]);
});

test("multiple selected revisions produce repeated flags", () => {
  let state = createState();
  state = toggleRevisionSelection(state);
  state = moveFocus(state, 1);
  state = toggleRevisionSelection(state);
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -r b -d ░░░░");
});

test("multiple selections with descendants produce repeated -s flags", () => {
  let state = createState();
  state = toggleRevisionSelection(state);
  state = moveFocus(state, 1);
  state = toggleRevisionSelection(state);
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });
  state = toggleRebaseDescendants(state, []);
  expect(getDisplayedCommandText(state)).toBe("rebase -s a -s b -d ░░░░");
});

test("multiple selections in squash produce repeated -f flags", () => {
  let state = createState();
  state = toggleRevisionSelection(state);
  state = moveFocus(state, 1);
  state = toggleRevisionSelection(state);
  state = startCommandDraft(state, draftConfigs.squash);
  expect(getDisplayedCommandText(state)).toBe("squash -f a -f b -t ░░░░");
});

test("arg helper selects long flags when useShortFlags is false", () => {
  let state = { ...createState(), useShortFlags: false };
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] });
  expect(getDisplayedCommandText(state)).toBe("rebase --revisions a --destination b");
});

test("toggleCondensedLayout flips only condensed layout", () => {
  const state = createState();
  const next = toggleCondensedLayout(state);

  expect(state.condensedLayout).toBeFalse();
  expect(next.condensedLayout).toBeTrue();
  expect(next.useShortFlags).toBe(state.useShortFlags);
  expect(next.focusedRevisionIndex).toBe(state.focusedRevisionIndex);
});

test("shortcut panel is collapsed by default and can be toggled", () => {
  let state = createState();
  expect(state.shortcutPanelExpanded).toBeFalse();

  state = toggleShortcutPanel(state);
  expect(state.shortcutPanelExpanded).toBeTrue();

  state = toggleShortcutPanel(state);
  expect(state.shortcutPanelExpanded).toBeFalse();
});

test("openShortcutPanel and closeShortcutPanel are idempotent", () => {
  const collapsed = createState();
  const open = openShortcutPanel(collapsed);
  expect(open.shortcutPanelExpanded).toBeTrue();
  expect(openShortcutPanel(open)).toBe(open);

  const closed = closeShortcutPanel(collapsed);
  expect(closed).toBe(collapsed);
  expect(closeShortcutPanel(open).shortcutPanelExpanded).toBeFalse();
});

test("shortcut panel expansion survives revset mode transitions", () => {
  let state = createState();
  state = openShortcutPanel(state);
  state = openRevsetInput(state);
  expect(state.shortcutPanelExpanded).toBeTrue();

  state = closeRevsetInput(state);
  expect(state.shortcutPanelExpanded).toBeTrue();
});

test("segment highlighting styles flags as command and values as selected/target", () => {
  let state = createState();
  state = toggleRevisionSelection(state);
  state = moveFocus(state, 1);
  state = toggleRevisionSelection(state);
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });
  // Target not yet chosen, so placeholder
  const segments = getDisplayedCommandSegments(state)!;
  expect(segments).toEqual([
    { text: "rebase -r ", style: "command" },
    { text: "a", style: "selected" },
    { text: " -r ", style: "command" },
    { text: "b", style: "selected" },
    { text: " -d ", style: "command" },
    { text: "░░░░", style: "placeholder" },
  ]);
});

test("openRevsetInput sets focusMode to revset", () => {
  let state = createState();
  expect(state.focusMode).toBe("revisions");
  state = openRevsetInput(state);
  expect(state.focusMode).toBe("revset");
});

test("closeRevsetInput restores focusMode to revisions", () => {
  let state = createState();
  state = openRevsetInput(state);
  state = closeRevsetInput(state);
  expect(state.focusMode).toBe("revisions");
});

test("closeRevsetInput returns to file navigation when a revision is expanded", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = openRevsetInput(state);

  state = closeRevsetInput(state);

  expect(state.focusMode).toBe("files");
  expect(state.expandedRevisionId).toBe("aaaaaaaa");
});

test("setRevsetQuery updates the query", () => {
  let state = createState();
  expect(state.revsetQuery).toBe("");
  state = setRevsetQuery(state, "ancestors(trunk(), 10)");
  expect(state.revsetQuery).toBe("ancestors(trunk(), 10)");
});

test("expandElidedRevision replaces elided entry with new revisions and updates focus", () => {
  let state = createState();
  const elidedEntry = {
    changeId: "__elided_2",
    changeIdPrefixLength: 0,
    commitId: "",
    description: "(elided revisions)",
    localTimestamp: "",
    bookmarks: [] as readonly string[],
    workspaces: [] as readonly string[],
    graphHead: "~  ",
    graphTail: [] as readonly string[],
    isEmpty: false,
    marker: "elided" as const,
    filesLoaded: true,
    files: [] as readonly { status: string; path: string }[],
  };
  state = { ...state, revisions: [...state.revisions, elidedEntry], focusedRevisionIndex: 2 };
  expect(state.revisions).toHaveLength(3);

  const replacements = [
    { ...elidedEntry, changeId: "cccccccc", marker: "plain" as const, description: "third" },
    { ...elidedEntry, changeId: "dddddddd", marker: "plain" as const, description: "fourth" },
  ];
  state = expandElidedRevision(state, 2, replacements);

  expect(state.revisions).toHaveLength(4);
  expect(state.revisions[2]?.changeId).toBe("cccccccc");
  expect(state.revisions[3]?.changeId).toBe("dddddddd");
  expect(state.focusedRevisionIndex).toBe(2);
});

test("applyRepositoryData clears stale loaded files when a revision becomes empty", () => {
  const state = createState();

  const next = applyRepositoryData(state, {
    repoPath: state.repoPath,
    revisions: [
      {
        changeId: "aaaaaaaa",
        changeIdPrefixLength: 1,
        commitId: "11111111",
        description: "(empty)",
        localTimestamp: "2026-03-30 07:22:39",
        bookmarks: ["main"],
        workspaces: [],
        graphHead: "@  ",
        graphTail: [],
        isEmpty: true,
        marker: "working-copy",
        filesLoaded: true,
        files: [],
      },
      state.revisions[1]!,
    ],
  });

  expect(next.revisions[0]?.files).toEqual([]);
  expect(next.revisions[0]?.filesLoaded).toBeTrue();
  expect(next.revisions[0]?.isEmpty).toBeTrue();
});
