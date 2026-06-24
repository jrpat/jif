import { expect, test } from "bun:test";
import { closeSearch, createInitialState, finalizeSearch, getSearchMatchIndices, nextSearchMatch, openDiffViewer, openEvolog, openFastJump, openOperationLog, openSearch, prevSearchMatch, setEvologEntries, setOperationLogEntries, setSearchText } from "../src/state/store.ts";
import type { AppState, RevisionSummary } from "../src/domain/types.ts";
import { hasVisibleSearchHighlights } from "../src/search/matching.ts";

function createRevision(overrides: Partial<RevisionSummary> = {}): RevisionSummary {
  const revisionId = overrides.revisionId ?? "aaaaaaaa";
  return {
    rowId: overrides.rowId ?? revisionId,
    revisionId,
    changeIdPrefixLength: 2,
    commitId: overrides.commitId ?? `${revisionId}commit`,
    description: overrides.description ?? "first revision",
    localTimestamp: "2026-05-06 12:00:00",
    bookmarks: overrides.bookmarks ?? [],
    workspaces: overrides.workspaces ?? [],
    graphRows: overrides.graphRows ?? ["@  "],
    isEmpty: false,
    hasConflict: false,
    marker: "plain",
    filesLoaded: true,
    files: [],
    ...overrides,
  };
}

test("revision search keeps incremental focus movement in revision scope", () => {
  let state: AppState = {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      createRevision({ rowId: "one", revisionId: "aaaaaaaa", description: "first revision" }),
      createRevision({ rowId: "two", revisionId: "bbbbbbbb", description: "second revision" }),
    ],
  };

  state = openSearch(state);
  state = setSearchText(state, "second");

  expect(state.searchScope).toBe("revision-log");
  expect(state.focusedRevisionIndex).toBe(1);
  expect(getSearchMatchIndices(state)).toEqual([1]);
});

test("canceling revision search restores the starting focus", () => {
  let state: AppState = {
    ...createInitialState("/tmp/repo"),
    focusedRevisionIndex: 1,
    revisions: [
      createRevision({ rowId: "one", revisionId: "aaaaaaaa", description: "first revision" }),
      createRevision({ rowId: "two", revisionId: "bbbbbbbb", description: "second revision" }),
    ],
  };

  state = openSearch(state);
  state = setSearchText(state, "first");
  expect(state.focusedRevisionIndex).toBe(0);

  state = closeSearch(state);
  expect(state.focusMode).toBe("revisions");
  expect(state.searchQuery).toBe("");
  expect(state.searchScope).toBeNull();
  expect(state.focusedRevisionIndex).toBe(1);
});

test("confirming revision search keeps the matched focus", () => {
  let state: AppState = {
    ...createInitialState("/tmp/repo"),
    focusedRevisionIndex: 1,
    revisions: [
      createRevision({ rowId: "one", revisionId: "aaaaaaaa", description: "first revision" }),
      createRevision({ rowId: "two", revisionId: "bbbbbbbb", description: "second revision" }),
    ],
  };

  state = openSearch(state);
  state = setSearchText(state, "first");
  state = finalizeSearch(state);

  expect(state.focusMode).toBe("revisions");
  expect(state.searchQuery).toBe("first");
  expect(state.searchScope).toBe("revision-log");
  expect(state.focusedRevisionIndex).toBe(0);
});

test("confirming fast jump keeps the matched focus and clears highlights", () => {
  let state: AppState = {
    ...createInitialState("/tmp/repo"),
    focusedRevisionIndex: 1,
    revisions: [
      createRevision({ rowId: "one", revisionId: "aaaaaaaa", description: "first revision" }),
      createRevision({ rowId: "two", revisionId: "bbbbbbbb", description: "second revision" }),
    ],
  };

  state = openFastJump(state);
  expect(state.searchMode).toBe("fast-jump");
  state = setSearchText(state, "first");
  state = finalizeSearch(state);

  expect(state.focusMode).toBe("revisions");
  expect(state.searchQuery).toBe("");
  expect(state.searchScope).toBeNull();
  expect(state.searchMode).toBe("search");
  expect(hasVisibleSearchHighlights(state)).toBeFalse();
  expect(state.focusedRevisionIndex).toBe(0);
});

