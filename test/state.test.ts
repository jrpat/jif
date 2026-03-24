import { expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import {
  cancelCommandDraft,
  cancelCommandState,
  clearRevisionSelection,
  closeFocusedRevision,
  createInitialState,
  dismissOldestError,
  draftConfigs,
  focusCommandBar,
  getDisplayedCommandText,
  getSelectedRevisionIds,
  pushEvent,
  setCommandBarText,
  setError,
  moveFocus,
  openFocusedRevision,
  setRevisionFiles,
  startCommandDraft,
  toggleFileSelection,
  toggleRebaseDescendants,
  toggleRevisionSelection,
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
        bookmarks: ["main"],
        workspaces: [],
        graphHead: "@  ",
        graphTail: [],
        marker: "working-copy",
        files: [{ status: "M", path: "src/a.ts" }],
      },
      {
        changeId: "bbbbbbbb",
        changeIdPrefixLength: 1,
        commitId: "22222222",
        description: "second",
        bookmarks: [],
        workspaces: [],
        graphHead: "○  ",
        graphTail: [],
        marker: "plain",
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

test("dismissOldestError clears state.error first", () => {
  let state = createState();
  state = setError(state, "repo not found");
  state = pushEvent(state, "command failed", "error");

  state = dismissOldestError(state);
  expect(state.error).toBeNull();
  expect(state.eventLog.length).toBe(1);
});

test("dismissOldestError removes oldest error event and clears error statusMessage", () => {
  let state = createState();
  state = pushEvent(state, "first error", "error");
  state = pushEvent(state, "info message", "info");
  state = pushEvent(state, "second error", "error");

  state = dismissOldestError(state);
  expect(state.eventLog.length).toBe(2);
  expect(state.eventLog[0]?.text).toBe("info message");
  expect(state.eventLog[1]?.text).toBe("second error");
  expect(state.statusMessage).toBeNull();
});

test("dismissOldestError clears error statusMessage even with no error events", () => {
  let state = createState();
  state = pushEvent(state, "command failed", "error");
  state = { ...state, eventLog: [] };

  state = dismissOldestError(state);
  expect(state.statusMessage).toBeNull();
});

test("dismissOldestError clears success statusMessage when no errors exist", () => {
  let state = createState();
  state = pushEvent(state, "all good", "success");
  expect(state.statusMessage?.level).toBe("success");

  state = dismissOldestError(state);
  expect(state.statusMessage).toBeNull();
});

test("dismissOldestError is a no-op when no status message exists", () => {
  const state = createState();
  const next = dismissOldestError(state);
  expect(next).toBe(state);
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
