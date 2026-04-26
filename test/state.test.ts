import { expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import {
  applyRepositoryData,
  cancelOrBlurState,
  cancelCommandDraft,
  cancelCommandState,
  clearStatusMessage,
  clearRevisionSelection,
  cycleLayout,
  closeFocusedRevision,
  createInitialState,
  dismissStatusMessage,
  draftConfigs,
  focusCommandBar,
  getFocusedRevisionArg,
  focusWorkingCopy,
  getDisplayedCommandSegments,
  getDisplayedCommandText,
  getSelectedRowIds,
  logEvent,
  openShortcutPanel,
  pushStatusMessage,
  updateStatusMessage,
  pushEvent,
  setCommandBarText,
  moveFocus,
  moveFocusToParent,
  openFocusedRevision,
  closeShortcutPanel,
  toggleShortcutPanel,
  setRevisionFiles,
  startCommandDraft,
  toggleFileSelection,
  toggleRebaseDescendants,
  toggleRevisionSelection,
  expandElidedRevision,
  openRevsetInput,
  closeRevsetInput,
  setRevsetQuery,
  openSearch,
  setSearchText,
  finalizeSearch,
  closeSearch,
  nextSearchMatch,
  prevSearchMatch,
  getSearchMatchIndices,
} from "../src/state/store.ts";

const FIRST_ROW_ID = createRowId("11111111", "aaaaaaaa");
const SECOND_ROW_ID = createRowId("22222222", "bbbbbbbb");
const FIRST_DIVERGENT_ROW_ID = createRowId("11111111", "abcdefgh/0");
const SECOND_DIVERGENT_ROW_ID = createRowId("22222222", "abcdefgh/1");

function createState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      {
        rowId: FIRST_ROW_ID,
        revisionId: "aaaaaaaa",
        parentRevisionIds: ["bbbbbbbb"],
        changeIdPrefixLength: 1,
        commitId: "11111111",
        description: "first",
        localTimestamp: "2026-03-30 07:22:39",
        bookmarks: ["main"],
        workspaces: [],
        graphRows: ["@  "],
        isEmpty: false,
        hasConflict: false,
        marker: "working-copy",
        filesLoaded: true,
        files: [{ status: "M", path: "src/a.ts" }],
      },
      {
        rowId: SECOND_ROW_ID,
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
        files: [{ status: "M", path: "src/b.ts" }],
      },
    ],
  };
}

function createDivergentState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      {
        rowId: FIRST_DIVERGENT_ROW_ID,
        revisionId: "abcdefgh/0",
        changeIdPrefixLength: 3,
        commitId: "11111111",
        description: "first divergent",
        localTimestamp: "2026-03-30 07:22:39",
        bookmarks: [],
        workspaces: [],
        graphRows: ["@  "],
        isEmpty: false,
        hasConflict: false,
        marker: "working-copy",
        filesLoaded: true,
        files: [{ status: "M", path: "src/a.ts" }],
      },
      {
        rowId: SECOND_DIVERGENT_ROW_ID,
        revisionId: "abcdefgh/1",
        changeIdPrefixLength: 3,
        commitId: "22222222",
        description: "second divergent",
        localTimestamp: "2026-03-30 07:22:40",
        bookmarks: [],
        workspaces: [],
        graphRows: ["○  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [{ status: "M", path: "src/b.ts" }],
      },
    ],
  };
}

function createDuplicateRevisionIdState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    focusedRevisionIndex: 1,
    revisions: [
      {
        rowId: "11111111:shared",
        revisionId: "shared",
        changeIdPrefixLength: 3,
        commitId: "11111111",
        description: "first shared revision",
        localTimestamp: "2026-03-30 07:22:39",
        bookmarks: [],
        workspaces: [],
        graphRows: ["@  "],
        isEmpty: false,
        hasConflict: false,
        marker: "working-copy",
        filesLoaded: true,
        files: [{ status: "M", path: "src/a.ts" }],
      },
      {
        rowId: "22222222:shared",
        revisionId: "shared",
        changeIdPrefixLength: 3,
        commitId: "22222222",
        description: "second shared revision",
        localTimestamp: "2026-03-30 07:22:40",
        bookmarks: [],
        workspaces: [],
        graphRows: ["○  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [{ status: "M", path: "src/b.ts" }],
      },
    ],
  } as AppState;
}

test("moveFocus enters file navigation when details are open", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = moveFocus(state, 1);
  expect(state.focusedFileIndex).toBe(0);

  state = setRevisionFiles(state, FIRST_ROW_ID, [
    { status: "M", path: "src/a.ts" },
    { status: "M", path: "src/b.ts" },
  ]);
  state = moveFocus(state, 1);
  expect(state.focusedFileIndex).toBe(1);
  expect(state.focusedRevisionIndex).toBe(0);
});

