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

type FocusMode = AppState["focusMode"];
type SearchScopeDefinition = Readonly<{
  scope: SearchScopeId;
  focusModes: readonly FocusMode[];
  getFocusedIndex: (state: AppState) => number;
  setFocusedIndex: (state: AppState, index: number) => AppState;
  getItemCount: (state: AppState) => number;
  getSearchableItems: (state: AppState) => readonly SearchableItem[];
}>;

type MatchMode = Readonly<{ idOnly: boolean }>;

function matchModeForState(
  state: Pick<AppState, "searchScope" | "searchIdOnly">,
): MatchMode {
  return { idOnly: state.searchScope === "revision-log" && state.searchIdOnly };
}

const ANSI_ESCAPE_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const SEARCH_SCOPE_DEFINITIONS: Readonly<Record<SearchScopeId, SearchScopeDefinition>> = {
  "revision-log": {
    scope: "revision-log",
    focusModes: ["revisions", "files"],
    getFocusedIndex: (state) => state.focusedRevisionIndex,
    setFocusedIndex: (state, index) => ({ ...state, focusedRevisionIndex: index }),
    getItemCount: (state) => state.revisions.length,
    getSearchableItems: (state) => state.revisions.map((revision, index) =>
      createRevisionSearchableItem(revision, index, state.searchIdOnly)
    ),
  },
  "operation-log": {
    scope: "operation-log",
    focusModes: ["op-log"],
    getFocusedIndex: (state) => state.focusedOperationLogIndex,
    setFocusedIndex: (state, index) => ({ ...state, focusedOperationLogIndex: index }),
    getItemCount: (state) => state.operationLogEntries.length,
    getSearchableItems: (state) => state.operationLogEntries.map((entry, index) =>
      createOperationLogSearchableItem(entry, index)
    ),
  },
  "evolog": {
    scope: "evolog",
    focusModes: ["evolog"],
    getFocusedIndex: (state) => state.focusedEvologIndex,
    setFocusedIndex: (state, index) => ({ ...state, focusedEvologIndex: index }),
    getItemCount: (state) => state.evologEntries.length,
    getSearchableItems: (state) => state.evologEntries.map((entry, index) =>
      createEvologSearchableItem(entry, index)
    ),
  },
};
const SEARCH_SCOPE_LIST = Object.values(SEARCH_SCOPE_DEFINITIONS);
const SEARCH_VISIBLE_THROUGH_FOCUS_MODES = new Set<AppState["focusMode"]>([
  "command",
  "inline-confirmation",
  "revset",
  "search",
]);

export function getSearchScopeForState(
  state: Pick<AppState, "focusMode">,
): SearchScopeId | null {
  return getSearchScopeForFocusMode(state.focusMode);
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
  return scope === null ? [] : SEARCH_SCOPE_DEFINITIONS[scope].getSearchableItems(state);
}

export function getFocusedSearchIndex(state: AppState, scope: SearchScopeId): number {
  return SEARCH_SCOPE_DEFINITIONS[scope].getFocusedIndex(state);
}

export function setFocusedSearchIndex(
  state: AppState,
  scope: SearchScopeId,
  index: number,
): AppState {
  return SEARCH_SCOPE_DEFINITIONS[scope].setFocusedIndex(state, index);
}

export function clampSearchIndex(
  state: AppState,
  scope: SearchScopeId,
  index: number,
): number {
  const size = SEARCH_SCOPE_DEFINITIONS[scope].getItemCount(state);
  if (size <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), size - 1);
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

function getSearchScopeFromStack(focusModeStack: readonly FocusMode[]): SearchScopeId | null {
  for (let index = focusModeStack.length - 1; index >= 0; index--) {
    const scope = getSearchScopeForFocusMode(focusModeStack[index]!);
    if (scope !== null) {
      return scope;
    }
  }

  return null;
}

function getSearchScopeForFocusMode(focusMode: FocusMode): SearchScopeId | null {
  return SEARCH_SCOPE_LIST.find((definition) =>
    definition.focusModes.includes(focusMode)
  )?.scope ?? null;
}

export function getSearchMatchItems(
  state: AppState,
  query = state.searchQuery,
): readonly SearchableItem[] {
  if (query.length === 0) {
    return [];
  }

  const mode = matchModeForState(state);
  return getSearchableItems(state).filter((item) => textMatchesQuery(item.text, query, mode));
}

export function getSearchMatchItemIds(state: AppState): ReadonlySet<string> {
  return new Set(getSearchMatchItems(state).map((item) => item.id));
}

export function getMatchModeForState(
  state: Pick<AppState, "searchScope" | "searchIdOnly">,
): MatchMode {
  return matchModeForState(state);
}

export function textMatchesQuery(
  text: string,
  query: string,
  mode: MatchMode = { idOnly: false },
): boolean {
  if (query.length === 0) {
    return false;
  }

  if (mode.idOnly) {
    return text.toLowerCase().startsWith(query.toLowerCase());
  }

  return text.toLowerCase().includes(query.toLowerCase());
}

export function findTextMatchRanges(
  text: string,
  query: string,
  mode: MatchMode = { idOnly: false },
): readonly TextMatchRange[] {
  if (query.length === 0) {
    return [];
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (mode.idOnly) {
    return lowerText.startsWith(lowerQuery)
      ? [{ start: 0, end: query.length }]
      : [];
  }

  const ranges: TextMatchRange[] = [];
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
  idOnly: boolean,
): SearchableItem {
  return {
    scope: "revision-log",
    id: `revision-${revision.rowId}`,
    index,
    text: idOnly
      ? revision.revisionId
      : [
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

function createEvologSearchableItem(
  entry: OperationLogEntry,
  index: number,
): SearchableItem {
  return {
    scope: "evolog",
    id: `evolog-entry-${index}`,
    index,
    text: entry.lines.map(stripAnsi).join("\n"),
  };
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0] ?? "";
}
