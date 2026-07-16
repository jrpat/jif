import { expect, test } from "bun:test";
import type { AppState, OperationLogEntry, RevisionSummary } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import { getActiveMode } from "../src/modes.ts";
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
  focusGitCommandBar,
  focusShellCommandBar,
  focusLogBottom,
  focusNotificationAt,
  focusEvologEntryAt,
  focusOperationLogEntryAt,
  focusRevisionAt,
  getFocusedRevisionArg,
  getFocusedInsertArg,
  focusWorkingCopy,
  getCommandChipTextForRevision,
  getCommandTargetRowId,
  getDisplayedCommandSegments,
  getDisplayedCommandText,
  getMarkedRowIds,
  getSelectedRowIds,
  logEvent,
  openShortcutPanel,
  pushStatusMessage,
  updateStatusMessage,
  upsertStatusMessage,
  pushEvent,
  setCommandBarText,
  moveFocus,
  moveFocusToBookmark,
  moveFocusToChild,
  moveFocusToNextDivergentSibling,
  moveFocusToParent,
  moveFocusToWorkspace,
  openDiffViewer,
  openOperationLog,
  openEvolog,
  closeEvolog,
  openFocusedRevision,
  selectAllFiles,
  closeShortcutPanel,
  toggleShortcutPanel,
  setRevisionFiles,
  startCommandDraft,
  startSquashOnto,
  selectAbsorbDescendants,
  toggleFileSelection,
  getOperationAffectedRowIds,
  getFocusTone,
  getRebaseSelectionKind,
  setRebaseSourceKind,
  setRebaseTargetKind,
  toggleRebaseSelection,
  toggleRebaseSelectionKind,
  toggleRebaseSkipEmptied,
  toggleRevisionSelection,
  toggleSquashAnchor,
  expandElidedRevision,
  openRevsetInput,
  closeRevsetInput,
  openFileSearch,
  closeFileSearch,
  setRevsetQuery,
  openSearch,
  setSearchText,
  finalizeSearch,
  closeSearch,
  nextSearchMatch,
  prevSearchMatch,
  getSearchMatchIndices,
  toggleSearchIdOnly,
  getInlineConfirmation,
  openInlineConfirmation,
  selectNextInlineConfirmationOption,
  clearLastFailedCommand,
  setLastFailedCommand,
  touchStatusMessage,
  togglePreviewFullFile,
} from "../src/state/store.ts";

const FIRST_ROW_ID = createRowId("11111111", "aaaaaaaa");
const SECOND_ROW_ID = createRowId("22222222", "bbbbbbbb");
const FIRST_DIVERGENT_ROW_ID = createRowId("11111111", "abcdefgh/0");
const SECOND_DIVERGENT_ROW_ID = createRowId("22222222", "abcdefgh/1");
const BRANCH_CHILD_ROW_ID = createRowId("33333333", "cccccccc");
const BRANCH_SIDE_ROW_ID = createRowId("44444444", "dddddddd");
const BRANCH_PARENT_ROW_ID = createRowId("55555555", "eeeeeeee");
const BRANCH_BASE_ROW_ID = createRowId("66666666", "ffffffff");
const BRANCH_ROOT_ROW_ID = createRowId("77777777", "gggggggg");
const OP_LOG_ENTRIES: readonly OperationLogEntry[] = [
  {
    id: "65d964491fc0",
    lines: [
      "65d964491fc0 jrpat@host jif-3@ 9 minutes ago",
      "rebase commit 93f155d4a5345ccc3eb97e649e3ee0eab8878180 and 1 more",
      "args: jj rebase -r q -r xm -d n",
    ],
  },
  {
    id: "96df2f0afa0c",
    lines: [
      "96df2f0afa0c jrpat@host jif-3@ 9 minutes ago",
      "export git refs",
      "args: jj git export",
    ],
  },
];

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

const ABSORB_WC_ROW_ID = createRowId("a0000000", "aaaaaaaa");
const ABSORB_ANC1_ROW_ID = createRowId("b0000000", "bbbbbbbb");
const ABSORB_ANC2_ROW_ID = createRowId("c0000000", "cccccccc");
const ABSORB_SRC_ROW_ID = createRowId("d0000000", "dddddddd");

// Working copy plus three independent revisions, used to drive absorb where the
// source is the focused revision and the candidates are passed in explicitly.
function createAbsorbState(): AppState {
  const base = (
    rowId: string,
    revisionId: string,
    commitId: string,
    marker: RevisionSummary["marker"],
  ): RevisionSummary => ({
    rowId,
    revisionId,
    parentRevisionIds: [],
    changeIdPrefixLength: 1,
    commitId,
    description: revisionId,
    localTimestamp: "2026-03-30 07:22:39",
    bookmarks: [],
    workspaces: [],
    graphRows: ["○  "],
    isEmpty: false,
    hasConflict: false,
    marker,
    filesLoaded: true,
    files: [],
  });

  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      base(ABSORB_WC_ROW_ID, "aaaaaaaa", "a0000000", "working-copy"),
      base(ABSORB_ANC1_ROW_ID, "bbbbbbbb", "b0000000", "plain"),
      base(ABSORB_ANC2_ROW_ID, "cccccccc", "c0000000", "plain"),
      base(ABSORB_SRC_ROW_ID, "dddddddd", "d0000000", "plain"),
    ],
  };
}

const ABSORB_STACK_SOURCE_ROW_ID = createRowId("a1000000", "aaaaaaaa");
const ABSORB_STACK_CHILD_ROW_ID = createRowId("b1000000", "bbbbbbbb");
const ABSORB_STACK_SIDE_ROW_ID = createRowId("e1000000", "eeeeeeee");
const ABSORB_STACK_FOCUSED_ROW_ID = createRowId("c1000000", "cccccccc");
const ABSORB_STACK_BASE_ROW_ID = createRowId("d1000000", "dddddddd");

