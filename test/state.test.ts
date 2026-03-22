import { expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import {
  cancelCommandState,
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
  toggleRebaseDescendants,
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

test("rebase command text updates when descendants are toggled", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] });
  state = moveFocus(state, 1);
  expect(getDisplayedCommandText(state)).toBe("rebase -r aaaaaaaa -o bbbbbbbb");

  state = toggleRebaseDescendants(state, ["aaaaaaaa", "bbbbbbbb"]);
  expect(getDisplayedCommandText(state)).toBe("rebase -s aaaaaaaa -o bbbbbbbb");
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

test("dismissOldestError is a no-op when no errors exist", () => {
  let state = createState();
  state = pushEvent(state, "all good", "success");

  const next = dismissOldestError(state);
  expect(next).toBe(state);
});

test("selected revision ids come from the active command draft", () => {
  let state = createState();
  expect(getSelectedRevisionIds(state).size).toBe(0);

  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] });
  expect(getSelectedRevisionIds(state).has("aaaaaaaa")).toBeTrue();
});

test("squash command text updates when target is selected", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.squash);
  expect(getDisplayedCommandText(state)).toBe("squash --from aaaaaaaa");
  expect(getSelectedRevisionIds(state).has("aaaaaaaa")).toBeTrue();

  state = moveFocus(state, 1);
  expect(getDisplayedCommandText(state)).toBe("squash --from aaaaaaaa --into bbbbbbbb");
});
