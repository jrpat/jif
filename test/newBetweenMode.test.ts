import { expect, test } from "bun:test";
import type { AppState, RevisionSummary } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import { getActiveMode, resolveCommand } from "../src/modes.ts";
import {
  cancelOrBlurState,
  commandCanExecute,
  createInitialState,
  focusRevisionAt,
  getCommandChipTextForRevision,
  getCommandTargetRowId,
  getDisplayedCommandSegments,
  getDisplayedCommandText,
  startNewBetween,
  toggleNewBetweenBefore,
} from "../src/state/store.ts";

const A_ROW_ID = createRowId("10000000", "aaaaaaaa");
const B_ROW_ID = createRowId("20000000", "bbbbbbbb");
const C_ROW_ID = createRowId("30000000", "cccccccc");
const D_ROW_ID = createRowId("40000000", "dddddddd");

// Four sibling revisions; the pure state functions do not validate topology,
// so any arrangement works for composing `jj new -A … -B …`.
function createNewBetweenState(): AppState {
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
      base(A_ROW_ID, "aaaaaaaa", "10000000", "working-copy"),
      base(B_ROW_ID, "bbbbbbbb", "20000000", "plain"),
      base(C_ROW_ID, "cccccccc", "30000000", "plain"),
      base(D_ROW_ID, "dddddddd", "40000000", "plain"),
    ],
  };
}

function selectRows(state: AppState, rowIds: readonly string[]): AppState {
  return { ...state, selectedRowIds: [...rowIds], markedRowIds: [...rowIds] };
}

test("alt-n enters new-between from normal and space pins an insert-before pick inside it", () => {
  expect(resolveCommand("normal", "alt-n")).toBe("new-between");
  expect(resolveCommand("new-between", " ")).toBe("toggle-new-between-before");
  // Navigation and confirmation are inherited from normal.
  expect(resolveCommand("new-between", "j")).toBe("move-down");
  expect(resolveCommand("new-between", "enter")).toBe("confirm");
});

test("startNewBetween selects the focused revision as the insert-after source", () => {
  let state = createNewBetweenState();
  state = startNewBetween(state);

  expect(getActiveMode(state)).toBe("new-between");
  expect(state.commandDraft?.config.kind).toBe("new-between");
  expect(state.selectedRowIds).toEqual([A_ROW_ID]);
});

test("new-between falls back to `jj new A` when one revision is both sides", () => {
  let state = createNewBetweenState();
  state = startNewBetween(state);

  // Focus stays on the sole insert-after revision, so the command degenerates
  // to creating a plain child of it.
  expect(getDisplayedCommandText(state)).toBe("new a");
  expect(commandCanExecute(state)).toBeTrue();
});

test("new-between uses the focused revision as the default insert-before target", () => {
  let state = createNewBetweenState();
  state = selectRows(state, [A_ROW_ID, B_ROW_ID]);
  state = startNewBetween(state);
  state = focusRevisionAt(state, 2); // c

  expect(getDisplayedCommandText(state)).toBe("new -A a -A b -B c");
  expect(commandCanExecute(state)).toBeTrue();

  // The default target follows the cursor.
  state = focusRevisionAt(state, 3); // d
  expect(getDisplayedCommandText(state)).toBe("new -A a -A b -B d");
});

test("new-between spells out long flags when short flags are disabled", () => {
  let state = createNewBetweenState();
  state = selectRows(state, [A_ROW_ID, B_ROW_ID]);
  state = startNewBetween(state);
  state = { ...state, useShortFlags: false };
  state = focusRevisionAt(state, 2); // c

  expect(getDisplayedCommandText(state)).toBe(
    "new --insert-after a --insert-after b --insert-before c",
  );
});

test("new-between shows a placeholder when the focus sits on one of several insert-afters", () => {
  let state = createNewBetweenState();
  state = selectRows(state, [A_ROW_ID, B_ROW_ID]);
  state = startNewBetween(state);
  state = focusRevisionAt(state, 0); // a, already an insert-after

  expect(getDisplayedCommandText(state)).toBe("new -A a -A b -B ░░░░");
  expect(commandCanExecute(state)).toBeFalse();
});

test("space pins explicit insert-before revisions that stop following the cursor", () => {
  let state = createNewBetweenState();
  state = selectRows(state, [A_ROW_ID, B_ROW_ID]);
  state = startNewBetween(state);

  state = focusRevisionAt(state, 2); // c
  state = toggleNewBetweenBefore(state);
  expect(getDisplayedCommandText(state)).toBe("new -A a -A b -B c");

  // Once pinned, moving the cursor no longer changes the command.
  state = focusRevisionAt(state, 3); // d
  expect(getDisplayedCommandText(state)).toBe("new -A a -A b -B c");

  state = toggleNewBetweenBefore(state); // pin d as well
  expect(getDisplayedCommandText(state)).toBe("new -A a -A b -B c -B d");
});