function createAbsorbDescendantState(): AppState {
  const revision = (
    rowId: string,
    revisionId: string,
    commitId: string,
    parentRevisionIds: readonly string[],
    marker: RevisionSummary["marker"] = "plain",
  ): RevisionSummary => ({
    rowId,
    revisionId,
    parentRevisionIds,
    changeIdPrefixLength: 1,
    commitId,
    description: revisionId,
    localTimestamp: "2026-03-30 07:22:39",
    bookmarks: [],
    workspaces: [],
    graphRows: ["○  "],
    isEmpty: false,
    hasConflict: false,
    marker,
    filesLoaded: true,
    files: [],
  });

  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      revision(ABSORB_STACK_SOURCE_ROW_ID, "aaaaaaaa", "a1000000", ["bbbbbbbb"], "working-copy"),
      revision(ABSORB_STACK_CHILD_ROW_ID, "bbbbbbbb", "b1000000", ["cccccccc"]),
      revision(ABSORB_STACK_SIDE_ROW_ID, "eeeeeeee", "e1000000", ["cccccccc"]),
      revision(ABSORB_STACK_FOCUSED_ROW_ID, "cccccccc", "c1000000", ["dddddddd"]),
      revision(ABSORB_STACK_BASE_ROW_ID, "dddddddd", "d1000000", []),
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

function createBranchedNavigationState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    focusedRevisionIndex: 3,
    revisions: [
      {
        rowId: BRANCH_CHILD_ROW_ID,
        revisionId: "cccccccc",
        parentRevisionIds: ["eeeeeeee"],
        changeIdPrefixLength: 1,
        commitId: "33333333",
        description: "mainline child",
        localTimestamp: "2026-03-30 07:22:39",
        bookmarks: [],
        workspaces: [],
        graphRows: ["○  ", "│  "],
        isEmpty: false,
        hasConflict: false,
        marker: "working-copy",
        filesLoaded: true,
        files: [],
      },
      {
        rowId: BRANCH_SIDE_ROW_ID,
        revisionId: "dddddddd",
        parentRevisionIds: ["eeeeeeee"],
        changeIdPrefixLength: 1,
        commitId: "44444444",
        description: "side branch",
        localTimestamp: "2026-03-30 07:22:38",
        bookmarks: [],
        workspaces: [],
        graphRows: ["│ ○  ", "├─╯  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [],
      },
      {
        rowId: BRANCH_BASE_ROW_ID,
        revisionId: "ffffffff",
        parentRevisionIds: ["eeeeeeee"],
        changeIdPrefixLength: 1,
        commitId: "66666666",
        description: "other branch",
        localTimestamp: "2026-03-30 07:22:37",
        bookmarks: [],
        workspaces: [],
        graphRows: ["│ ○  ", "├─╯  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [],
      },
      {
        rowId: BRANCH_PARENT_ROW_ID,
        revisionId: "eeeeeeee",
        parentRevisionIds: ["gggggggg"],
        changeIdPrefixLength: 1,
        commitId: "55555555",
        description: "parent",
        localTimestamp: "2026-03-30 07:22:36",
        bookmarks: [],
        workspaces: [],
        graphRows: ["○  ", "│  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [],
      },
      {
        rowId: BRANCH_ROOT_ROW_ID,
        revisionId: "gggggggg",
        parentRevisionIds: [],
        changeIdPrefixLength: 1,
        commitId: "77777777",
        description: "root",
        localTimestamp: "2026-03-30 07:22:35",
        bookmarks: [],
        workspaces: [],
        graphRows: ["○  ", "│  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [],
      },
    ],
  };
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

test("openOperationLog enters a dedicated browse mode", () => {
  const state = openOperationLog({
    ...createState(),
    operationLogEntries: OP_LOG_ENTRIES,
    focusedOperationLogIndex: 1,
  });

  expect(state.focusMode).toBe("op-log");
  expect(state.focusModeStack).toEqual(["revisions", "op-log"]);
  expect(state.focusedOperationLogIndex).toBe(1);
});

test("moveFocus navigates operation log entries without changing revision focus", () => {
  const state = moveFocus(openOperationLog({
    ...createState(),
    operationLogEntries: OP_LOG_ENTRIES,
    focusedOperationLogIndex: 0,
  }), 1);

  expect(state.focusedOperationLogIndex).toBe(1);
  expect(state.focusedRevisionIndex).toBe(0);
});

test("cancelOrBlurState exits operation log mode", () => {
  const state = cancelOrBlurState(openOperationLog({
    ...createState(),
    operationLogEntries: OP_LOG_ENTRIES,
  }));

  expect(state.focusMode).toBe("revisions");
  expect(state.focusModeStack).toEqual(["revisions"]);
});

const EVOLOG_ENTRIES: readonly OperationLogEntry[] = [
  { id: "35bf4e939772", lines: ["@  xuntkrpo dafa8495", "│  third"] },
  { id: "fbb9651ace30", lines: ["○  xuntkrpo/1 f5029c4b (hidden)", "│  second"] },
  { id: "0c0c798bfcf6", lines: ["○  xuntkrpo/2 a44bb4e6 (hidden)", "│  first"] },
];

test("openEvolog enters a dedicated browse mode", () => {
  const state = openEvolog({
    ...createState(),
    evologEntries: EVOLOG_ENTRIES,
    focusedEvologIndex: 2,
  }, "xuntkrpo third");

  expect(state.focusMode).toBe("evolog");
  expect(state.focusModeStack).toEqual(["revisions", "evolog"]);
  expect(state.evologRevisionLabel).toBe("xuntkrpo third");
  expect(state.focusedEvologIndex).toBe(0);
});

test("moveFocus navigates evolog entries without changing revision focus", () => {
  const state = moveFocus(openEvolog({
    ...createState(),
    evologEntries: EVOLOG_ENTRIES,
  }, "label"), 1);

  expect(state.focusedEvologIndex).toBe(1);
  expect(state.focusedRevisionIndex).toBe(0);
});

test("focusLogBottom jumps to the last evolog entry", () => {
  const state = focusLogBottom(openEvolog({
    ...createState(),
    evologEntries: EVOLOG_ENTRIES,
  }, "label"));

  expect(state.focusedEvologIndex).toBe(EVOLOG_ENTRIES.length - 1);
});

test("cancelOrBlurState exits evolog mode", () => {
  const state = cancelOrBlurState(openEvolog({
    ...createState(),
    evologEntries: EVOLOG_ENTRIES,
  }, "label"));

  expect(state.focusMode).toBe("revisions");
  expect(state.focusModeStack).toEqual(["revisions"]);
});

test("closeEvolog is a no-op when not in evolog mode", () => {
  const before = createState();
  const after = closeEvolog(before);
  expect(after).toBe(before);
});

test("focusEvologEntryAt sets focusedEvologIndex", () => {
  let state = { ...createState(), evologEntries: EVOLOG_ENTRIES };
  state = focusEvologEntryAt(state, 2);
  expect(state.focusedEvologIndex).toBe(2);
  state = focusEvologEntryAt(state, 99);
  expect(state.focusedEvologIndex).toBe(EVOLOG_ENTRIES.length - 1);
});

test("focusEvologEntryAt is a no-op when the evolog is empty", () => {
  const before = { ...createState(), evologEntries: [] as readonly OperationLogEntry[] };
  const after = focusEvologEntryAt(before, 1);
  expect(after).toBe(before);
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

test("moveFocusToChild focuses the first visible child revision in log order", () => {
  let state = createBranchedNavigationState();

  state = moveFocusToChild(state);

  expect(state.focusedRevisionIndex).toBe(0);

  state = moveFocusToChild(state);

  expect(state.focusedRevisionIndex).toBe(0);
  expect(state.focusMode).toBe("revisions");
});

test("moveFocusToChild exits file navigation before focusing the child revision", () => {
  let state = createBranchedNavigationState();
  state = openFocusedRevision(state);

  state = moveFocusToChild(state);

  expect(state.focusMode).toBe("revisions");
  expect(state.expandedRowId).toBeNull();
  expect(state.focusedRevisionIndex).toBe(0);
  expect(state.focusedFileIndex).toBe(0);
});

test("moveFocusToNextDivergentSibling jumps to the next visible divergent sibling", () => {
  let state = createDivergentState();
  expect(state.focusedRevisionIndex).toBe(0);

  state = moveFocusToNextDivergentSibling(state);

  expect(state.focusedRevisionIndex).toBe(1);
});

test("moveFocusToNextDivergentSibling wraps from the last visible sibling to the first", () => {
  let state = createDivergentState();
  state = focusRevisionAt(state, 1);

  state = moveFocusToNextDivergentSibling(state);

  expect(state.focusedRevisionIndex).toBe(0);
});

test("moveFocusToNextDivergentSibling is a no-op when the focused revision is not divergent", () => {
  const state = createState();
  const after = moveFocusToNextDivergentSibling(state);
  expect(after).toBe(state);
});

test("moveFocusToNextDivergentSibling is a no-op when no other divergent sibling is visible", () => {
  const baseState = createDivergentState();
  const trimmedState: AppState = {
    ...baseState,
    revisions: [baseState.revisions[0]!],
    focusedRevisionIndex: 0,
  };

  const after = moveFocusToNextDivergentSibling(trimmedState);
  expect(after).toBe(trimmedState);
});

test("moveFocusToNextDivergentSibling exits file navigation when jumping", () => {
  let state = createDivergentState();
  state = openFocusedRevision(state);
  expect(state.focusMode).toBe("files");

  state = moveFocusToNextDivergentSibling(state);

  expect(state.focusMode).toBe("revisions");
  expect(state.expandedRowId).toBeNull();
  expect(state.focusedRevisionIndex).toBe(1);
  expect(state.focusedFileIndex).toBe(0);
});

function createWorkspaceNavigationState(): AppState {
  const revision = (
    index: number,
    workspaces: readonly string[],
    marker: RevisionSummary["marker"] = "plain",
  ): RevisionSummary => ({
    rowId: `ws-row-${index}`,
    revisionId: `wsrev${index}`,
    parentRevisionIds: [],
    changeIdPrefixLength: 1,
    commitId: `${index}${index}${index}${index}${index}${index}${index}${index}`,
    description: `revision ${index}`,
    localTimestamp: "2026-03-30 07:22:39",
    bookmarks: [],
    workspaces,
    graphRows: ["○  "],
    isEmpty: false,
    hasConflict: false,
    marker,
    filesLoaded: true,
    files: [{ status: "M", path: `src/${index}.ts` }],
  });

  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    focusedRevisionIndex: 0,
    revisions: [
      { ...revision(0, []), marker: "working-copy", graphRows: ["@  "] },
      revision(1, ["alpha"]),
      revision(2, []),
      revision(3, ["beta"]),
      revision(4, []),
    ],
  };
}

test("moveFocusToWorkspace jumps forward to the next visible revision with a workspace", () => {
  let state = createWorkspaceNavigationState();

  state = moveFocusToWorkspace(state, 1);
  expect(state.focusedRevisionIndex).toBe(1);

  state = moveFocusToWorkspace(state, 1);
  expect(state.focusedRevisionIndex).toBe(3);
});

test("moveFocusToWorkspace does not wrap past the last workspace revision", () => {
  let state = createWorkspaceNavigationState();
  state = focusRevisionAt(state, 3);

  const after = moveFocusToWorkspace(state, 1);

  expect(after).toBe(state);
  expect(after.focusedRevisionIndex).toBe(3);
});

test("moveFocusToWorkspace jumps backward, then falls back to the working copy", () => {
  let state = createWorkspaceNavigationState();
  state = focusRevisionAt(state, 4);

  state = moveFocusToWorkspace(state, -1);
  expect(state.focusedRevisionIndex).toBe(3);

  state = moveFocusToWorkspace(state, -1);
  expect(state.focusedRevisionIndex).toBe(1);

  const beforeRequest = state.revisionScrollRequest;
  const after = moveFocusToWorkspace(state, -1);
  expect(after.focusedRevisionIndex).toBe(0);
  expect(after.revisionScrollRequest).toBe(beforeRequest + 1);
});

test("moveFocusToWorkspace skips elided revisions even if they carry a workspace", () => {
  const base = createWorkspaceNavigationState();
  const state: AppState = {
    ...base,
    focusedRevisionIndex: 0,
    revisions: [
      base.revisions[0]!,
      { ...base.revisions[1]!, marker: "elided", workspaces: ["hidden"] },
      base.revisions[2]!,
      base.revisions[3]!,
      base.revisions[4]!,
    ],
  };

  const after = moveFocusToWorkspace(state, 1);

  expect(after.focusedRevisionIndex).toBe(3);
});

test("moveFocusToWorkspace exits file navigation when jumping", () => {
  let state = createWorkspaceNavigationState();
  state = openFocusedRevision(state);
  expect(state.focusMode).toBe("files");

  state = moveFocusToWorkspace(state, 1);

  expect(state.focusMode).toBe("revisions");
  expect(state.expandedRowId).toBeNull();
  expect(state.focusedRevisionIndex).toBe(1);
  expect(state.focusedFileIndex).toBe(0);
});

function createBookmarkNavigationState(): AppState {
  const revision = (
    index: number,
    bookmarks: readonly string[],
    marker: RevisionSummary["marker"] = "plain",
  ): RevisionSummary => ({
    rowId: `bm-row-${index}`,
    revisionId: `bmrev${index}`,
    parentRevisionIds: [],
    changeIdPrefixLength: 1,
    commitId: `${index}${index}${index}${index}${index}${index}${index}${index}`,
    description: `revision ${index}`,
    localTimestamp: "2026-03-30 07:22:39",
    bookmarks,
    workspaces: [],
    graphRows: ["○  "],
    isEmpty: false,
    hasConflict: false,
    marker,
    filesLoaded: true,
    files: [{ status: "M", path: `src/${index}.ts` }],
  });

  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    focusedRevisionIndex: 0,
    revisions: [
      { ...revision(0, []), marker: "working-copy", graphRows: ["@  "] },
      revision(1, ["alpha"]),
      revision(2, []),
      revision(3, ["beta"]),
      revision(4, []),
    ],
  };
}

test("moveFocusToBookmark jumps forward to the next visible revision with a bookmark", () => {
  let state = createBookmarkNavigationState();

  state = moveFocusToBookmark(state, 1);
  expect(state.focusedRevisionIndex).toBe(1);

  state = moveFocusToBookmark(state, 1);
  expect(state.focusedRevisionIndex).toBe(3);
});

test("moveFocusToBookmark does not wrap past the last bookmark revision", () => {
  let state = createBookmarkNavigationState();
  state = focusRevisionAt(state, 3);

  const after = moveFocusToBookmark(state, 1);

  expect(after).toBe(state);
  expect(after.focusedRevisionIndex).toBe(3);
});

test("moveFocusToBookmark jumps backward, then falls back to the working copy", () => {
  let state = createBookmarkNavigationState();
  state = focusRevisionAt(state, 4);

  state = moveFocusToBookmark(state, -1);
  expect(state.focusedRevisionIndex).toBe(3);

  state = moveFocusToBookmark(state, -1);
  expect(state.focusedRevisionIndex).toBe(1);

  const beforeRequest = state.revisionScrollRequest;
  const after = moveFocusToBookmark(state, -1);
  expect(after.focusedRevisionIndex).toBe(0);
  expect(after.revisionScrollRequest).toBe(beforeRequest + 1);
});

test("moveFocusToBookmark skips elided revisions even if they carry a bookmark", () => {
  const base = createBookmarkNavigationState();
  const state: AppState = {
    ...base,
    focusedRevisionIndex: 0,
    revisions: [
      base.revisions[0]!,
      { ...base.revisions[1]!, marker: "elided", bookmarks: ["hidden"] },
      base.revisions[2]!,
      base.revisions[3]!,
      base.revisions[4]!,
    ],
  };

  const after = moveFocusToBookmark(state, 1);

  expect(after.focusedRevisionIndex).toBe(3);
});

test("moveFocusToBookmark exits file navigation when jumping", () => {
  let state = createBookmarkNavigationState();
  state = openFocusedRevision(state);
  expect(state.focusMode).toBe("files");

  state = moveFocusToBookmark(state, 1);

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

test("git command bar prefills `git ` in compose mode for fast git subcommands", () => {
  let state = createState();
  state = focusGitCommandBar(state);

  expect(state.focusMode).toBe("command");
  expect(state.commandBar.kind).toBe("jj");
  expect(state.commandBar.manual).toBe(true);
  // The cursor lands at the end of the prefill (after the trailing space), so
  // the displayed command reads `jj git |`.
  expect(getDisplayedCommandText(state)).toBe("git ");
  expect(state.commandBar.startInCompose).toBe(true);
});

test("shell command bar starts empty and preserves raw shell text", () => {
  let state = createState();
  state = focusShellCommandBar(state);

  expect(state.focusMode).toBe("command");
  expect(state.commandBar.kind).toBe("shell");
  expect(getDisplayedCommandText(state)).toBe("");

  state = setCommandBarText(state, "jj status | cat");
  expect(state.commandBar.kind).toBe("shell");
  expect(getDisplayedCommandText(state)).toBe("jj status | cat");
});

test("cancelCommandState returns to file navigation when a revision is expanded", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = focusCommandBar(state);

  state = cancelCommandState(state);

  expect(state.focusMode).toBe("files");
  expect(state.expandedRowId).toBe(FIRST_ROW_ID);
});

test("mode transitions keep a stack so overlays can return to their parent mode", () => {
  let state = createState();

  expect(state.focusModeStack).toEqual(["revisions"]);

  state = openFocusedRevision(state);
  expect(state.focusModeStack).toEqual(["revisions", "files"]);

  state = openRevsetInput(state);
  expect(state.focusModeStack).toEqual(["revisions", "files", "revset"]);

  state = cancelOrBlurState(state);
  expect(state.focusMode).toBe("files");
  expect(state.focusModeStack).toEqual(["revisions", "files"]);
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

test("cancelOrBlurState pops the active mode before dismissing error status messages", () => {
  let state = createState();
  state = pushEvent(state, "command failed", "error");
  state = focusCommandBar(state);

  state = cancelOrBlurState(state);

  expect(state.focusMode).toBe("revisions");
  expect(state.statusMessages).toHaveLength(1);
  expect(state.statusMessages[0]?.level).toBe("error");
});

test("cancelOrBlurState dismisses a success toast (e.g. the preview-position toast)", () => {
  let state = createState();
  state = upsertStatusMessage(state, "preview-position", "Preview position: right", "success");

  state = cancelOrBlurState(state);

  expect(state.statusMessages).toHaveLength(0);
});

test("startCommandDraft advances focus to parent revision", () => {
  let state = createState();
  expect(state.focusedRevisionIndex).toBe(0);
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] });
  expect(state.focusedRevisionIndex).toBe(1);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");
});

test("startCommandDraft keeps the implicit source out of manual selection", () => {
  let state = createState();

  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });

  expect(getMarkedRowIds(state).size).toBe(0);
  expect(getSelectedRowIds(state).has(FIRST_ROW_ID)).toBeTrue();
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

  state = setRebaseSourceKind(state, "source", ["aaaaaaaa", "bbbbbbbb"]);
  expect(getDisplayedCommandText(state)).toBe("rebase -s a -d b");

  state = setRebaseSourceKind(state, "source", ["aaaaaaaa", "bbbbbbbb"]);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");
});

test("rebase command text uses -b when source kind is branch", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");

  state = setRebaseSourceKind(state, "branch");
  expect(getDisplayedCommandText(state)).toBe("rebase -b a -d b");

  state = setRebaseSourceKind(state, "branch");
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");
});

test("rebase target kind toggles between -d, --insert-before, and --insert-after", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");

  state = setRebaseTargetKind(state, "insert-before");
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -B b");

  state = setRebaseTargetKind(state, "insert-before");
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");

  state = setRebaseTargetKind(state, "insert-after");
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -A b");

  state = setRebaseTargetKind(state, "insert-after");
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");
});

