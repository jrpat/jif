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
const SEARCH_SCOPE_BY_FOCUS_MODE: Partial<Record<AppState["focusMode"], SearchScopeId>> = {
  revisions: "revision-log",
  files: "revision-log",
  "op-log": "operation-log",
};
const SEARCH_VISIBLE_THROUGH_FOCUS_MODES = new Set<AppState["focusMode"]>([
  "command",
  "inline-confirmation",
  "revset",
  "search",
]);

export function getSearchScopeForState(
  state: Pick<AppState, "focusMode">,
): SearchScopeId | null {
  return SEARCH_SCOPE_BY_FOCUS_MODE[state.focusMode] ?? null;
}

export function getActiveSearchScope(
  state: Pick<AppState, "focusMode" | "searchScope">,
): SearchScopeId | null {
  return state.searchScope ?? getSearchScopeForState(state);
}

export function canSearchState(state: Pick<AppState, "focusMode">): boolean {
  return getSearchScopeForState(state) !== null;
}

export function hasVisibleSearchScope(
  state: Pick<AppState, "focusMode" | "focusModeStack" | "searchScope">,
): boolean {
  if (state.searchScope === null) {
    return false;
  }

  return getVisibleSearchScopeForState(state) === state.searchScope;
}

export function hasVisibleSearchHighlights(
  state: Pick<AppState, "focusMode" | "focusModeStack" | "searchQuery" | "searchScope">,
): boolean {
  return state.searchQuery !== "" && hasVisibleSearchScope(state);
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
    case null:
      return [];
  }
}

function getVisibleSearchScopeForState(
  state: Pick<AppState, "focusMode" | "focusModeStack" | "searchScope">,
): SearchScopeId | null {
  const directScope = getSearchScopeForState(state);
  if (directScope !== null) {
    return directScope;
  }

  if (!SEARCH_VISIBLE_THROUGH_FOCUS_MODES.has(state.focusMode)) {
    return null;
  }

  return state.searchScope ?? getSearchScopeFromStack(state.focusModeStack);
}

function getSearchScopeFromStack(focusModeStack: readonly AppState["focusMode"][]): SearchScopeId | null {
  if (focusModeStack.includes("op-log")) {
    return "operation-log";
  }

  if (focusModeStack.includes("revisions") || focusModeStack.includes("files")) {
    return "revision-log";
  }

  return null;
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