test("setSearchText after finalize does not snap focus back to the first match", () => {
  let state: AppState = {
    ...createInitialState("/tmp/repo"),
    revisions: [
      createRevision({ rowId: "one", revisionId: "aaaaaaaa", description: "first revision" }),
      createRevision({ rowId: "two", revisionId: "bbbbbbbb", description: "first second" }),
      createRevision({ rowId: "three", revisionId: "cccccccc", description: "first third" }),
    ],
  };

  state = openSearch(state);
  state = setSearchText(state, "first");
  state = finalizeSearch(state);
  expect(state.focusedRevisionIndex).toBe(0);

  state = { ...state, focusedRevisionIndex: 2 };

  state = setSearchText(state, "first");

  expect(state.focusedRevisionIndex).toBe(2);
  expect(state.searchQuery).toBe("first");
});

test("operation-log search scopes matches and navigation to op-log entries", () => {
  let state = createInitialState("/tmp/repo");
  state = setOperationLogEntries(state, [
    { id: "one", lines: ["65d964491fc0 first operation"] },
    { id: "two", lines: ["96df2f0afa0c second operation"] },
  ]);
  state = openOperationLog(state);
  state = openSearch(state);
  state = setSearchText(state, "operation");

  expect(state.searchScope).toBe("operation-log");
  expect(state.focusedOperationLogIndex).toBe(0);
  expect(getSearchMatchIndices(state)).toEqual([0, 1]);

  state = nextSearchMatch(state);
  expect(state.focusedOperationLogIndex).toBe(1);

  state = nextSearchMatch(state);
  expect(state.focusedOperationLogIndex).toBe(0);

  state = prevSearchMatch(state);
  expect(state.focusedOperationLogIndex).toBe(1);
});

test("canceling operation-log search restores the starting focus", () => {
  let state = createInitialState("/tmp/repo");
  state = setOperationLogEntries(state, [
    { id: "one", lines: ["65d964491fc0 first operation"] },
    { id: "two", lines: ["96df2f0afa0c second operation"] },
  ]);
  state = {
    ...openOperationLog(state),
    focusedOperationLogIndex: 1,
  };

  state = openSearch(state);
  state = setSearchText(state, "first");
  expect(state.focusedOperationLogIndex).toBe(0);

  state = closeSearch(state);
  expect(state.focusMode).toBe("op-log");
  expect(state.searchQuery).toBe("");
  expect(state.searchScope).toBeNull();
  expect(state.focusedOperationLogIndex).toBe(1);
});

test("evolog search scopes matches and navigation to evolog entries", () => {
  let state = createInitialState("/tmp/repo");
  state = setEvologEntries(state, [
    { id: "one", lines: ["@  xuntkrpo dafa8495", "│  first evolution"] },
    { id: "two", lines: ["○  xuntkrpo/1 f5029c4b", "│  second evolution"] },
  ]);
  state = openEvolog(state, "xuntkrpo");
  state = openSearch(state);
  state = setSearchText(state, "evolution");

  expect(state.searchScope).toBe("evolog");
  expect(state.focusedEvologIndex).toBe(0);
  expect(getSearchMatchIndices(state)).toEqual([0, 1]);

  state = nextSearchMatch(state);
  expect(state.focusedEvologIndex).toBe(1);

  state = prevSearchMatch(state);
  expect(state.focusedEvologIndex).toBe(0);
});

test("operation-log search ignores ansi escape sequences", () => {
  let state = createInitialState("/tmp/repo");
  state = setOperationLogEntries(state, [
    { id: "one", lines: ["\u001b[38;5;13margs:\u001b[39m jj rebase -r a -d b"] },
  ]);
  state = openOperationLog(state);
  state = openSearch(state);
  state = setSearchText(state, "args");

  expect(getSearchMatchIndices(state)).toEqual([0]);
  expect(state.focusedOperationLogIndex).toBe(0);
});

test("search does not open in unsupported views", () => {
  let state = createInitialState("/tmp/repo");
  state = openDiffViewer(state, "diff");

  state = openSearch(state);

  expect(state.focusMode).toBe("diff-viewer");
  expect(state.searchScope).toBeNull();
  expect(state.searchQuery).toBe("");
});

test("active search highlights only show while their scope is visible", () => {
  let state: AppState = {
    ...createInitialState("/tmp/repo"),
    revisions: [
      createRevision({ rowId: "one", revisionId: "aaaaaaaa", description: "first revision" }),
    ],
  };
  state = openSearch(state);
  state = setSearchText(state, "first");
  state = finalizeSearch(state);

  expect(hasVisibleSearchHighlights(state)).toBeTrue();

  state = openDiffViewer(state, "diff");
  expect(hasVisibleSearchHighlights(state)).toBeFalse();
});