test("rebase insert-between pins the focused row as --insert-after", () => {
  const THIRD_ROW_ID = createRowId("33333333", "cccccccc");
  let state = createState();
  state = {
    ...state,
    revisions: [
      ...state.revisions,
      {
        rowId: THIRD_ROW_ID,
        revisionId: "cccccccc",
        parentRevisionIds: [],
        changeIdPrefixLength: 1,
        commitId: "33333333",
        description: "third",
        localTimestamp: "2026-03-30 07:22:41",
        bookmarks: [],
        workspaces: [],
        graphRows: ["○  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [],
      },
    ],
  };
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");

  state = setRebaseTargetKind(state, "insert-between");
  state = moveFocus(state, 1);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -A b -B c");

  state = setRebaseTargetKind(state, "insert-between");
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d c");
});

test("rebase --skip-emptied toggle appends and removes the flag", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");

  state = toggleRebaseSkipEmptied(state);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b --skip-emptied");

  state = toggleRebaseSkipEmptied(state);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");
});

test("rebase force-apply override appends --ignore-immutable without mutating draft", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });

  expect(getDisplayedCommandText(state, { forceApply: true })).toBe(
    "rebase -r a -d b --ignore-immutable",
  );
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");
});

// Three-revision variant of createState for exercising multiple rebase
// targets: a (@, focused) → b → c, all in one column.
function createThreeRevisionState(): AppState {
  const base = createState();
  return {
    ...base,
    revisions: [
      ...base.revisions,
      {
        rowId: createRowId("33333333", "cccccccc"),
        revisionId: "cccccccc",
        parentRevisionIds: [],
        changeIdPrefixLength: 1,
        commitId: "33333333",
        description: "third",
        localTimestamp: "2026-03-30 07:22:41",
        bookmarks: [],
        workspaces: [],
        graphRows: ["○  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [],
      },
    ],
  };
}

test("rebase space selection defaults to subjects with -r and targets with -s/-b", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(getRebaseSelectionKind(state)).toBe("subject");

  state = setRebaseSourceKind(state, "source", ["aaaaaaaa"]);
  expect(getRebaseSelectionKind(state)).toBe("target");

  state = setRebaseSourceKind(state, "source", ["aaaaaaaa"]);
  expect(getRebaseSelectionKind(state)).toBe("subject");

  state = setRebaseSourceKind(state, "branch");
  expect(getRebaseSelectionKind(state)).toBe("target");
});