test("toggling a pinned insert-before revision unpins it", () => {
  let state = createNewBetweenState();
  state = selectRows(state, [A_ROW_ID, B_ROW_ID]);
  state = startNewBetween(state);

  state = focusRevisionAt(state, 2); // pin c
  state = toggleNewBetweenBefore(state);
  state = focusRevisionAt(state, 3); // pin d
  state = toggleNewBetweenBefore(state);
  state = focusRevisionAt(state, 2); // unpin c
  state = toggleNewBetweenBefore(state);

  expect(getDisplayedCommandText(state)).toBe("new -A a -A b -B d");
});

test("pinning advances the cursor and unpinning holds it", () => {
  let state = createNewBetweenState();
  state = selectRows(state, [A_ROW_ID, B_ROW_ID]);
  state = startNewBetween(state);

  state = focusRevisionAt(state, 2); // c
  state = toggleNewBetweenBefore(state);
  expect(state.focusedRevisionIndex).toBe(3);

  state = focusRevisionAt(state, 2);
  state = toggleNewBetweenBefore(state);
  expect(state.focusedRevisionIndex).toBe(2);
});

test("an insert-after revision cannot be pinned as insert-before", () => {
  let state = createNewBetweenState();
  state = selectRows(state, [A_ROW_ID, B_ROW_ID]);
  state = startNewBetween(state);

  state = focusRevisionAt(state, 0); // a, an insert-after
  state = toggleNewBetweenBefore(state);

  expect(state.commandDraft?.newBetweenBeforeRowIds ?? []).toEqual([]);
  expect(getDisplayedCommandText(state)).toBe("new -A a -A b -B ░░░░");
});

test("new-between tags insert-afters with after chips and the target with a before chip", () => {
  let state = createNewBetweenState();
  state = selectRows(state, [A_ROW_ID, B_ROW_ID]);
  state = startNewBetween(state);
  state = focusRevisionAt(state, 2); // c

  expect(getCommandChipTextForRevision(state, A_ROW_ID)).toBe("after");
  expect(getCommandChipTextForRevision(state, B_ROW_ID)).toBe("after");
  expect(getCommandChipTextForRevision(state, C_ROW_ID)).toBe("before");
  expect(getCommandChipTextForRevision(state, D_ROW_ID)).toBeNull();
});

test("pins carry the before chip and suppress the cursor-following target", () => {
  let state = createNewBetweenState();
  state = selectRows(state, [A_ROW_ID, B_ROW_ID]);
  state = startNewBetween(state);

  state = focusRevisionAt(state, 2); // pin c
  state = toggleNewBetweenBefore(state);
  state = focusRevisionAt(state, 3); // cursor elsewhere

  expect(getCommandChipTextForRevision(state, C_ROW_ID)).toBe("before");
  expect(getCommandChipTextForRevision(state, D_ROW_ID)).toBeNull();
  expect(getCommandTargetRowId(state)).toBeNull();
});

test("new-between renders sources and targets as styled segments", () => {
  let state = createNewBetweenState();
  state = selectRows(state, [A_ROW_ID]);
  state = startNewBetween(state);
  state = focusRevisionAt(state, 2); // c

  expect(getDisplayedCommandSegments(state)).toEqual([
    { text: "new -A ", style: "command" },
    { text: "a", style: "selected" },
    { text: " -B ", style: "command" },
    { text: "c", style: "target" },
  ]);
});

test("the fallback renders the lone revision as a selected segment", () => {
  let state = createNewBetweenState();
  state = startNewBetween(state);

  expect(getDisplayedCommandSegments(state)).toEqual([
    { text: "new ", style: "command" },
    { text: "a", style: "selected" },
  ]);
});

test("escape cancels new-between and clears the composition", () => {
  let state = createNewBetweenState();
  state = selectRows(state, [A_ROW_ID, B_ROW_ID]);
  state = startNewBetween(state);
  state = focusRevisionAt(state, 2);
  state = toggleNewBetweenBefore(state);

  state = cancelOrBlurState(state);

  expect(state.commandDraft).toBeNull();
  expect(state.selectedRowIds).toEqual([]);
  expect(getActiveMode(state)).toBe("normal");
});
