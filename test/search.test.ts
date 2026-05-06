import { expect, test } from "bun:test";
import { createInitialState, getSearchMatchIndices, nextSearchMatch, openOperationLog, openSearch, prevSearchMatch, setOperationLogEntries, setSearchText } from "../src/state/store.ts";
import type { AppState, RevisionSummary } from "../src/domain/types.ts";

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