test("getRebaseSelectionKind is null outside a rebase draft", () => {
  expect(getRebaseSelectionKind(createState())).toBeNull();

  const duplicated = startCommandDraft(createState(), draftConfigs.duplicate);
  expect(getRebaseSelectionKind(duplicated)).toBeNull();
  expect(toggleRebaseSelectionKind(duplicated)).toBe(duplicated);
});

test("toggleRebaseSelectionKind flips the kind and source-kind changes reset the override", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });

  state = toggleRebaseSelectionKind(state);
  expect(getRebaseSelectionKind(state)).toBe("target");
  state = toggleRebaseSelectionKind(state);
  expect(getRebaseSelectionKind(state)).toBe("subject");

  // An explicit override does not survive a source-kind change: the
  // per-source-kind default applies again.
  state = toggleRebaseSelectionKind(state);
  state = setRebaseSourceKind(state, "branch");
  expect(getRebaseSelectionKind(state)).toBe("target");

  state = toggleRebaseSelectionKind(state);
  expect(getRebaseSelectionKind(state)).toBe("subject");
  state = setRebaseSourceKind(state, "branch");
  expect(getRebaseSelectionKind(state)).toBe("subject");
});

test("toggleRebaseSelection adds subjects while the selection kind is subject", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");

  state = toggleRebaseSelection(state);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -r b -d ░░░░");
});

test("toggleRebaseSelection pins additional destinations in target mode", () => {
  let state = createThreeRevisionState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");

  state = toggleRebaseSelectionKind(state);
  state = toggleRebaseSelection(state);
  // Pinning b disables the cursor-following default; the cursor advanced to c
  // but c is not a target until it is pinned too.
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");

  state = toggleRebaseSelection(state);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b -d c");
});

test("unpinning every rebase target restores the cursor-following destination", () => {
  let state = createThreeRevisionState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });
  state = toggleRebaseSelectionKind(state);
  state = toggleRebaseSelection(state);
  state = toggleRebaseSelection(state);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b -d c");

  // Unpin c (focus holds on unpin), then move up and unpin b.
  state = toggleRebaseSelection(state);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");
  state = moveFocus(state, -1);
  state = toggleRebaseSelection(state);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b");

  state = moveFocus(state, 1);
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d c");
});

test("pinned rebase targets keep chips that follow the target kind", () => {
  let state = createThreeRevisionState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });
  state = toggleRebaseSelectionKind(state);
  state = toggleRebaseSelection(state);

  expect(getCommandChipTextForRevision(state, SECOND_ROW_ID)).toBe("onto");
  expect(getCommandTargetRowId(state)).toBeNull();

  state = setRebaseTargetKind(state, "insert-before");
  expect(getCommandChipTextForRevision(state, SECOND_ROW_ID)).toBe("before");

  state = setRebaseTargetKind(state, "insert-after");
  expect(getCommandChipTextForRevision(state, SECOND_ROW_ID)).toBe("after");
});

test("rebase target picking skips subjects and subject selection skips pinned targets", () => {
  let state = createThreeRevisionState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });
  state = toggleRebaseSelectionKind(state);

  // The focused subject cannot become a target.
  state = moveFocus(state, -1);
  const beforeSubjectPick = state;
  state = toggleRebaseSelection(state);
  expect(state).toBe(beforeSubjectPick);

  // Pin b as a target, then a subject toggle on it must not select it.
  state = moveFocus(state, 1);
  state = toggleRebaseSelection(state);
  state = toggleRebaseSelectionKind(state);
  state = moveFocus(state, -1);
  const beforeTargetSelect = state;
  state = toggleRebaseSelection(state);
  expect(state).toBe(beforeTargetSelect);
  expect(state.selectedRowIds).toEqual([FIRST_ROW_ID]);
});

test("pinned targets compose with -s defaults and insert-before/insert-after flags", () => {
  let state = createThreeRevisionState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  state = setRebaseSourceKind(state, "source", ["aaaaaaaa"]);

  // Descendants mode defaults the spacebar to picking targets.
  state = toggleRebaseSelection(state);
  state = toggleRebaseSelection(state);
  expect(getDisplayedCommandText(state)).toBe("rebase -s a -d b -d c");

  state = setRebaseTargetKind(state, "insert-before");
  expect(getDisplayedCommandText(state)).toBe("rebase -s a -B b -B c");

  state = setRebaseTargetKind(state, "insert-after");
  expect(getDisplayedCommandText(state)).toBe("rebase -s a -A b -A c");
});

test("getFocusTone is browse without a draft and draft for non-rebase drafts", () => {
  expect(getFocusTone(createState())).toBe("browse");
  expect(getFocusTone(startCommandDraft(createState(), draftConfigs.squash))).toBe("draft");
  expect(getFocusTone(startCommandDraft(createState(), draftConfigs.duplicate))).toBe("draft");
});

test("getFocusTone stays draft while rebase space selects subjects and is target when it pins targets", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(getFocusTone(state)).toBe("draft");

  state = toggleRebaseSelectionKind(state);
  expect(getFocusTone(state)).toBe("target");
  state = toggleRebaseSelectionKind(state);
  expect(getFocusTone(state)).toBe("draft");

  state = setRebaseSourceKind(state, "source", ["aaaaaaaa"]);
  expect(getFocusTone(state)).toBe("target");
});

test("restore composes -f / -t and advances focus to the next revision", () => {
  let state = createState();
  expect(state.focusedRevisionIndex).toBe(0);

  state = startCommandDraft(state, draftConfigs.restore);

  expect(state.focusedRevisionIndex).toBe(1);
  expect(getDisplayedCommandText(state)).toBe("restore -f a -t b");
});

test("absorb preselects the source's ancestor candidates and enters absorb mode", () => {
  let state = createAbsorbState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb", "cccccccc"],
    absorbSourceRevisionId: "aaaaaaaa",
  });

  expect(getActiveMode(state)).toBe("absorb");
  expect(state.selectedRowIds).toEqual([ABSORB_ANC1_ROW_ID, ABSORB_ANC2_ROW_ID]);
  // Candidates are marked so a single space removes them rather than promoting.
  expect(state.markedRowIds).toEqual([ABSORB_ANC1_ROW_ID, ABSORB_ANC2_ROW_ID]);
  // Focus is not advanced when entering absorb.
  expect(state.focusedRevisionIndex).toBe(0);
});

