import { expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import {
  cancelCommandDraft,
  cancelCommandState,
  clearRevisionSelection,
  closeFocusedRevision,
  createInitialState,
  dismissStatusMessage,
  draftConfigs,
  focusCommandBar,
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

test("dismissStatusMessage clears the current status message", () => {
  let state = createState();
  state = pushEvent(state, "command failed", "error");
  expect(state.statusMessage).not.toBeNull();

  state = dismissStatusMessage(state);
  expect(state.statusMessage).toBeNull();
  expect(state.eventLog.length).toBe(1);
});

test("dismissStatusMessage clears success status message", () => {
  let state = createState();
  state = pushEvent(state, "all good", "success");
  expect(state.statusMessage?.level).toBe("success");

  state = dismissStatusMessage(state);
  expect(state.statusMessage).toBeNull();
});

test("dismissStatusMessage is a no-op when no status message exists", () => {
  const state = createState();
  const next = dismissStatusMessage(state);
  expect(next).toBe(state);
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
    bookmarks: [] as readonly string[],
    workspaces: [] as readonly string[],
    graphHead: "~  ",
    graphTail: [] as readonly string[],
    marker: "elided" as const,
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
