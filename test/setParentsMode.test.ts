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
  startSetParents,
  toggleSetParentsPick,
} from "../src/state/store.ts";

const SUBJECT_ROW_ID = createRowId("10000000", "aaaaaaaa");
const PARENT_ONE_ROW_ID = createRowId("20000000", "bbbbbbbb");
const PARENT_TWO_ROW_ID = createRowId("30000000", "cccccccc");
const OTHER_ROW_ID = createRowId("40000000", "dddddddd");

// Subject `a` is a merge of parents `b` and `c`; `d` is an unrelated revision
// that can be toggled in as a new co-parent.
function createSetParentsState(): AppState {
  const base = (
    rowId: string,
    revisionId: string,
    commitId: string,
    marker: RevisionSummary["marker"],
    parentRevisionIds: readonly string[],
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
      base(SUBJECT_ROW_ID, "aaaaaaaa", "10000000", "working-copy", ["bbbbbbbb", "cccccccc"]),
      base(PARENT_ONE_ROW_ID, "bbbbbbbb", "20000000", "plain", []),
      base(PARENT_TWO_ROW_ID, "cccccccc", "30000000", "plain", []),
      base(OTHER_ROW_ID, "dddddddd", "40000000", "plain", []),
    ],
  };
}

test("startSetParents enters set-parents mode with the focused revision as subject", () => {
  let state = createSetParentsState();
  state = startSetParents(state);

  expect(getActiveMode(state)).toBe("set-parents");
  expect(state.commandDraft?.config.kind).toBe("set-parents");
  expect(state.commandDraft?.setParentsSubjectRevisionId).toBe("aaaaaaaa");
  // No picks yet, and the subject is not itself a pick.
  expect(state.selectedRowIds).toEqual([]);
  // The subject row is the highlighted command target regardless of cursor.
  expect(getCommandTargetRowId(state)).toBe(SUBJECT_ROW_ID);
});

test("set-parents previews the current parent set before any toggle", () => {
  let state = createSetParentsState();
  state = startSetParents(state);

  // Reflects today's parents, but cannot run until the user changes something.
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b -d c");
  expect(commandCanExecute(state)).toBeFalse();
});

test("set-parents marks the subject with a subject chip", () => {
  let state = createSetParentsState();
  state = startSetParents(state);

  expect(getCommandChipTextForRevision(state, SUBJECT_ROW_ID)).toBe("subject");
});

test("set-parents adds a non-parent revision as a new parent", () => {
  let state = createSetParentsState();
  state = startSetParents(state);

  state = focusRevisionAt(state, 3); // d
  state = toggleSetParentsPick(state);

  expect(getCommandChipTextForRevision(state, OTHER_ROW_ID)).toBe("add");
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b -d c -d d");
  expect(commandCanExecute(state)).toBeTrue();
});

test("set-parents removes an existing parent", () => {
  let state = createSetParentsState();
  state = startSetParents(state);

  state = focusRevisionAt(state, 1); // b
  state = toggleSetParentsPick(state);

  expect(getCommandChipTextForRevision(state, PARENT_ONE_ROW_ID)).toBe("remove");
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d c");
  expect(commandCanExecute(state)).toBeTrue();
});

test("set-parents can swap one parent for another in a single composition", () => {
  let state = createSetParentsState();
  state = startSetParents(state);

  state = focusRevisionAt(state, 1); // remove b
  state = toggleSetParentsPick(state);
  state = focusRevisionAt(state, 3); // add d
  state = toggleSetParentsPick(state);

  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d c -d d");
});

test("set-parents shows a placeholder and blocks running when all parents are removed", () => {
  let state = createSetParentsState();
  state = startSetParents(state);

  state = focusRevisionAt(state, 1); // remove b
  state = toggleSetParentsPick(state);
  state = focusRevisionAt(state, 2); // remove c
  state = toggleSetParentsPick(state);

  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d ░░░░");
  expect(commandCanExecute(state)).toBeFalse();
});

test("set-parents will not let the subject become its own parent", () => {
  let state = createSetParentsState();
  state = startSetParents(state);

  state = focusRevisionAt(state, 0); // the subject itself
  state = toggleSetParentsPick(state);

  expect(state.selectedRowIds).toEqual([]);
  expect(getCommandChipTextForRevision(state, SUBJECT_ROW_ID)).toBe("subject");
});

test("set-parents toggling advances the cursor on add and holds on remove", () => {
  let state = createSetParentsState();
  state = startSetParents(state);

  state = focusRevisionAt(state, 3); // d
  state = toggleSetParentsPick(state);
  // Adding advances past the toggled row, mirroring normal multi-select.
  expect(state.focusedRevisionIndex).toBe(3);

  state = focusRevisionAt(state, 3);
  state = toggleSetParentsPick(state);
  // Removing keeps focus on the row so it can be re-toggled.
  expect(state.focusedRevisionIndex).toBe(3);
  expect(state.selectedRowIds).toEqual([]);
});

test("set-parents keeps an off-graph parent unless it is explicitly toggled", () => {
  let state = createSetParentsState();
  // Subject also has a parent that is not visible in the current log.
  state = {
    ...state,
    revisions: state.revisions.map((revision) =>
      revision.rowId === SUBJECT_ROW_ID
        ? { ...revision, parentRevisionIds: ["bbbbbbbb", "eeeeeeee"] }
        : revision,
    ),
  };
  state = startSetParents(state);

  state = focusRevisionAt(state, 3); // add d
  state = toggleSetParentsPick(state);

  // The invisible parent `eeeeeeee` survives by its full id, alongside b and d.
  expect(getDisplayedCommandText(state)).toBe("rebase -r a -d b -d eeeeeeee -d d");
});

test("set-parents renders subject and destinations as styled segments", () => {
  let state = createSetParentsState();
  state = startSetParents(state);
  state = focusRevisionAt(state, 3);
  state = toggleSetParentsPick(state);

  expect(getDisplayedCommandSegments(state)).toEqual([
    { text: "rebase -r ", style: "command" },
    { text: "a", style: "selected" },
    { text: " -d ", style: "command" },
    { text: "b", style: "target" },
    { text: " -d ", style: "command" },
    { text: "c", style: "target" },
    { text: " -d ", style: "command" },
    { text: "d", style: "target" },
  ]);
});

test("escape cancels set-parents and clears the working pick set", () => {
  let state = createSetParentsState();
  state = startSetParents(state);
  state = focusRevisionAt(state, 3);
  state = toggleSetParentsPick(state);

  state = cancelOrBlurState(state);

  expect(state.commandDraft).toBeNull();
  expect(state.selectedRowIds).toEqual([]);
  expect(getActiveMode(state)).toBe("normal");
});

test("M enters set-parents from normal and space toggles a parent pick inside it", () => {
  expect(resolveCommand("normal", "M")).toBe("set-parents");
  expect(resolveCommand("set-parents", " ")).toBe("toggle-set-parents-pick");
  // Navigation and confirmation are inherited from normal.
  expect(resolveCommand("set-parents", "j")).toBe("move-down");
  expect(resolveCommand("set-parents", "enter")).toBe("confirm");
});