test("absorb chips each candidate and marks the source revision", () => {
  let state = createAbsorbState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb", "cccccccc"],
    absorbSourceRevisionId: "aaaaaaaa",
  });

  expect(getCommandChipTextForRevision(state, ABSORB_ANC1_ROW_ID)).toBe("into");
  expect(getCommandChipTextForRevision(state, ABSORB_ANC2_ROW_ID)).toBe("into");
  expect(getCommandChipTextForRevision(state, ABSORB_WC_ROW_ID)).toBe("absorb");
  expect(getCommandTargetRowId(state)).toBe(ABSORB_WC_ROW_ID);
});

test("absorb runs plain absorb from the working copy while the set is unchanged", () => {
  let state = createAbsorbState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb", "cccccccc"],
    absorbSourceRevisionId: "aaaaaaaa",
  });

  expect(getDisplayedCommandText(state)).toBe("absorb");
});

test("absorb constrains to selected targets once the set changes", () => {
  let state = createAbsorbState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb", "cccccccc"],
    absorbSourceRevisionId: "aaaaaaaa",
  });

  // Deselect the second candidate (cccccccc), leaving only the first.
  state = focusRevisionAt(state, 2);
  state = toggleRevisionSelection(state);

  expect(state.selectedRowIds).toEqual([ABSORB_ANC1_ROW_ID]);
  // The still-selected candidate keeps its "into" chip; the deselected default
  // keeps a muted "default" reminder instead of disappearing.
  expect(getCommandChipTextForRevision(state, ABSORB_ANC1_ROW_ID)).toBe("into");
  expect(getCommandChipTextForRevision(state, ABSORB_ANC2_ROW_ID)).toBe("default");
  expect(getDisplayedCommandText(state)).toBe("absorb -t b");
});

test("absorb drops the chip entirely for a non-default revision", () => {
  let state = createAbsorbState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb"],
    absorbSourceRevisionId: "aaaaaaaa",
  });

  // cccccccc was never a default candidate, so it shows no chip at all.
  expect(getCommandChipTextForRevision(state, ABSORB_ANC2_ROW_ID)).toBeNull();
});

test("absorb returns to plain absorb when the original set is restored", () => {
  let state = createAbsorbState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb", "cccccccc"],
    absorbSourceRevisionId: "aaaaaaaa",
  });

  state = focusRevisionAt(state, 2);
  state = toggleRevisionSelection(state);
  expect(getDisplayedCommandText(state)).toBe("absorb -t b");

  // Re-select it: the set matches the default again regardless of order.
  state = focusRevisionAt(state, 2);
  state = toggleRevisionSelection(state);
  expect(getDisplayedCommandText(state)).toBe("absorb");
});

test("absorb falls back to plain absorb when every target is deselected", () => {
  let state = createAbsorbState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb"],
    absorbSourceRevisionId: "aaaaaaaa",
  });

  state = focusRevisionAt(state, 1);
  state = toggleRevisionSelection(state);

  expect(state.selectedRowIds).toEqual([]);
  expect(getDisplayedCommandText(state)).toBe("absorb");
});

test("absorb emits --from when the source is not the working copy", () => {
  let state = createAbsorbState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb", "cccccccc"],
    absorbSourceRevisionId: "dddddddd",
  });

  // Unchanged set: explicit --from, no --into.
  expect(getDisplayedCommandText(state)).toBe("absorb -f d");

  // Constrain the set: --from stays, --into is added.
  state = focusRevisionAt(state, 2);
  state = toggleRevisionSelection(state);
  expect(getDisplayedCommandText(state)).toBe("absorb -f d -t b");
});

test("absorb advances focus after toggling a target in either direction", () => {
  let state = createAbsorbState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb", "cccccccc"],
    absorbSourceRevisionId: "aaaaaaaa",
  });

  // Excluding a preselected default advances focus, like selecting in normal mode.
  state = focusRevisionAt(state, 1);
  state = toggleRevisionSelection(state);
  expect(state.selectedRowIds).toEqual([ABSORB_ANC2_ROW_ID]);
  expect(state.focusedRevisionIndex).toBe(2);

  // Re-including the deselected default also advances focus.
  state = focusRevisionAt(state, 1);
  state = toggleRevisionSelection(state);
  expect(state.selectedRowIds).toEqual([ABSORB_ANC2_ROW_ID, ABSORB_ANC1_ROW_ID]);
  expect(state.focusedRevisionIndex).toBe(2);
});

test("absorb descendant selection replaces targets with the focused-to-source chain", () => {
  let state = createAbsorbDescendantState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb", "cccccccc", "dddddddd"],
    absorbSourceRevisionId: "aaaaaaaa",
  });

  state = focusRevisionAt(state, 3);
  state = selectAbsorbDescendants(state);

  expect(state.selectedRowIds).toEqual([
    ABSORB_STACK_CHILD_ROW_ID,
    ABSORB_STACK_FOCUSED_ROW_ID,
  ]);
  expect(state.markedRowIds).toEqual([
    ABSORB_STACK_CHILD_ROW_ID,
    ABSORB_STACK_FOCUSED_ROW_ID,
  ]);
  expect(state.selectedRowIds).not.toContain(ABSORB_STACK_SOURCE_ROW_ID);
  expect(state.selectedRowIds).not.toContain(ABSORB_STACK_SIDE_ROW_ID);
  expect(getDisplayedCommandText(state)).toBe("absorb -t b|c");
});

test("absorb descendant selection clears targets when focus is off the source path", () => {
  let state = createAbsorbDescendantState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb", "cccccccc", "dddddddd"],
    absorbSourceRevisionId: "aaaaaaaa",
  });

  state = focusRevisionAt(state, 2);
  state = selectAbsorbDescendants(state);

  expect(state.selectedRowIds).toEqual([]);
  expect(state.markedRowIds).toEqual([]);
  expect(getDisplayedCommandText(state)).toBe("absorb");
});

