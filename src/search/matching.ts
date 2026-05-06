import type { AppState, OperationLogEntry, RevisionSummary, SearchScopeId } from "../domain/types.ts";

export type SearchableItem = Readonly<{
  scope: SearchScopeId;
  id: string;
  index: number;
  text: string;
}>;

export type TextMatchRange = Readonly<{
  start: number;
  end: number;
}>;

const ANSI_ESCAPE_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]/g;

export function getSearchScopeForState(
  state: Pick<AppState, "focusMode" | "focusModeStack">,
): SearchScopeId {
  return state.focusMode === "op-log" || state.focusModeStack.includes("op-log")
    ? "operation-log"
    : "revision-log";
}

export function getActiveSearchScope(
  state: Pick<AppState, "focusMode" | "focusModeStack" | "searchScope">,
): SearchScopeId {
  return state.searchScope ?? getSearchScopeForState(state);
}

export function getSearchableItems(state: AppState): readonly SearchableItem[] {
  const scope = getActiveSearchScope(state);
  switch (scope) {
    case "operation-log":
      return state.operationLogEntries.map((entry, index) =>
        createOperationLogSearchableItem(entry, index)
      );
    case "revision-log":
      return state.revisions.map((revision, index) =>
        createRevisionSearchableItem(revision, index)
      );
  }
}

export function getSearchMatchItems(
  state: AppState,
  query = state.searchQuery,
): readonly SearchableItem[] {
  if (query.length === 0) {
    return [];
  }

  return getSearchableItems(state).filter((item) => textMatchesQuery(item.text, query));
}

export function getSearchMatchItemIds(state: AppState): ReadonlySet<string> {
  return new Set(getSearchMatchItems(state).map((item) => item.id));
}

export function textMatchesQuery(text: string, query: string): boolean {
  if (query.length === 0) {
    return false;
  }

  return text.toLowerCase().includes(query.toLowerCase());
}

export function findTextMatchRanges(text: string, query: string): readonly TextMatchRange[] {
  if (query.length === 0) {
    return [];
  }

  const ranges: TextMatchRange[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let offset = 0;

  while (offset < text.length) {
    const index = lowerText.indexOf(lowerQuery, offset);
    if (index === -1) {
      break;
    }

    ranges.push({ start: index, end: index + query.length });
    offset = index + query.length;
  }

  return ranges;
}

export function stripAnsi(input: string): string {
  return input.replace(ANSI_ESCAPE_PATTERN, "");
}

function createRevisionSearchableItem(
  revision: RevisionSummary,
  index: number,
): SearchableItem {
  return {
    scope: "revision-log",
    id: `revision-${revision.rowId}`,
    index,
    text: [
      revision.revisionId,
      firstLine(revision.description),
      ...revision.bookmarks,
      ...revision.workspaces,
    ].join("\n"),
  };
}

function createOperationLogSearchableItem(
  entry: OperationLogEntry,
  index: number,
): SearchableItem {
  return {
    scope: "operation-log",
    id: `operation-log-entry-${index}`,
    index,
    text: entry.lines.map(stripAnsi).join("\n"),
  };
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0] ?? "";
}