test("moveFocusToParent focuses the nearest visible parent revision", () => {
  let state = createState();

  state = moveFocusToParent(state);
  expect(state.focusedRevisionIndex).toBe(1);
  expect(state.focusMode).toBe("revisions");

  state = moveFocusToParent(state);
  expect(state.focusedRevisionIndex).toBe(1);
});

test("moveFocusToParent exits file navigation before focusing the parent revision", () => {
  let state = createState();
  state = openFocusedRevision(state);

  state = moveFocusToParent(state);

  expect(state.focusMode).toBe("revisions");
  expect(state.expandedRowId).toBeNull();
  expect(state.focusedRevisionIndex).toBe(1);
  expect(state.focusedFileIndex).toBe(0);
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
  expect(state.expandedRowId).toBe(FIRST_ROW_ID);
});

test("cancelOrBlurState closes the shortcut panel before other browse-mode state", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = openShortcutPanel(state);

  state = cancelOrBlurState(state);

  expect(state.shortcutPanelExpanded).toBeFalse();
  expect(state.focusMode).toBe("files");
  expect(state.expandedRowId).toBe(FIRST_ROW_ID);
});

test("startCommandDraft advances focus to parent revision", () => {
  let state = createState();
  expect(state.focusedRevisionIndex).toBe(0);
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] });
  expect(state.focusedRevisionIndex).toBe(1);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");
});

test("startCommandDraft keeps divergent revision ids unambiguous in command text", () => {
  let state = { ...createDivergentState(), focusedRevisionIndex: 1 };

  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["abcdefgh/1"] });

  expect(state.selectedRowIds).toEqual([SECOND_DIVERGENT_ROW_ID]);
  expect(getDisplayedCommandText(state)).toBe("rebase -r abcdefgh/1 -d ░░░░");
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

test("pushStatusMessage adds a status message without an event log entry", () => {
  let state = createState();
  state = pushStatusMessage(state, "toast-1", "running command", "info");

  expect(state.statusMessages).toHaveLength(1);
  expect(state.statusMessages[0]?.text).toBe("running command");
  expect(state.eventLog).toHaveLength(0);
});

test("updateStatusMessage changes text and level of an existing toast", () => {
  let state = createState();
  state = pushStatusMessage(state, "toast-1", "running command", "info");
  state = updateStatusMessage(state, "toast-1", "done", "success");

  expect(state.statusMessages).toHaveLength(1);
  expect(state.statusMessages[0]?.text).toBe("done");
  expect(state.statusMessages[0]?.level).toBe("success");
});

test("logEvent adds to event log without creating a status message", () => {
  let state = createState();
  state = logEvent(state, "something happened", "success");

  expect(state.statusMessages).toHaveLength(0);
  expect(state.eventLog).toHaveLength(1);
  expect(state.eventLog[0]?.text).toBe("something happened");
});

test("cancelOrBlurState skips info-level status messages", () => {
  let state = createState();
  state = pushStatusMessage(state, "running", "jj git push", "info");

  state = cancelOrBlurState(state);

  expect(state.statusMessages).toHaveLength(1);
  expect(state.statusMessages[0]?.level).toBe("info");
});

test("cancelOrBlurState dismisses error status messages", () => {
  let state = createState();
  state = pushStatusMessage(state, "running", "jj git push", "info");
  state = pushEvent(state, "command failed", "error");

  state = cancelOrBlurState(state);

  expect(state.statusMessages).toHaveLength(1);
  expect(state.statusMessages[0]?.level).toBe("info");
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
  expect(getSelectedRowIds(state).size).toBe(0);

  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] });
  expect(getSelectedRowIds(state).has(FIRST_ROW_ID)).toBeTrue();
});

test("squash command text updates when target is selected", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.squash);
  expect(getDisplayedCommandText(state)).toBe("squash -f a -t b");
  expect(getSelectedRowIds(state).has(FIRST_ROW_ID)).toBeTrue();
});

test("toggleRevisionSelection works without a command draft", () => {
  let state = createState();
  expect(state.selectedRowIds).toEqual([]);

  state = toggleRevisionSelection(state);
  expect(state.selectedRowIds).toEqual([FIRST_ROW_ID]);

  state = toggleRevisionSelection(state);
  expect(state.selectedRowIds).toEqual([]);
});