test("absorb descendant selection is a no-op when the source is no longer visible", () => {
  let state = createAbsorbDescendantState();
  state = startCommandDraft(state, draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb", "cccccccc"],
    absorbSourceRevisionId: "aaaaaaaa",
  });
  state = {
    ...state,
    revisions: state.revisions.filter((revision) => revision.rowId !== ABSORB_STACK_SOURCE_ROW_ID),
  };

  const next = selectAbsorbDescendants(state);

  expect(next.selectedRowIds).toEqual([
    ABSORB_STACK_CHILD_ROW_ID,
    ABSORB_STACK_FOCUSED_ROW_ID,
  ]);
  expect(next.markedRowIds).toEqual([
    ABSORB_STACK_CHILD_ROW_ID,
    ABSORB_STACK_FOCUSED_ROW_ID,
  ]);
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

test("upsertStatusMessage replaces a same-id toast in place, preserving others", () => {
  let state = createState();
  state = pushEvent(state, "other", "success", 10);
  state = upsertStatusMessage(state, "preview-position", "Preview position: right", "info");
  state = upsertStatusMessage(state, "preview-position", "Preview position: below", "info");

  // One toast per id: the repeated upsert refreshes rather than stacks, and the
  // unrelated message is left untouched.
  expect(state.statusMessages.map((message) => message.text)).toEqual([
    "other",
    "Preview position: below",
  ]);
  // A transient toast, not an event: nothing is recorded to history.
  expect(state.eventLog).toHaveLength(1);
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

test("updateStatusMessage can promote a toast to the help variant", () => {
  let state = createState();
  state = pushStatusMessage(state, "toast-1", "running help", "info");
  state = updateStatusMessage(state, "toast-1", "Usage: jj", "success", "help");

  expect(state.statusMessages[0]?.variant).toBe("help");
});

test("showing a new status toast dismisses a visible help toast", () => {
  let state = createState();
  state = pushStatusMessage(state, "help-toast", "running help", "info");
  state = updateStatusMessage(state, "help-toast", "Usage: jj", "success", "help");

  state = pushStatusMessage(state, "toast-2", "running command", "info");

  expect(state.statusMessages.map((message) => message.id)).toEqual(["toast-2"]);
  expect(state.statusMessages.some((message) => message.variant === "help")).toBeFalse();
});

test("pushing an event dismisses a visible help toast", () => {
  let state = createState();
  state = pushStatusMessage(state, "help-toast", "running help", "info");
  state = updateStatusMessage(state, "help-toast", "Usage: jj", "success", "help");

  state = pushEvent(state, "command failed", "error");

  expect(state.statusMessages.map((message) => message.text)).toEqual(["command failed"]);
});

test("getActiveMode stays in the underlying browse mode while a help toast is visible", () => {
  let state = createState();
  state = pushStatusMessage(state, "toast-1", "running help", "info");
  state = updateStatusMessage(state, "toast-1", "Usage: jj", "success", "help");

  // A help toast is no longer its own mode; the underlying surface keeps the
  // keyboard, so j/k navigate the log instead of scrolling the toast.
  expect(getActiveMode(state)).toBe("normal");

  const layered: AppState = { ...state, focusMode: "notifications" };
  expect(getActiveMode(layered)).toBe("notifications");
});

test("a new toast leaves non-help toasts in place", () => {
  let state = createState();
  state = pushStatusMessage(state, "toast-1", "first", "error");
  state = pushStatusMessage(state, "toast-2", "second", "info");

  expect(state.statusMessages.map((message) => message.id)).toEqual(["toast-1", "toast-2"]);
});

test("touchStatusMessage updates the interaction timestamp without changing text", () => {
  let state = createState();
  state = pushStatusMessage(state, "toast-1", "done", "success");
  const originalMessage = state.statusMessages[0]!;

  state = touchStatusMessage(state, "toast-1", originalMessage.lastInteractedAt + 1000);

  expect(state.statusMessages[0]?.text).toBe("done");
  expect(state.statusMessages[0]?.createdAt).toBe(originalMessage.createdAt);
  expect(state.statusMessages[0]?.lastInteractedAt).toBe(originalMessage.lastInteractedAt + 1000);
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

test("pushEvent keeps at most notificationHistoryLimit entries in the event log", () => {
  let state = createState();
  const limit = state.notificationHistoryLimit;
  const overshoot = 5;
  for (let i = 0; i < limit + overshoot; i++) {
    state = pushEvent(state, `event ${i}`, "info", i);
  }
  expect(state.eventLog.length).toBe(limit);
  expect(state.eventLog[0]?.text).toBe(`event ${overshoot}`);
  expect(state.eventLog[limit - 1]?.text).toBe(`event ${limit + overshoot - 1}`);
});

test("setLastFailedCommand stores retry metadata independently of status messages", () => {
  let state = createState();
  state = pushEvent(state, "command failed", "error");

  state = setLastFailedCommand(state, {
    commandText: "bookmark set main -r main-",
    commandArgs: ["bookmark", "set", "main", "-r", "main-"],
    interactive: false,
    errorText: "Error: Refusing to move bookmark backwards or sideways: main",
    stderr: "Error: Refusing to move bookmark backwards or sideways: main\nHint: Use --allow-backwards to allow it.",
  });

  expect(state.lastFailedCommand?.commandText).toBe("bookmark set main -r main-");
  expect(state.statusMessages).toHaveLength(1);
});

test("clearLastFailedCommand resets stored retry metadata", () => {
  let state = createState();

  state = setLastFailedCommand(state, {
    commandText: "describe -r @- -m changed",
    commandArgs: ["describe", "-r", "@-", "-m", "changed"],
    interactive: false,
    errorText: "Error: Commit @- is immutable",
    stderr: "Error: Commit @- is immutable\nHint: Use --ignore-immutable to allow it.",
  });
  state = clearLastFailedCommand(state);

  expect(state.lastFailedCommand).toBeNull();
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
  expect(state.focusedRevisionIndex).toBe(0);

  state = toggleRevisionSelection(state);
  expect(state.selectedRowIds).toEqual([FIRST_ROW_ID]);
  expect(state.focusedRevisionIndex).toBe(1);

  state = toggleRevisionSelection(state);
  expect(state.selectedRowIds).toEqual([FIRST_ROW_ID, SECOND_ROW_ID]);
  expect(state.focusedRevisionIndex).toBe(1);

  state = toggleRevisionSelection(state);
  expect(state.selectedRowIds).toEqual([FIRST_ROW_ID]);
  expect(state.focusedRevisionIndex).toBe(1);
});

test("toggleFileSelection adds and removes file paths", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = setRevisionFiles(state, FIRST_ROW_ID, [
    { status: "M", path: "src/a.ts" },
    { status: "A", path: "src/b.ts" },
  ]);
  expect(state.selectedFilePaths).toEqual([]);
  expect(state.focusedFileIndex).toBe(0);

  state = toggleFileSelection(state);
  expect(state.selectedFilePaths).toEqual(["src/a.ts"]);
  expect(state.focusedFileIndex).toBe(1);

  state = toggleFileSelection(state);
  expect(state.selectedFilePaths).toEqual(["src/a.ts", "src/b.ts"]);
  expect(state.focusedFileIndex).toBe(1);

  state = toggleFileSelection(state);
  expect(state.selectedFilePaths).toEqual(["src/a.ts"]);
  expect(state.focusedFileIndex).toBe(1);
});

test("selectAllFiles selects every file, then clears when all are selected", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = setRevisionFiles(state, FIRST_ROW_ID, [
    { status: "M", path: "src/a.ts" },
    { status: "A", path: "src/b.ts" },
  ]);

  state = selectAllFiles(state);
  expect(state.selectedFilePaths).toEqual(["src/a.ts", "src/b.ts"]);

  // A second press clears the selection
  state = selectAllFiles(state);
  expect(state.selectedFilePaths).toEqual([]);
});

test("selectAllFiles is a no-op outside files mode", () => {
  const state = createState();
  expect(state.focusMode).not.toBe("files");
  expect(selectAllFiles(state)).toBe(state);
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
  const beforeRequest = state.revisionScrollRequest;

  state = focusWorkingCopy(state);
  expect(state.focusedRevisionIndex).toBe(0);
  expect(state.focusedFileIndex).toBe(0);
  expect(state.revisionScrollRequest).toBe(beforeRequest + 1);
});

test("focusWorkingCopy requests visibility when working copy is already focused", () => {
  let state = createState();
  const beforeRequest = state.revisionScrollRequest;

  state = focusWorkingCopy(state);

  expect(state.focusedRevisionIndex).toBe(0);
  expect(state.revisionScrollRequest).toBe(beforeRequest + 1);
});

test("focusWorkingCopy is a no-op when no working copy exists", () => {
  let state = createState();
  state = {
    ...state,
    revisions: state.revisions.map((r) => ({ ...r, marker: "plain" as const })),
  };
  state = moveFocus(state, 1);
  const before = state.focusedRevisionIndex;
  const beforeRequest = state.revisionScrollRequest;

  state = focusWorkingCopy(state);
  expect(state.focusedRevisionIndex).toBe(before);
  expect(state.revisionScrollRequest).toBe(beforeRequest);
});

test("focusRevisionAt sets focusedRevisionIndex when index changes", () => {
  let state = createState();
  expect(state.focusedRevisionIndex).toBe(0);

  state = focusRevisionAt(state, 1);
  expect(state.focusedRevisionIndex).toBe(1);
  expect(state.focusedFileIndex).toBe(0);
});

test("focusRevisionAt collapses another expanded revision", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = toggleFileSelection(state);
  expect(state.focusMode).toBe("files");
  expect(state.expandedRowId).toBe(FIRST_ROW_ID);
  expect(state.selectedFilePaths).toEqual(["src/a.ts"]);

  state = focusRevisionAt(state, 1);

  expect(state.focusedRevisionIndex).toBe(1);
  expect(state.focusMode).toBe("revisions");
  expect(state.focusModeStack).toEqual(["revisions"]);
  expect(state.expandedRowId).toBeNull();
  expect(state.focusedFileIndex).toBe(0);
  expect(state.selectedFilePaths).toEqual([]);
});

test("focusRevisionAt clamps out-of-range indexes", () => {
  let state = createState();

  state = focusRevisionAt(state, 99);
  expect(state.focusedRevisionIndex).toBe(state.revisions.length - 1);

  state = focusRevisionAt(state, -5);
  expect(state.focusedRevisionIndex).toBe(0);
});

test("focusRevisionAt is a no-op when there are no revisions", () => {
  const state = { ...createState(), revisions: [] };
  expect(focusRevisionAt(state, 0)).toEqual(state);
});

test("focusOperationLogEntryAt sets focusedOperationLogIndex", () => {
  let state = { ...createState(), operationLogEntries: OP_LOG_ENTRIES };

  state = focusOperationLogEntryAt(state, 1);
  expect(state.focusedOperationLogIndex).toBe(1);

  state = focusOperationLogEntryAt(state, 99);
  expect(state.focusedOperationLogIndex).toBe(OP_LOG_ENTRIES.length - 1);
});

test("focusOperationLogEntryAt is a no-op when the operation log is empty", () => {
  const state = createState();
  expect(focusOperationLogEntryAt(state, 0)).toEqual(state);
});

test("focusNotificationAt sets focusedNotificationIndex", () => {
  let state = createState();
  state = pushEvent(state, "first", "info");
  state = pushEvent(state, "second", "info");
  state = pushEvent(state, "third", "info");

  state = focusNotificationAt(state, 2);
  expect(state.focusedNotificationIndex).toBe(2);

  state = focusNotificationAt(state, 99);
  expect(state.focusedNotificationIndex).toBe(state.eventLog.length - 1);
});

test("focusNotificationAt is a no-op when the event log is empty", () => {
  const state = createState();
  expect(focusNotificationAt(state, 0)).toEqual(state);
});

test("focusLogBottom jumps to the last revision", () => {
  let state = createState();

  state = focusLogBottom(state);

  expect(state.focusedRevisionIndex).toBe(state.revisions.length - 1);
  expect(state.focusedFileIndex).toBe(0);
});

test("focusLogBottom is a no-op when there are no revisions", () => {
  const state = {
    ...createState(),
    revisions: [],
  };

  expect(focusLogBottom(state)).toEqual(state);
});

test("getFocusedRevisionArg uses the focused revision prefix length", () => {
  const state = createState();
  expect(getFocusedRevisionArg(state)).toBe("a");
});

test("getFocusedRevisionArg uses the concrete revision id for divergent revisions", () => {
  const state = { ...createDivergentState(), focusedRevisionIndex: 1 };

  expect(getFocusedRevisionArg(state)).toBe("abcdefgh/1");
});

test("getFocusedInsertArg falls back to the focused revision in normal command mode", () => {
  const state: AppState = {
    ...createState(),
    focusMode: "command",
    focusModeStack: ["revisions", "command"],
  };

  expect(getFocusedInsertArg(state)).toBe("a");
});

test("getFocusedInsertArg returns the focused operation id when opened from op-log", () => {
  const state: AppState = {
    ...createState(),
    focusMode: "command",
    focusModeStack: ["revisions", "op-log", "command"],
    operationLogEntries: [
      { id: "65d964491fc0", lines: ["65d964491fc0"] },
      { id: "abcdef123456", lines: ["abcdef123456"] },
    ],
    focusedOperationLogIndex: 1,
  };

  expect(getFocusedInsertArg(state)).toBe("abcdef123456");
});

test("getFocusedInsertArg returns the focused entry id when opened from evolog", () => {
  const state: AppState = {
    ...createState(),
    focusMode: "command",
    focusModeStack: ["revisions", "evolog", "command"],
    evologEntries: [{ id: "0123456789ab", lines: ["0123456789ab"] }],
    focusedEvologIndex: 0,
  };

  expect(getFocusedInsertArg(state)).toBe("0123456789ab");
});

test("getFocusedInsertArg ignores synthetic evolog placeholder ids", () => {
  const state: AppState = {
    ...createState(),
    focusMode: "command",
    focusModeStack: ["revisions", "evolog", "command"],
    evologEntries: [{ id: "evolog-0", lines: ["working copy"] }],
    focusedEvologIndex: 0,
  };

  expect(getFocusedInsertArg(state)).toBeNull();
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

test("applyRepositoryData keeps the file list open when the expanded revision's commit id changes", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = toggleFileSelection(state);

  expect(state.focusMode).toBe("files");
  expect(state.expandedRowId).toBe(FIRST_ROW_ID);
  expect(state.selectedFilePaths).toEqual(["src/a.ts"]);

  const newCommitId = "99999999";
  const newRowId = createRowId(newCommitId, "aaaaaaaa");
  const refreshed = applyRepositoryData(state, {
    repoPath: state.repoPath,
    revisions: [
      {
        ...state.revisions[0]!,
        rowId: newRowId,
        commitId: newCommitId,
      },
      state.revisions[1]!,
    ],
  });

  expect(refreshed.focusMode).toBe("files");
  expect(refreshed.expandedRowId).toBe(newRowId);
  expect(refreshed.focusedRevisionIndex).toBe(0);
  expect(refreshed.selectedFilePaths).toEqual(["src/a.ts"]);
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

test("applyRepositoryData focuses the next revision when the focused row is removed", () => {
  const state = createBranchedNavigationState();
  expect(state.focusedRevisionIndex).toBe(3);
  expect(state.revisions[3]?.rowId).toBe(BRANCH_PARENT_ROW_ID);

  const refreshed = applyRepositoryData(state, {
    repoPath: state.repoPath,
    revisions: state.revisions.filter((_, index) => index !== 3),
  });

  expect(refreshed.focusedRevisionIndex).toBe(3);
  expect(refreshed.revisions[3]?.rowId).toBe(BRANCH_ROOT_ROW_ID);
});

test("applyRepositoryData focuses the previous revision when the last focused row is removed", () => {
  const state = { ...createBranchedNavigationState(), focusedRevisionIndex: 4 };
  expect(state.revisions[4]?.rowId).toBe(BRANCH_ROOT_ROW_ID);

  const refreshed = applyRepositoryData(state, {
    repoPath: state.repoPath,
    revisions: state.revisions.slice(0, 4),
  });

  expect(refreshed.focusedRevisionIndex).toBe(3);
  expect(refreshed.revisions[3]?.rowId).toBe(BRANCH_PARENT_ROW_ID);
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
  state = setRebaseSourceKind(state, "source", []);
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

test("toggleSquashAnchor extends squash --from to a range ending at @ when the working copy is non-empty", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.squash);
  expect(getDisplayedCommandText(state)).toBe("squash -f a -t b");

  state = toggleSquashAnchor(state);
  expect(getDisplayedCommandText(state)).toBe("squash -f a::@ -t b");

  state = toggleSquashAnchor(state);
  expect(getDisplayedCommandText(state)).toBe("squash -f a -t b");
});

test("toggleSquashAnchor uses @- as the anchor when the working copy is empty", () => {
  const base = createState();
  const revisions = base.revisions.map((r) =>
    r.marker === "working-copy" ? { ...r, isEmpty: true } : r,
  );
  let state: AppState = { ...base, revisions };
  state = startCommandDraft(state, draftConfigs.squash);
  state = toggleSquashAnchor(state);
  expect(getDisplayedCommandText(state)).toBe("squash -f a::@- -t b");
});

test("toggleSquashAnchor extends every selected source when squashing multiple revisions", () => {
  let state = createState();
  state = toggleRevisionSelection(state);
  state = moveFocus(state, 1);
  state = toggleRevisionSelection(state);
  state = startCommandDraft(state, draftConfigs.squash);
  state = toggleSquashAnchor(state);
  expect(getDisplayedCommandText(state)).toBe("squash -f a::@ -f b::@ -t ░░░░");
});

test("toggleSquashAnchor is a no-op outside squash mode", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: [] });
  const before = getDisplayedCommandText(state);
  const next = toggleSquashAnchor(state);
  expect(getDisplayedCommandText(next)).toBe(before);
  expect(next.commandDraft?.includeAnchor).toBeUndefined();
});

test("toggleSquashAnchor marks resolved anchor rows as affected", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.squash);
  expect(getOperationAffectedRowIds(state)).toEqual(new Set([FIRST_ROW_ID]));

  state = toggleSquashAnchor(state, ["aaaaaaaa", "bbbbbbbb"]);
  expect(getOperationAffectedRowIds(state)).toEqual(new Set([FIRST_ROW_ID, SECOND_ROW_ID]));

  state = toggleSquashAnchor(state, []);
  expect(getOperationAffectedRowIds(state)).toEqual(new Set([FIRST_ROW_ID]));
});

const SQUASH_ONTO_CHILD_ROW_ID = createRowId("33333333", "cccccccc");

// A linear chain, newest at the top: c (child) → a → b (oldest). Focusing b and
// pressing `S` should select the whole branch above it (a and c).
function createSquashOntoChainState(): AppState {
  const base = createState();
  return {
    ...base,
    revisions: [
      {
        rowId: SQUASH_ONTO_CHILD_ROW_ID,
        revisionId: "cccccccc",
        parentRevisionIds: ["aaaaaaaa"],
        changeIdPrefixLength: 1,
        commitId: "33333333",
        description: "third",
        localTimestamp: "2026-03-30 07:22:41",
        bookmarks: [],
        workspaces: [],
        graphRows: ["○  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [],
      },
      ...base.revisions,
    ],
  };
}

test("startSquashOnto keeps the focused revision as the target and selects the branch above it", () => {
  let state = createSquashOntoChainState();
  state = moveFocus(state, 2);
  state = startSquashOnto(state);

  // b stays the target; the revision directly above (a) and its descendant c are
  // all selected as the source.
  expect(state.focusedRevisionIndex).toBe(2);
  expect(state.selectedRowIds).toEqual([SQUASH_ONTO_CHILD_ROW_ID, FIRST_ROW_ID]);
  expect(getDisplayedCommandText(state)).toBe("squash -f c -f a -t b");
});

test("startSquashOnto anchors on the lowest selected revision and pulls in its branch", () => {
  let state = createSquashOntoChainState();
  // Select only a (index 1); selecting it advances focus onto b (index 2).
  state = moveFocus(state, 1);
  state = toggleRevisionSelection(state);

  state = startSquashOnto(state);

  // a is the lowest selected revision, so it anchors the source; its descendant
  // c is pulled in even though it was never selected, and b stays the target.
  expect(state.focusedRevisionIndex).toBe(2);
  expect(state.selectedRowIds).toEqual([SQUASH_ONTO_CHILD_ROW_ID, FIRST_ROW_ID]);
  expect(getDisplayedCommandText(state)).toBe("squash -f c -f a -t b");
});

test("startSquashOnto is a no-op when nothing sits above the focused revision", () => {
  const state = createState();
  const next = startSquashOnto(state);

  expect(next.commandDraft).toBeNull();
  expect(next.selectedRowIds).toEqual([]);
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

  expect(state.layout).toBe("loose");
  expect(next.layout).toBe("normal");
  expect(cycleLayout(next).layout).toBe("tight");
  expect(wrapped.layout).toBe("loose");
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

test("inline confirmation preview highlights file placeholders separately from command text", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = setRevisionFiles(state, FIRST_ROW_ID, [
    { status: "M", path: "src/a.ts" },
  ]);
  state = toggleFileSelection(state);
  state = openInlineConfirmation(state, {
    kind: "split-files",
    rowId: FIRST_ROW_ID,
    message: "Split selected files?",
    options: ["yes", "interactive", "no"],
    selectedOption: "yes",
    actualCommandByOption: {
      yes: "split -r a /tmp/repo/src/a.ts",
      interactive: "split -i -r a /tmp/repo/src/a.ts",
      no: "split -r a",
    },
    previewCommandByOption: {
      yes: "split -r a …files…",
      interactive: "split -i -r a …files…",
      no: "split -r a",
    },
  });

  expect(getInlineConfirmation(state)?.selectedOption).toBe("yes");
  expect(getDisplayedCommandSegments(state)).toEqual([
    { text: "split -r a ", style: "command" },
    { text: "…files…", style: "files" },
  ]);

  state = selectNextInlineConfirmationOption(state);
  expect(getDisplayedCommandSegments(state)).toEqual([
    { text: "split -i -r a ", style: "command" },
    { text: "…files…", style: "files" },
  ]);
});

test("openRevsetInput sets focusMode to revset", () => {
  let state = createState();
  expect(state.focusMode).toBe("revisions");
  state = openRevsetInput(state);
  expect(state.focusMode).toBe("revset");
  expect(state.focusModeStack).toEqual(["revisions", "revset"]);
  expect(state.revsetInputQuery).toBeNull();
});

test("openRevsetInput can seed the revset prompt without changing the active revset", () => {
  let state = createState();
  state = setRevsetQuery(state, "old()");
  state = openRevsetInput(state, 'files("src/app.ts")');

  expect(state.focusMode).toBe("revset");
  expect(state.revsetQuery).toBe("old()");
  expect(state.revsetInputQuery).toBe('files("src/app.ts")');
});

test("closeRevsetInput restores focusMode to revisions", () => {
  let state = createState();
  state = openRevsetInput(state, 'files("src/app.ts")');
  state = closeRevsetInput(state);
  expect(state.focusMode).toBe("revisions");
  expect(state.revsetInputQuery).toBeNull();
});

test("closeRevsetInput returns to file navigation when a revision is expanded", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = openRevsetInput(state);

  state = closeRevsetInput(state);

  expect(state.focusMode).toBe("files");
  expect(state.expandedRowId).toBe(FIRST_ROW_ID);
});

test("openFileSearch sets focusMode to file-search", () => {
  let state = createState();
  state = openFileSearch(state);

  expect(state.focusMode).toBe("file-search");
  expect(state.focusModeStack).toEqual(["revisions", "file-search"]);
});

test("closeFileSearch returns to file navigation when opened from files mode", () => {
  let state = createState();
  state = openFocusedRevision(state);
  state = openFileSearch(state);

  state = closeFileSearch(state);

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

test("openDiffViewer enters diff-viewer mode and stores content", () => {
  let state = createState();
  state = openDiffViewer(state, "line 1\nline 2\nline 3");

  expect(state.focusMode).toBe("diff-viewer");
  expect(state.focusModeStack).toEqual(["revisions", "diff-viewer"]);
  expect(state.diffViewer?.content).toBe("line 1\nline 2\nline 3");
});

test("openDiffViewer accepts empty content without crashing", () => {
  let state = createState();
  state = openDiffViewer(state, "");

  expect(state.focusMode).toBe("diff-viewer");
  expect(state.diffViewer?.content).toBe("");
});

test("togglePreviewFullFile toggles full-file preview diffs for the session", () => {
  let state = createState();

  expect(state.previewFullFile).toBeFalse();

  state = togglePreviewFullFile(state);
  expect(state.previewFullFile).toBeTrue();

  state = togglePreviewFullFile(state);
  expect(state.previewFullFile).toBeFalse();
});

test("createInitialState defaults searchIdOnly to false", () => {
  const state = createInitialState("/tmp/repo");
  expect(state.searchIdOnly).toBe(false);
});

test("toggleSearchIdOnly flips searchIdOnly", () => {
  let state = createState();
  state = openSearch(state);
  expect(state.searchIdOnly).toBe(false);

  state = toggleSearchIdOnly(state);
  expect(state.searchIdOnly).toBe(true);

  state = toggleSearchIdOnly(state);
  expect(state.searchIdOnly).toBe(false);
});

test("searchIdOnly matches revision IDs by prefix only", () => {
  let state = createState();
  state = openSearch(state);
  state = toggleSearchIdOnly(state);
  // "main" is the bookmark of the first revision, but should not match in id-only mode
  state = setSearchText(state, "main");
  // No revision ID starts with "main" → no match → focus preserved at 0
  expect(state.focusedRevisionIndex).toBe(0);
  expect(getSearchMatchIndices(state)).toEqual([]);

  // Now query the actual ID prefix
  state = setSearchText(state, "bbb");
  expect(state.focusedRevisionIndex).toBe(1);
  expect(getSearchMatchIndices(state)).toEqual([1]);
});

test("searchIdOnly substring match against id does NOT count", () => {
  let state = createState();
  state = openSearch(state);
  state = toggleSearchIdOnly(state);
  // "aaaaaaaa" is the first revision's full id; "aaa" is a prefix → matches first.
  state = setSearchText(state, "aaa");
  expect(getSearchMatchIndices(state)).toEqual([0]);

  // "bbb" appears as substring inside "aaaaaaaa"? No. Does it match "bbbbbbbb"? Yes (prefix).
  state = setSearchText(state, "bbb");
  expect(getSearchMatchIndices(state)).toEqual([1]);
});

test("openSearch over empty query resets searchIdOnly", () => {
  let state = createState();
  state = openSearch(state);
  state = toggleSearchIdOnly(state);
  state = closeSearch(state);

  state = openSearch(state);
  expect(state.searchIdOnly).toBe(false);
});

test("openSearch over a non-empty query preserves searchIdOnly", () => {
  let state = createState();
  state = openSearch(state);
  state = toggleSearchIdOnly(state);
  state = setSearchText(state, "bbb");
  state = finalizeSearch(state);
  expect(state.searchQuery).toBe("bbb");
  expect(state.searchIdOnly).toBe(true);

  state = openSearch(state);
  expect(state.searchQuery).toBe("bbb");
  expect(state.searchIdOnly).toBe(true);
});

test("finalizeSearch in rebase mode preserves commandDraft", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase);
  expect(state.commandDraft).not.toBeNull();

  state = openSearch(state);
  state = setSearchText(state, "second");
  state = finalizeSearch(state);

  // Search query stays live, search input is dismissed, rebase draft survives.
  expect(state.focusMode).toBe("revisions");
  expect(state.searchQuery).toBe("second");
  expect(state.commandDraft).not.toBeNull();
  expect(state.commandDraft?.config.kind).toBe("rebase");
});

test("cancelOrBlur in rebase mode clears finalized search highlights before cancelling draft", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase);
  state = openSearch(state);
  state = setSearchText(state, "second");
  state = finalizeSearch(state);
  expect(state.searchQuery).toBe("second");
  expect(state.commandDraft).not.toBeNull();

  // First Esc: clears highlights but keeps rebase draft.
  state = cancelOrBlurState(state);
  expect(state.searchQuery).toBe("");
  expect(state.commandDraft).not.toBeNull();

  // Second Esc: cancels the rebase draft.
  state = cancelOrBlurState(state);
  expect(state.commandDraft).toBeNull();
});