test("toggleFileSelection adds and removes file paths", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = setRevisionFiles(state, FIRST_ROW_ID, [
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
  expect(state.selectedRowIds).toEqual([FIRST_ROW_ID]);

  state = clearRevisionSelection(state);
  expect(state.selectedRowIds).toEqual([]);
});

test("cancelCommandDraft clears draft and selections but keeps focus mode", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(state.commandDraft).not.toBeNull();
  expect(state.selectedRowIds.length).toBeGreaterThan(0);

  state = cancelCommandDraft(state);
  expect(state.commandDraft).toBeNull();
  expect(state.selectedRowIds).toEqual([]);
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

test("getFocusedRevisionArg uses the concrete revision id for divergent revisions", () => {
  const state = { ...createDivergentState(), focusedRevisionIndex: 1 };

  expect(getFocusedRevisionArg(state)).toBe("abcdefgh/1");
});

test("openFocusedRevision and refresh keep the exact divergent sibling identity", () => {
  let state = { ...createDivergentState(), focusedRevisionIndex: 1 };

  state = openFocusedRevision(state);
  expect(state.expandedRowId).toBe(SECOND_DIVERGENT_ROW_ID);

  const refreshed = applyRepositoryData(state, {
    repoPath: state.repoPath,
    revisions: state.revisions.map((revision) => ({
      ...revision,
      description: `${revision.description} refreshed`,
    })),
  });

  expect(refreshed.focusedRevisionIndex).toBe(1);
  expect(refreshed.expandedRowId).toBe(SECOND_DIVERGENT_ROW_ID);
});

test("applyRepositoryData preserves the focused row by rowId when revision ids collide", () => {
  const state = createDuplicateRevisionIdState();

  const refreshed = applyRepositoryData(state, {
    repoPath: state.repoPath,
    revisions: state.revisions.map((revision) => ({
      ...revision,
      description: `${revision.description} refreshed`,
    })),
  });

  expect(refreshed.focusedRevisionIndex).toBe(1);
  expect(refreshed.revisions[1]?.description).toContain("second shared revision");
});

test("setRevisionFiles targets a single row by rowId when revision ids collide", () => {
  const state = createDuplicateRevisionIdState();

  const next = setRevisionFiles(state, "22222222:shared", [
    { status: "A", path: "src/only-second.ts" },
  ]);

  expect(next.revisions[0]?.files).toEqual([{ status: "M", path: "src/a.ts" }]);
  expect(next.revisions[1]?.files).toEqual([{ status: "A", path: "src/only-second.ts" }]);
});

test("focusWorkingCopy selects the new working-copy revision after repository refresh", () => {
  const state = createState();

  const refreshed = applyRepositoryData(state, {
    repoPath: state.repoPath,
    revisions: [
      {
        rowId: createRowId("33333333", "cccccccc"),
        revisionId: "cccccccc",
        changeIdPrefixLength: 1,
        commitId: "33333333",
        description: "new child",
        localTimestamp: "2026-03-30 07:22:41",
        bookmarks: [],
        workspaces: [],
        graphRows: ["@  "],
        isEmpty: true,
        hasConflict: false,
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
  expect(focusedWorkingCopy.revisions[0]?.revisionId).toBe("cccccccc");
});

test("startCommandDraft uses pre-selected revisions and does not advance focus", () => {
  let state = createState();
  state = toggleRevisionSelection(state);
  state = moveFocus(state, 1);
  state = toggleRevisionSelection(state);
  expect(state.selectedRowIds).toEqual([FIRST_ROW_ID, SECOND_ROW_ID]);

  const prevFocusIndex = state.focusedRevisionIndex;
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });
  expect(state.focusedRevisionIndex).toBe(prevFocusIndex);
  expect(state.selectedRowIds).toEqual([FIRST_ROW_ID, SECOND_ROW_ID]);
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

test("cycleLayout rotates layouts without changing unrelated state", () => {
  const state = createState();
  const next = cycleLayout(state);
  const wrapped = cycleLayout(cycleLayout(next));

  expect(state.layout).toBe("expanded");
  expect(next.layout).toBe("condensed");
  expect(cycleLayout(next).layout).toBe("super-condensed");
  expect(wrapped.layout).toBe("expanded");
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
  expect(state.expandedRowId).toBe(FIRST_ROW_ID);
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
    rowId: "synthetic:elided:2",
    revisionId: "__elided_2",
    changeIdPrefixLength: 0,
    commitId: "",
    description: "(elided revisions)",
    localTimestamp: "",
    bookmarks: [] as readonly string[],
    workspaces: [] as readonly string[],
    graphRows: ["~  "] as readonly string[],
    isEmpty: false,
    hasConflict: false,
    marker: "elided" as const,
    filesLoaded: true,
    files: [] as readonly { status: string; path: string }[],
  };
  state = { ...state, revisions: [...state.revisions, elidedEntry], focusedRevisionIndex: 2 };
  expect(state.revisions).toHaveLength(3);

  const replacements = [
    { ...elidedEntry, rowId: createRowId("33333333", "cccccccc"), revisionId: "cccccccc", marker: "plain" as const, description: "third", commitId: "33333333" },
    { ...elidedEntry, rowId: createRowId("44444444", "dddddddd"), revisionId: "dddddddd", marker: "plain" as const, description: "fourth", commitId: "44444444" },
  ];
  state = expandElidedRevision(state, 2, replacements);

  expect(state.revisions).toHaveLength(4);
  expect(state.revisions[2]?.revisionId).toBe("cccccccc");
  expect(state.revisions[3]?.revisionId).toBe("dddddddd");
  expect(state.focusedRevisionIndex).toBe(2);
});

test("applyRepositoryData clears stale loaded files when a revision becomes empty", () => {
  const state = createState();

  const next = applyRepositoryData(state, {
    repoPath: state.repoPath,
    revisions: [
      {
        rowId: FIRST_ROW_ID,
        revisionId: "aaaaaaaa",
        changeIdPrefixLength: 1,
        commitId: "11111111",
        description: "(empty)",
        localTimestamp: "2026-03-30 07:22:39",
        bookmarks: ["main"],
        workspaces: [],
        graphRows: ["@  "],
        isEmpty: true,
        hasConflict: false,
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

test("openSearch sets focusMode to search and clears searchQuery", () => {
  let state = createState();
  state = openSearch(state);
  expect(state.focusMode).toBe("search");
  expect(state.searchQuery).toBe("");
});

test("setSearchText moves focus to first matching revision", () => {
  let state = createState();
  state = openSearch(state);
  expect(state.focusedRevisionIndex).toBe(0);

  state = setSearchText(state, "second");
  expect(state.searchQuery).toBe("second");
  expect(state.focusedRevisionIndex).toBe(1);
});

test("setSearchText matches bookmarks", () => {
  let state = createState();
  state = openSearch(state);
  state = moveFocus(state, 1);
  expect(state.focusedRevisionIndex).toBe(1);

  state = setSearchText(state, "main");
  expect(state.focusedRevisionIndex).toBe(0);
});

test("setSearchText with no match preserves current focus", () => {
  let state = createState();
  state = openSearch(state);
  state = moveFocus(state, 1);

  state = setSearchText(state, "nonexistent");
  expect(state.focusedRevisionIndex).toBe(1);
});

test("finalizeSearch returns to browse mode but keeps query", () => {
  let state = createState();
  state = openSearch(state);
  state = setSearchText(state, "first");

  state = finalizeSearch(state);
  expect(state.focusMode).toBe("revisions");
  expect(state.searchQuery).toBe("first");
});

test("closeSearch clears query and returns to browse mode", () => {
  let state = createState();
  state = openSearch(state);
  state = setSearchText(state, "first");

  state = closeSearch(state);
  expect(state.focusMode).toBe("revisions");
  expect(state.searchQuery).toBe("");
});

test("nextSearchMatch wraps around to first match", () => {
  let state = createState();
  state = setSearchText(state, "a");
  // Both "aaaaaaaa" and "bbbbbbbb" contain 'a'... let me use description
  state = { ...state, searchQuery: "" };

  // Set up: both revisions match "s" (first, second)
  state = setSearchText(state, "s");
  expect(state.focusedRevisionIndex).toBe(0);

  state = nextSearchMatch(state);
  expect(state.focusedRevisionIndex).toBe(1);

  // Wrap around
  state = nextSearchMatch(state);
  expect(state.focusedRevisionIndex).toBe(0);
});

test("prevSearchMatch wraps around to last match", () => {
  let state = createState();
  state = setSearchText(state, "s");
  expect(state.focusedRevisionIndex).toBe(0);

  // Wrap around to last
  state = prevSearchMatch(state);
  expect(state.focusedRevisionIndex).toBe(1);

  state = prevSearchMatch(state);
  expect(state.focusedRevisionIndex).toBe(0);
});

test("getSearchMatchIndices returns correct indices", () => {
  let state = createState();
  state = { ...state, searchQuery: "second" };
  expect(getSearchMatchIndices(state)).toEqual([1]);

  state = { ...state, searchQuery: "" };
  expect(getSearchMatchIndices(state)).toEqual([]);
});

test("cancelOrBlurState exits search before handling other state", () => {
  let state = createState();
  state = openSearch(state);
  state = setSearchText(state, "first");

  state = cancelOrBlurState(state);
  expect(state.focusMode).toBe("revisions");
  expect(state.searchQuery).toBe("");
});

test("cancelOrBlurState clears finalized search query", () => {
  let state = createState();
  state = openSearch(state);
  state = setSearchText(state, "first");
  state = finalizeSearch(state);
  expect(state.focusMode).toBe("revisions");
  expect(state.searchQuery).toBe("first");

  state = cancelOrBlurState(state);
  expect(state.searchQuery).toBe("");
});
