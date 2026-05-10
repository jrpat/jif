import type {
  AppLayout,
  AppState,
  BookmarkSuggestion,
  ChangedFile,
  CommandBarBookmarkContext,
  CommandBarKind,
  CommandBarState,
  CommandDraftConfig,
  EventLogEntry,
  FailedCommand,
  FocusMode,
  InlineConfirmation,
  InlineConfirmationOptionId,
  OperationLogEntry,
  RepositoryData,
  RevisionSummary,
  SearchScopeId,
  StatusMessage,
  StatusLevel,
} from "../domain/types.ts";
import { getRevisionArg } from "../domain/revisionIds.ts";
import {
  clampSearchIndex,
  getActiveSearchScope,
  getFocusedSearchIndex,
  getSearchMatchItems,
  getSearchScopeForState,
  setFocusedSearchIndex,
  textMatchesQuery,
} from "../search/matching.ts";

export const DRAFT_PLACEHOLDER = "░░░░";
export const INLINE_CONFIRMATION_FILES_PLACEHOLDER = "…files…";
const LAYOUT_CYCLE: readonly AppLayout[] = ["expanded", "condensed", "super-condensed"];

export const draftConfigs = {
  rebase: {
    kind: "rebase" as const,
    template: "rebase ${selected.map(s => `${arg(descendants ? '-s --source' : '-r --revisions')} ${s}`).join(' ')} ${arg('-d --destination')} ${target}",
    badgeText: "onto",
    sourceBadgeText: "move",
  },
  squash: {
    kind: "squash" as const,
    template: "squash ${selected.map(s => `${arg('-f --from')} ${s}`).join(' ')} ${arg('-t --into')} ${target}",
    badgeText: "into",
    sourceBadgeText: "from",
  },
  "bookmark-move-from": {
    kind: "bookmark-move" as const,
    template: "b move ${selected.map(s => `${arg('-f --from')} ${s}`).join(' ')} ${arg('-t --to')} ${target}",
    badgeText: "to",
    sourceBadgeText: "from",
  },
} satisfies Record<string, CommandDraftConfig>;

export type TemplateContext = Readonly<{
  selected: readonly (string | Tagged)[];
  target: string | Tagged;
  descendants: boolean;
  arg: (pair: string) => string;
}>;

export type CommandSegmentStyle = "command" | "selected" | "target" | "placeholder" | "files";

export type CommandSegment = Readonly<{
  text: string;
  style: CommandSegmentStyle;
}>;

const MARKER_START = "\x02";
const MARKER_SEP = "\x03";

export class Tagged {
  constructor(public value: string, public style: CommandSegmentStyle) {}
  toString() {
    if (!this.value) {
      return `${MARKER_START}placeholder${MARKER_SEP}${DRAFT_PLACEHOLDER}${MARKER_START}`;
    }
    return `${MARKER_START}${this.style}${MARKER_SEP}${this.value}${MARKER_START}`;
  }
}

export function evaluateTemplate(template: string, context: TemplateContext): string {
  const keys = Object.keys(context);
  const fn = new Function(...keys, `return \`${template}\``);
  return (fn(...Object.values(context)) as string).replace(/\s+/g, " ").trim();
}

export function buildCommandSegments(
  template: string,
  context: TemplateContext,
): readonly CommandSegment[] {
  const raw = evaluateTemplate(template, context);
  const segments: CommandSegment[] = [];
  let pos = 0;

  while (pos < raw.length) {
    const markerStart = raw.indexOf(MARKER_START, pos);
    if (markerStart === -1) {
      segments.push({ text: raw.slice(pos), style: "command" });
      break;
    }
    if (markerStart > pos) {
      segments.push({ text: raw.slice(pos, markerStart), style: "command" });
    }
    const sepIndex = raw.indexOf(MARKER_SEP, markerStart + 1);
    const markerEnd = raw.indexOf(MARKER_START, sepIndex + 1);
    const style = raw.slice(markerStart + 1, sepIndex) as CommandSegmentStyle;
    const value = raw.slice(sepIndex + 1, markerEnd);
    segments.push({ text: value, style });
    pos = markerEnd + 1;
  }

  return segments;
}

export function createInitialState(
  repoPath: string,
  options?: { useShortFlags?: boolean; layout?: AppLayout; notificationHistoryLimit?: number },
): AppState {
  return {
    repoPath,
    revisions: [],
    operationLogEntries: [],
    operationLogLoading: false,
    focusMode: "revisions",
    focusModeStack: ["revisions"],
    inlineConfirmation: null,
    shortcutPanelExpanded: false,
    focusedRevisionIndex: 0,
    focusedOperationLogIndex: 0,
    expandedRowId: null,
    focusedFileIndex: 0,
    selectedRowIds: [],
    markedRowIds: [],
    selectedFilePaths: [],
    commandBar: createEmptyCommandBar(),
    commandDraft: null,
    lastFailedCommand: null,
    statusMessages: [],
    eventLog: [],
    notificationHistoryLimit: Math.max(1, Math.floor(options?.notificationHistoryLimit ?? 50)),
    focusedNotificationIndex: 0,
    expandedNotificationIds: [],
    loading: true,
    useShortFlags: options?.useShortFlags ?? true,
    layout: options?.layout ?? "expanded",
    revsetQuery: "",
    searchQuery: "",
    searchScope: null,
    searchStartIndex: null,
    diffViewer: null,
    commandBarBookmark: null,
  };
}

export function openDiffViewer(state: AppState, content: string): AppState {
  const nextState = {
    ...state,
    diffViewer: { content },
  };

  return replaceFocusModeStack(nextState, [...state.focusModeStack, "diff-viewer"]);
}

export function closeDiffViewer(state: AppState): AppState {
  if (state.focusMode !== "diff-viewer") {
    return state;
  }

  return replaceFocusModeStack({
    ...state,
    diffViewer: null,
  }, state.focusModeStack.slice(0, -1));
}

export function toggleShortFlags(state: AppState): AppState {
  return { ...state, useShortFlags: !state.useShortFlags };
}

export function cycleLayout(state: AppState): AppState {
  const currentIndex = LAYOUT_CYCLE.indexOf(state.layout);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % LAYOUT_CYCLE.length;
  return { ...state, layout: LAYOUT_CYCLE[nextIndex]! };
}

export function openShortcutPanel(state: AppState): AppState {
  if (state.shortcutPanelExpanded) {
    return state;
  }

  return { ...state, shortcutPanelExpanded: true };
}

export function closeShortcutPanel(state: AppState): AppState {
  if (!state.shortcutPanelExpanded) {
    return state;
  }

  return { ...state, shortcutPanelExpanded: false };
}

export function toggleShortcutPanel(state: AppState): AppState {
  return state.shortcutPanelExpanded
    ? closeShortcutPanel(state)
    : openShortcutPanel(state);
}

export function openRevsetInput(state: AppState): AppState {
  const nextState = { ...state, inlineConfirmation: null };
  return replaceFocusModeStack(nextState, [...getBrowseFocusModeStack(nextState), "revset"]);
}

export function closeRevsetInput(state: AppState): AppState {
  return replaceFocusModeStack(state, getBrowseFocusModeStack(state));
}

export function setRevsetQuery(state: AppState, query: string): AppState {
  return { ...state, revsetQuery: query };
}

export function createEmptyCommandBar(): CommandBarState {
  return {
    kind: "jj",
    text: "",
    manual: false,
  };
}

function createManualCommandBar(kind: CommandBarKind, text: string): CommandBarState {
  return {
    kind,
    text,
    manual: true,
  };
}

export function applyRepositoryData(
  state: AppState,
  repositoryData: RepositoryData,
): AppState {
  const previousRevisions = new Map(
    state.revisions.map((revision) => [revision.rowId, revision] as const),
  );
  const revisions = repositoryData.revisions.map((revision) => ({
    ...revision,
    ...resolveRevisionFiles(previousRevisions.get(revision.rowId), revision),
  }));
  const focusedRevisionIndex = reconcileFocusedRevisionIndex(
    state.revisions,
    state.focusedRevisionIndex,
    revisions,
  );
  const previousExpandedRevision = state.expandedRowId
    ? previousRevisions.get(state.expandedRowId) ?? null
    : null;
  const expandedRowId = state.expandedRowId
    ? reconcileRowId(previousExpandedRevision, revisions)
    : null;
  const inlineConfirmation = state.inlineConfirmation && expandedRowId === state.inlineConfirmation.rowId
    ? state.inlineConfirmation
    : null;

  const rowIdSet = new Set(revisions.map((r) => r.rowId));
  const selectedRowIds = state.selectedRowIds.filter((id) => rowIdSet.has(id));
  const markedRowIds = state.markedRowIds.filter((id) => rowIdSet.has(id));
  const selectedFilePaths =
    state.expandedRowId !== null && expandedRowId !== null
      ? state.selectedFilePaths
      : [];

  return normalizeFocusState({
    ...state,
    repoPath: repositoryData.repoPath,
    revisions,
    inlineConfirmation,
    focusedRevisionIndex,
    expandedRowId,
    focusedFileIndex: clampIndex(state.focusedFileIndex, getExpandedFilesCount(revisions, expandedRowId)),
    selectedRowIds,
    markedRowIds,
    selectedFilePaths,
    loading: false,
  });
}

export function setRevisionFiles(
  state: AppState,
  rowId: string,
  files: readonly ChangedFile[],
): AppState {
  const revisions = state.revisions.map((revision) =>
    revision.rowId === rowId ? { ...revision, files, filesLoaded: true } : revision,
  );

  const filePaths = new Set(files.map((f) => f.path));
  const selectedFilePaths =
    state.expandedRowId === rowId
      ? state.selectedFilePaths.filter((p) => filePaths.has(p))
      : state.selectedFilePaths;

  return {
    ...state,
    revisions,
    selectedFilePaths,
    focusedFileIndex:
      state.expandedRowId === rowId
        ? clampIndex(state.focusedFileIndex, files.length)
        : state.focusedFileIndex,
  };
}

export function moveFocus(state: AppState, delta: number): AppState {
  if (state.focusMode === "command" || state.focusMode === "inline-confirmation") {
    return state;
  }

  if (state.focusMode === "op-log") {
    return {
      ...state,
      focusedOperationLogIndex: clampIndex(
        state.focusedOperationLogIndex + delta,
        state.operationLogEntries.length,
      ),
    };
  }

  if (state.focusMode === "notifications") {
    return {
      ...state,
      focusedNotificationIndex: clampIndex(
        state.focusedNotificationIndex + delta,
        state.eventLog.length,
      ),
    };
  }

  if (state.focusMode === "files" && state.expandedRowId !== null) {
    const revision = getExpandedRevision(state);
    return {
      ...state,
      focusedFileIndex: clampIndex(state.focusedFileIndex + delta, revision?.files.length ?? 0),
    };
  }

  return {
    ...state,
    focusedRevisionIndex: clampIndex(
      state.focusedRevisionIndex + delta,
      state.revisions.length,
    ),
    focusedFileIndex: 0,
  };
}

export function moveFocusToParent(state: AppState): AppState {
  if (state.focusMode === "command" || state.focusMode === "inline-confirmation") {
    return state;
  }

  const parentRevision = getFocusedParentRevision(state);
  if (!parentRevision) {
    return state;
  }

  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
    expandedRowId: null,
    focusedRevisionIndex: state.revisions.findIndex((revision) => revision.rowId === parentRevision.rowId),
    focusedFileIndex: 0,
    selectedFilePaths: [],
  }, ["revisions"]);
}

export function moveFocusToChild(state: AppState): AppState {
  if (state.focusMode === "command" || state.focusMode === "inline-confirmation") {
    return state;
  }

  const childRevision = getFocusedChildRevision(state);
  if (!childRevision) {
    return state;
  }

  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
    expandedRowId: null,
    focusedRevisionIndex: state.revisions.findIndex((revision) => revision.rowId === childRevision.rowId),
    focusedFileIndex: 0,
    selectedFilePaths: [],
  }, ["revisions"]);
}

export function focusRevisionAt(state: AppState, index: number): AppState {
  if (state.revisions.length === 0) {
    return state;
  }

  const clamped = clampIndex(index, state.revisions.length);
  if (clamped === state.focusedRevisionIndex) {
    return state;
  }

  return {
    ...state,
    focusedRevisionIndex: clamped,
    focusedFileIndex: 0,
  };
}

export function focusOperationLogEntryAt(state: AppState, index: number): AppState {
  if (state.operationLogEntries.length === 0) {
    return state;
  }

  const clamped = clampIndex(index, state.operationLogEntries.length);
  if (clamped === state.focusedOperationLogIndex) {
    return state;
  }

  return {
    ...state,
    focusedOperationLogIndex: clamped,
  };
}

export function focusNotificationAt(state: AppState, index: number): AppState {
  if (state.eventLog.length === 0) {
    return state;
  }

  const clamped = clampIndex(index, state.eventLog.length);
  if (clamped === state.focusedNotificationIndex) {
    return state;
  }

  return {
    ...state,
    focusedNotificationIndex: clamped,
  };
}

export function focusWorkingCopy(state: AppState): AppState {
  const index = state.revisions.findIndex((r) => r.marker === "working-copy");
  if (index === -1) {
    return state;
  }
  return {
    ...state,
    focusedRevisionIndex: index,
    focusedFileIndex: 0,
  };
}

export function focusLogBottom(state: AppState): AppState {
  if (state.focusMode === "op-log") {
    if (state.operationLogEntries.length === 0) {
      return state;
    }

    return {
      ...state,
      focusedOperationLogIndex: state.operationLogEntries.length - 1,
    };
  }

  if (state.focusMode === "notifications") {
    if (state.eventLog.length === 0) {
      return state;
    }

    return {
      ...state,
      focusedNotificationIndex: state.eventLog.length - 1,
    };
  }

  if (state.revisions.length === 0) {
    return state;
  }

  return {
    ...state,
    focusedRevisionIndex: state.revisions.length - 1,
    focusedFileIndex: 0,
  };
}

export function openFocusedRevision(state: AppState): AppState {
  const revision = getFocusedRevision(state);
  if (!revision || revision.marker === "elided") {
    return state;
  }

  const nextState = {
    ...state,
    inlineConfirmation: null,
    expandedRowId: revision.rowId,
    focusedFileIndex: 0,
    selectedFilePaths: [],
  };

  return replaceFocusModeStack(nextState, ["revisions", "files"]);
}

export function enterBookmarkLeader(state: AppState): AppState {
  if (state.focusMode === "bookmark") {
    return state;
  }

  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
  }, [...getBrowseFocusModeStack(state), "bookmark"]);
}

export function exitBookmarkLeader(state: AppState): AppState {
  if (state.focusMode !== "bookmark") {
    return state;
  }

  return replaceFocusModeStack(state, getBrowseFocusModeStack(state));
}

export function startBookmarkPrompt(
  state: AppState,
  prefill: string,
  cursorOffset: number,
  options: { focusedRevisionId: string; suggestions: readonly BookmarkSuggestion[] | null },
): AppState {
  const baseStack = state.focusMode === "bookmark"
    ? getBrowseFocusModeStack(state)
    : getBrowseFocusModeStack(state);
  const bookmarkContext: CommandBarBookmarkContext | null = options.suggestions === null
    ? null
    : {
        focusedRevisionId: options.focusedRevisionId,
        initialCursorOffset: cursorOffset,
        suggestions: options.suggestions,
      };

  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
    commandBar: {
      kind: "jj",
      text: prefill,
      manual: true,
    },
    commandBarBookmark: bookmarkContext,
  }, [...baseStack, "command"]);
}

export function clearCommandBarBookmark(state: AppState): AppState {
  if (state.commandBarBookmark === null) {
    return state;
  }
  return { ...state, commandBarBookmark: null };
}

export function openOperationLog(state: AppState): AppState {
  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
    focusedOperationLogIndex: clampIndex(state.focusedOperationLogIndex, state.operationLogEntries.length),
  }, ["revisions", "op-log"]);
}

export function closeOperationLog(state: AppState): AppState {
  if (state.focusMode !== "op-log") {
    return state;
  }

  return replaceFocusModeStack(state, ["revisions"]);
}

export function setOperationLogEntries(
  state: AppState,
  operationLogEntries: readonly OperationLogEntry[],
): AppState {
  return {
    ...state,
    operationLogEntries,
    focusedOperationLogIndex: clampIndex(state.focusedOperationLogIndex, operationLogEntries.length),
  };
}

export function setOperationLogLoading(state: AppState, operationLogLoading: boolean): AppState {
  return {
    ...state,
    operationLogLoading,
  };
}

export function openNotifications(state: AppState): AppState {
  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
    focusedNotificationIndex: 0,
    expandedNotificationIds: [],
  }, ["revisions", "notifications"]);
}

export function closeNotifications(state: AppState): AppState {
  if (state.focusMode !== "notifications") {
    return state;
  }

  return replaceFocusModeStack({
    ...state,
    expandedNotificationIds: [],
  }, ["revisions"]);
}

export function getDisplayedNotifications(state: AppState): readonly EventLogEntry[] {
  return [...state.eventLog].reverse();
}

export function getFocusedNotification(state: AppState): EventLogEntry | null {
  return getDisplayedNotifications(state)[state.focusedNotificationIndex] ?? null;
}

export function expandFocusedNotification(state: AppState): AppState {
  const focused = getFocusedNotification(state);
  if (!focused || state.expandedNotificationIds.includes(focused.id)) {
    return state;
  }

  return {
    ...state,
    expandedNotificationIds: [...state.expandedNotificationIds, focused.id],
  };
}

export function collapseFocusedNotification(state: AppState): AppState {
  const focused = getFocusedNotification(state);
  if (!focused || !state.expandedNotificationIds.includes(focused.id)) {
    return state;
  }

  return {
    ...state,
    expandedNotificationIds: state.expandedNotificationIds.filter((id) => id !== focused.id),
  };
}

export function expandElidedRevision(
  state: AppState,
  elidedIndex: number,
  replacements: readonly RevisionSummary[],
): AppState {
  const revisions = [
    ...state.revisions.slice(0, elidedIndex),
    ...replacements,
    ...state.revisions.slice(elidedIndex + 1),
  ];
  return {
    ...state,
    revisions,
    focusedRevisionIndex: replacements.length > 0 ? elidedIndex : state.focusedRevisionIndex,
  };
}

export function closeFocusedRevision(state: AppState): AppState {
  if (state.expandedRowId === null) {
    return state;
  }

  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
    expandedRowId: null,
    focusedFileIndex: 0,
    selectedFilePaths: [],
  }, ["revisions"]);
}

export function focusCommandBar(state: AppState): AppState {
  const text = getDisplayedCommandText(state);
  const nextState = {
    ...state,
    inlineConfirmation: null,
    commandBar: createManualCommandBar(
      "jj",
      text.length > 0 && !text.endsWith(" ") ? `${text} ` : text,
    ),
  };

  return replaceFocusModeStack(nextState, [...getBrowseFocusModeStack(nextState), "command"]);
}

export function focusShellCommandBar(state: AppState): AppState {
  const nextState = {
    ...state,
    inlineConfirmation: null,
    commandBar: createManualCommandBar("shell", ""),
  };

  return replaceFocusModeStack(nextState, [...getBrowseFocusModeStack(nextState), "command"]);
}

export function blurCommandBar(state: AppState): AppState {
  return replaceFocusModeStack(state, getBrowseFocusModeStack(state));
}

export function setCommandBarText(state: AppState, text: string): AppState {
  const normalizedText = state.commandBar.kind === "jj" && text.startsWith("jj ")
    ? text.slice(3)
    : text;

  return {
    ...state,
    commandBar: createManualCommandBar(state.commandBar.kind, normalizedText),
  };
}

export function cancelCommandState(state: AppState): AppState {
  const nextState = {
    ...state,
    inlineConfirmation: null,
    commandBar: createEmptyCommandBar(),
    commandBarBookmark: null,
    commandDraft: null,
    selectedRowIds: [],
    markedRowIds: [],
    selectedFilePaths: [],
    statusMessages: state.commandDraft ? [] : state.statusMessages,
  };

  return replaceFocusModeStack(nextState, getBrowseFocusModeStack(nextState));
}

export function cancelCommandDraft(state: AppState): AppState {
  return {
    ...state,
    commandBar: createEmptyCommandBar(),
    commandBarBookmark: null,
    commandDraft: null,
    selectedRowIds: [],
    markedRowIds: [],
    statusMessages: state.commandDraft ? [] : state.statusMessages,
  };
}

export function setLastFailedCommand(
  state: AppState,
  failedCommand: FailedCommand,
): AppState {
  return {
    ...state,
    lastFailedCommand: failedCommand,
  };
}

export function clearLastFailedCommand(state: AppState): AppState {
  if (state.lastFailedCommand === null) {
    return state;
  }

  return {
    ...state,
    lastFailedCommand: null,
  };
}

export function openSearch(state: AppState): AppState {
  const searchScope = getSearchScopeForState(state);
  if (searchScope === null) {
    return state;
  }

  const nextState = {
    ...state,
    inlineConfirmation: null,
    searchQuery: "",
    searchScope,
    searchStartIndex: getFocusedSearchIndex(state, searchScope),
  };
  return replaceFocusModeStack(nextState, [...getBrowseFocusModeStack(nextState), "search"]);
}

export function setSearchText(state: AppState, query: string): AppState {
  const searchScope = state.searchScope ?? getSearchScopeForState(state);
  if (searchScope === null) {
    return state;
  }

  if (query === "") {
    return { ...state, searchQuery: "", searchScope };
  }

  const nextState: AppState = {
    ...state,
    searchQuery: query,
    searchScope,
  };

  // Only snap to the first match while the search prompt is the focused input.
  // The prompt remounts whenever an overlay (command bar, etc.) opens and
  // closes over it, and OpenTUI's <input> emits a synthetic INPUT event when
  // its initial `value` is applied — without this guard, that spurious event
  // pulls focus back to the first match every time.
  if (state.focusMode !== "search") {
    return nextState;
  }

  const firstMatchIndex = getSearchMatchItems(nextState, query)[0]?.index ?? -1;
  if (firstMatchIndex < 0) {
    return nextState;
  }

  return setFocusedSearchIndex(nextState, searchScope, firstMatchIndex);
}

export function finalizeSearch(state: AppState): AppState {
  return replaceFocusModeStack({ ...state, searchStartIndex: null }, getBrowseFocusModeStack(state));
}

export function closeSearch(state: AppState): AppState {
  if (state.focusMode === "search") {
    return replaceFocusModeStack({
      ...restoreSearchStartFocus(state),
      searchQuery: "",
      searchScope: null,
      searchStartIndex: null,
    }, getBrowseFocusModeStack(state));
  }

  return {
    ...state,
    searchQuery: "",
    searchScope: null,
    searchStartIndex: null,
  };
}

export function nextSearchMatch(state: AppState): AppState {
  const matches = getSearchMatchIndices(state);
  if (matches.length === 0) return state;
  const searchScope = getActiveSearchScope(state);
  if (searchScope === null) return state;
  const focusedIndex = getFocusedSearchIndex(state, searchScope);

  const next =
    matches.find((i) => i > focusedIndex) ?? matches[0]!;
  return setFocusedSearchIndex(state, searchScope, next);
}

export function prevSearchMatch(state: AppState): AppState {
  const matches = getSearchMatchIndices(state);
  if (matches.length === 0) return state;
  const searchScope = getActiveSearchScope(state);
  if (searchScope === null) return state;
  const focusedIndex = getFocusedSearchIndex(state, searchScope);

  let prev: number | undefined;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i]! < focusedIndex) {
      prev = matches[i];
      break;
    }
  }
  return setFocusedSearchIndex(state, searchScope, prev ?? matches[matches.length - 1]!);
}

export function revisionMatchesSearch(
  revision: RevisionSummary,
  query: string,
): boolean {
  return textMatchesQuery(
    [
      revision.revisionId,
      revision.description.split(/\r?\n/, 1)[0] ?? "",
      ...revision.bookmarks,
      ...revision.workspaces,
    ].join("\n"),
    query,
  );
}

export function getSearchMatchIndices(state: AppState): number[] {
  if (state.searchQuery === "") return [];
  return getSearchMatchItems(state).map((item) => item.index);
}

function restoreSearchStartFocus(state: AppState): AppState {
  if (state.searchScope === null || state.searchStartIndex === null) {
    return state;
  }

  return setFocusedSearchIndex(
    state,
    state.searchScope,
    clampSearchIndex(state, state.searchScope, state.searchStartIndex),
  );
}

export function cancelOrBlurState(state: AppState): AppState {
  if (state.focusMode === "search") {
    return closeSearch(state);
  }

  if (state.focusMode === "command") {
    return cancelCommandState(state);
  }

  if (state.focusMode === "revset") {
    return closeRevsetInput(state);
  }

  if (state.focusMode === "inline-confirmation") {
    return closeInlineConfirmation(state);
  }

  if (state.focusMode === "bookmark") {
    const withoutDraft = state.commandDraft !== null ? cancelCommandDraft(state) : state;
    return exitBookmarkLeader(withoutDraft);
  }

  if (state.shortcutPanelExpanded) {
    return closeShortcutPanel(state);
  }

  if (state.searchQuery !== "") {
    return closeSearch(state);
  }

  const dismissable = state.statusMessages.find((m) => m.level !== "info");
  if (dismissable) {
    return dismissStatusMessage(state, dismissable.id);
  }

  if (state.focusMode === "diff-viewer") {
    return closeDiffViewer(state);
  }

  if (state.focusMode === "notifications") {
    return closeNotifications(state);
  }

  if (state.focusMode === "op-log") {
    return closeOperationLog(state);
  }

  if (state.commandDraft !== null) {
    return cancelCommandDraft(state);
  }

  if (state.selectedRowIds.length > 0) {
    return clearRevisionSelection(state);
  }

  if (state.focusMode === "files") {
    return closeFocusedRevision(state);
  }

  return state;
}

export function clearRevisionSelection(state: AppState): AppState {
  return {
    ...state,
    selectedRowIds: [],
    markedRowIds: [],
  };
}

export function toggleFileSelection(state: AppState): AppState {
  if (state.focusMode !== "files" || state.expandedRowId === null) {
    return state;
  }

  const revision = getExpandedRevision(state);
  if (!revision) {
    return state;
  }

  const file = revision.files[state.focusedFileIndex];
  if (!file) {
    return state;
  }

  const isSelected = state.selectedFilePaths.includes(file.path);
  return {
    ...state,
    focusedFileIndex: isSelected
      ? state.focusedFileIndex
      : clampIndex(state.focusedFileIndex + 1, revision.files.length),
    selectedFilePaths: isSelected
      ? state.selectedFilePaths.filter((p) => p !== file.path)
      : [...state.selectedFilePaths, file.path],
  };
}

export function startCommandDraft(
  state: AppState,
  config: CommandDraftConfig,
  options?: { descendantRevisionIds?: readonly string[]; focusDirection?: "down" | "up" },
): AppState {
  const revision = getFocusedRevision(state);
  if (!revision) {
    return state;
  }

  const hasPreSelection = state.selectedRowIds.length > 0;
  const sourceIds = hasPreSelection
    ? state.selectedRowIds
    : [revision.rowId];
  const direction = options?.focusDirection ?? "down";
  const delta = direction === "up" ? -1 : 1;

  return {
    ...state,
    commandBar: createEmptyCommandBar(),
    inlineConfirmation: null,
    focusedRevisionIndex: hasPreSelection
      ? state.focusedRevisionIndex
      : clampIndex(state.focusedRevisionIndex + delta, state.revisions.length),
    selectedRowIds: sourceIds,
    markedRowIds: hasPreSelection ? state.markedRowIds : [],
    commandDraft: {
      config,
      includeDescendants: false,
      descendantRevisionIds: options?.descendantRevisionIds,
    },
  };
}

export function toggleRebaseDescendants(
  state: AppState,
  descendantIds: readonly string[],
): AppState {
  if (state.commandDraft?.config.kind !== "rebase") {
    return state;
  }

  return {
    ...state,
    commandDraft: {
      ...state.commandDraft,
      includeDescendants: !state.commandDraft.includeDescendants,
      descendantRevisionIds: descendantIds,
    },
  };
}

export function toggleRevisionSelection(state: AppState): AppState {
  const focusedRevision = getFocusedRevision(state);
  if (!focusedRevision) {
    return state;
  }

  const ids = state.selectedRowIds;
  const markedIds = state.markedRowIds;
  const isSelected = ids.includes(focusedRevision.rowId);
  const isMarked = markedIds.includes(focusedRevision.rowId);
  const selectingImplicitDraftSource = state.commandDraft !== null && isSelected && !isMarked;

  return {
    ...state,
    focusedRevisionIndex: isMarked
      ? state.focusedRevisionIndex
      : clampIndex(state.focusedRevisionIndex + 1, state.revisions.length),
    selectedRowIds: selectingImplicitDraftSource
      ? ids
      : isSelected
        ? ids.filter((id) => id !== focusedRevision.rowId)
        : [...ids, focusedRevision.rowId],
    markedRowIds: selectingImplicitDraftSource
      ? [...markedIds, focusedRevision.rowId]
      : isMarked
        ? markedIds.filter((id) => id !== focusedRevision.rowId)
        : [...markedIds, focusedRevision.rowId],
  };
}

export function setLoading(state: AppState, loading: boolean): AppState {
  return {
    ...state,
    loading,
  };
}

export function pushEvent(
  state: AppState,
  text: string,
  level: StatusLevel,
  createdAt = Date.now(),
): AppState {
  const id = `${createdAt}-${state.eventLog.length}`;
  const event: EventLogEntry = {
    id,
    text,
    level,
    createdAt,
  };
  const statusMessage: StatusMessage = {
    id,
    text,
    level,
    createdAt,
    lastInteractedAt: createdAt,
  };

  return {
    ...state,
    statusMessages: [...state.statusMessages, statusMessage],
    eventLog: appendBoundedEvent(state.eventLog, event, state.notificationHistoryLimit),
  };
}

export function pushStatusMessage(
  state: AppState,
  id: string,
  text: string,
  level: StatusLevel,
): AppState {
  const now = Date.now();
  const message: StatusMessage = {
    id,
    text,
    level,
    createdAt: now,
    lastInteractedAt: now,
  };
  return { ...state, statusMessages: [...state.statusMessages, message] };
}

export function updateStatusMessage(
  state: AppState,
  id: string,
  text: string,
  level: StatusLevel,
): AppState {
  const now = Date.now();
  return {
    ...state,
    statusMessages: state.statusMessages.map((m) =>
      m.id === id ? { ...m, text, level, lastInteractedAt: now } : m,
    ),
  };
}

export function touchStatusMessage(
  state: AppState,
  id: string,
  touchedAt = Date.now(),
): AppState {
  let touched = false;
  const statusMessages = state.statusMessages.map((message) => {
    if (message.id !== id) {
      return message;
    }

    touched = true;
    return { ...message, lastInteractedAt: touchedAt };
  });

  return touched ? { ...state, statusMessages } : state;
}

export function logEvent(
  state: AppState,
  text: string,
  level: StatusLevel,
): AppState {
  const createdAt = Date.now();
  const entry: EventLogEntry = {
    id: `${createdAt}-${state.eventLog.length}`,
    text,
    level,
    createdAt,
  };
  return {
    ...state,
    eventLog: appendBoundedEvent(state.eventLog, entry, state.notificationHistoryLimit),
  };
}

function appendBoundedEvent(
  eventLog: readonly EventLogEntry[],
  entry: EventLogEntry,
  limit: number,
): readonly EventLogEntry[] {
  const safeLimit = Math.max(1, Math.floor(limit));
  return [...eventLog, entry].slice(-safeLimit);
}

export function dismissStatusMessage(state: AppState, id?: string): AppState {
  if (state.statusMessages.length === 0) {
    return state;
  }

  const nextMessages =
    id === undefined
      ? state.statusMessages.slice(1)
      : state.statusMessages.filter((message) => message.id !== id);

  if (nextMessages.length === state.statusMessages.length) {
    return state;
  }

  return { ...state, statusMessages: nextMessages };
}

export function clearStatusMessage(state: AppState): AppState {
  if (state.statusMessages.length === 0) {
    return state;
  }

  return { ...state, statusMessages: [] };
}

export function getFocusedRevision(state: AppState): RevisionSummary | null {
  return state.revisions[state.focusedRevisionIndex] ?? null;
}

export function getFocusedOperationLogEntry(state: AppState): OperationLogEntry | null {
  return state.operationLogEntries[state.focusedOperationLogIndex] ?? null;
}

function getParentRevisionForIndex(state: AppState, revisionIndex: number): RevisionSummary | null {
  const focusedRevision = state.revisions[revisionIndex] ?? null;
  if (!focusedRevision) {
    return null;
  }

  let closestParent: RevisionSummary | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const parentRevisionId of focusedRevision.parentRevisionIds ?? []) {
    const candidateIndex = state.revisions.findIndex((revision) => revision.revisionId === parentRevisionId);
    if (candidateIndex === -1) {
      continue;
    }

    const distance = Math.abs(candidateIndex - revisionIndex);
    if (distance < closestDistance) {
      closestParent = state.revisions[candidateIndex] ?? null;
      closestDistance = distance;
    }
  }

  return closestParent;
}

export function getFocusedParentRevision(state: AppState): RevisionSummary | null {
  return getParentRevisionForIndex(state, state.focusedRevisionIndex);
}

export function getFocusedChildRevision(state: AppState): RevisionSummary | null {
  const focusedRevision = getFocusedRevision(state);
  if (!focusedRevision) {
    return null;
  }

  for (let candidateIndex = 0; candidateIndex < state.focusedRevisionIndex; candidateIndex += 1) {
    const candidateRevision = state.revisions[candidateIndex] ?? null;
    if (candidateRevision?.parentRevisionIds?.includes(focusedRevision.revisionId)) {
      return candidateRevision;
    }
  }

  return null;
}

export function getFocusedRevisionArg(state: AppState): string | null {
  const revision = getFocusedRevision(state);
  if (!revision) {
    return null;
  }

  return getRevisionArg(revision.revisionId, revision.changeIdPrefixLength);
}

export function getExpandedRevision(state: AppState): RevisionSummary | null {
  if (!state.expandedRowId) {
    return null;
  }

  return (
    state.revisions.find((revision) => revision.rowId === state.expandedRowId) ?? null
  );
}

export function getInlineConfirmation(state: AppState): InlineConfirmation | null {
  return state.inlineConfirmation ?? null;
}

export function getInlineConfirmationActualCommand(state: AppState): string | null {
  const confirmation = getInlineConfirmation(state);
  if (!confirmation) {
    return null;
  }

  return confirmation.actualCommandByOption[confirmation.selectedOption];
}

export function openInlineConfirmation(
  state: AppState,
  confirmation: InlineConfirmation,
): AppState {
  if (state.expandedRowId !== confirmation.rowId) {
    return state;
  }

  const nextState = {
    ...state,
    inlineConfirmation: confirmation,
    commandBar: createEmptyCommandBar(),
  };

  return replaceFocusModeStack(nextState, [...getBrowseFocusModeStack(nextState), "inline-confirmation"]);
}

export function closeInlineConfirmation(state: AppState): AppState {
  if (!state.inlineConfirmation) {
    return state;
  }

  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
  }, getBrowseFocusModeStack(state));
}

function selectInlineConfirmationOption(
  state: AppState,
  delta: number,
): AppState {
  const confirmation = getInlineConfirmation(state);
  if (!confirmation) {
    return state;
  }

  const currentIndex = Math.max(confirmation.options.indexOf(confirmation.selectedOption), 0);
  const nextIndex = clampIndex(currentIndex + delta, confirmation.options.length);
  const nextOption = confirmation.options[nextIndex] ?? confirmation.selectedOption;
  if (nextOption === confirmation.selectedOption) {
    return state;
  }

  return {
    ...state,
    inlineConfirmation: {
      ...confirmation,
      selectedOption: nextOption,
    },
  };
}

export function selectPreviousInlineConfirmationOption(state: AppState): AppState {
  return selectInlineConfirmationOption(state, -1);
}

export function selectNextInlineConfirmationOption(state: AppState): AppState {
  return selectInlineConfirmationOption(state, 1);
}

export function isFileNavigationActive(state: AppState): boolean {
  return state.focusMode === "files" && state.expandedRowId !== null;
}

export function getCommandTargetRevisionId(state: AppState): string | null {
  if (!state.commandDraft) {
    return null;
  }

  const focusedRevision = getFocusedRevision(state);
  if (!focusedRevision || state.selectedRowIds.includes(focusedRevision.rowId)) {
    return null;
  }

  return focusedRevision.revisionId;
}

export function getCommandChipTextForRevision(
  state: AppState,
  rowId: string,
): string | null {
  if (!state.commandDraft) {
    return null;
  }

  if (getCommandTargetRowId(state) === rowId) {
    return state.commandDraft.config.badgeText;
  }

  if (state.selectedRowIds.includes(rowId)) {
    return state.commandDraft.config.sourceBadgeText;
  }

  return null;
}

export function getCommandTargetRowId(state: AppState): string | null {
  if (!state.commandDraft) {
    return null;
  }

  const focusedRevision = getFocusedRevision(state);
  if (!focusedRevision || state.selectedRowIds.includes(focusedRevision.rowId)) {
    return null;
  }

  return focusedRevision.rowId;
}

export function getMarkedRowIds(state: AppState): ReadonlySet<string> {
  return new Set(state.markedRowIds);
}

export function getSelectedRowIds(state: AppState): ReadonlySet<string> {
  return new Set(state.selectedRowIds);
}

export function getSelectedRevisionIds(state: AppState): readonly string[] {
  return state.selectedRowIds
    .map((rowId) => state.revisions.find((revision) => revision.rowId === rowId)?.revisionId ?? null)
    .filter((revisionId): revisionId is string => revisionId !== null);
}

function buildContext(state: AppState): { template: string; context: TemplateContext } | null {
  if (!state.commandDraft) {
    return null;
  }

  const draft = state.commandDraft;
  const useShort = state.useShortFlags;

  return {
    template: draft.config.template,
    context: {
      selected: state.selectedRowIds.map((id) => revisionPrefixFromRowId(state, id)),
      target: revisionPrefix(state, getCommandTargetRevisionId(state) ?? "") || DRAFT_PLACEHOLDER,
      descendants: draft.config.kind === "rebase" && (draft.includeDescendants ?? false),
      arg: (pair: string) => {
        const [s, l] = pair.split(" ");
        return useShort ? s! : l!;
      },
    },
  };
}

function buildTaggedContext(state: AppState): { template: string; context: TemplateContext } | null {
  const resolved = buildContext(state);
  if (!resolved) return null;

  const { context } = resolved;
  const targetRaw = context.target as string;
  return {
    template: resolved.template,
    context: {
      ...context,
      selected: (context.selected as string[]).map((s) => new Tagged(s, "selected")),
      target: new Tagged(targetRaw === DRAFT_PLACEHOLDER ? "" : targetRaw, "target"),
    },
  };
}

function buildInlineConfirmationCommandSegments(commandText: string): readonly CommandSegment[] {
  const placeholderIndex = commandText.indexOf(INLINE_CONFIRMATION_FILES_PLACEHOLDER);
  if (placeholderIndex === -1) {
    return [{ text: commandText, style: "command" }];
  }

  const segments: CommandSegment[] = [];
  const before = commandText.slice(0, placeholderIndex);
  const after = commandText.slice(placeholderIndex + INLINE_CONFIRMATION_FILES_PLACEHOLDER.length);
  if (before.length > 0) {
    segments.push({ text: before, style: "command" });
  }
  segments.push({ text: INLINE_CONFIRMATION_FILES_PLACEHOLDER, style: "files" });
  if (after.length > 0) {
    segments.push({ text: after, style: "command" });
  }
  return segments;
}

export function getDisplayedCommandText(state: AppState): string {
  if (state.commandBar.manual) {
    return state.commandBar.text;
  }

  const inlineConfirmation = getInlineConfirmation(state);
  if (inlineConfirmation) {
    return inlineConfirmation.previewCommandByOption[inlineConfirmation.selectedOption];
  }

  const resolved = buildContext(state);
  if (!resolved) {
    return "";
  }

  return evaluateTemplate(resolved.template, resolved.context);
}

export function getDisplayedCommandSegments(state: AppState): readonly CommandSegment[] | null {
  if (state.commandBar.manual) {
    return null;
  }

  const inlineConfirmation = getInlineConfirmation(state);
  if (inlineConfirmation) {
    return buildInlineConfirmationCommandSegments(
      inlineConfirmation.previewCommandByOption[inlineConfirmation.selectedOption],
    );
  }

  const resolved = buildTaggedContext(state);
  if (!resolved) {
    return null;
  }

  return buildCommandSegments(resolved.template, resolved.context);
}

function revisionPrefix(state: AppState, revisionId: string): string {
  if (!revisionId) {
    return "";
  }

  const revision = state.revisions.find((r) => r.revisionId === revisionId);
  if (!revision) {
    return revisionId;
  }

  return getRevisionArg(revision.revisionId, revision.changeIdPrefixLength);
}

function revisionPrefixFromRowId(state: AppState, rowId: string): string {
  if (!rowId) {
    return "";
  }

  const revision = state.revisions.find((r) => r.rowId === rowId);
  if (!revision) {
    return rowId;
  }

  return getRevisionArg(revision.revisionId, revision.changeIdPrefixLength);
}

export function getOperationAffectedRowIds(state: AppState): ReadonlySet<string> {
  if (!state.commandDraft) {
    return new Set();
  }

  if (state.commandDraft.config.kind === "rebase" && state.commandDraft.includeDescendants && state.commandDraft.descendantRevisionIds) {
    return new Set(
      state.revisions
        .filter((revision) => state.commandDraft?.descendantRevisionIds?.includes(revision.revisionId))
        .map((revision) => revision.rowId),
    );
  }

  return new Set(state.selectedRowIds);
}

export function commandCanExecute(state: AppState): boolean {
  if (state.commandBar.manual) {
    return state.commandBar.text.trim().length > 0;
  }

  if (state.inlineConfirmation) {
    return true;
  }

  if (!state.commandDraft) {
    return false;
  }

  if (state.commandDraft.config.template.includes("${target}")) {
    return getCommandTargetRevisionId(state) !== null;
  }

  return state.selectedRowIds.length > 0;
}

function getExpandedFilesCount(
  revisions: readonly RevisionSummary[],
  expandedRowId: string | null,
): number {
  if (!expandedRowId) {
    return 0;
  }

  return revisions.find((revision) => revision.rowId === expandedRowId)?.files.length ?? 0;
}

function reconcileRowId(
  previous: RevisionSummary | null | undefined,
  revisions: readonly RevisionSummary[],
): string | null {
  if (!previous) {
    return null;
  }
  if (revisions.some((revision) => revision.rowId === previous.rowId)) {
    return previous.rowId;
  }
  const byRevisionId = revisions.find(
    (revision) => revision.revisionId === previous.revisionId,
  );
  return byRevisionId?.rowId ?? null;
}

function reconcileFocusedRevisionIndex(
  previousRevisions: readonly RevisionSummary[],
  previousFocusedIndex: number,
  nextRevisions: readonly RevisionSummary[],
): number {
  if (nextRevisions.length === 0) {
    return 0;
  }

  const findInNext = (revision: RevisionSummary | undefined): number => {
    if (!revision) return -1;
    const byRowId = nextRevisions.findIndex((r) => r.rowId === revision.rowId);
    if (byRowId !== -1) return byRowId;
    return nextRevisions.findIndex((r) => r.revisionId === revision.revisionId);
  };

  const direct = findInNext(previousRevisions[previousFocusedIndex]);
  if (direct !== -1) return direct;

  for (let offset = 1; offset < previousRevisions.length; offset++) {
    const nextIdx = previousFocusedIndex + offset;
    if (nextIdx < previousRevisions.length) {
      const found = findInNext(previousRevisions[nextIdx]);
      if (found !== -1) return found;
    }
    const prevIdx = previousFocusedIndex - offset;
    if (prevIdx >= 0) {
      const found = findInNext(previousRevisions[prevIdx]);
      if (found !== -1) return found;
    }
  }

  return 0;
}

function resolveRevisionFiles(
  previous: RevisionSummary | undefined,
  next: RevisionSummary,
): Pick<RevisionSummary, "files" | "filesLoaded"> {
  if (next.isEmpty || next.marker === "elided") {
    return {
      files: [],
      filesLoaded: true,
    };
  }

  if (!previous || !previous.filesLoaded) {
    return {
      files: next.files,
      filesLoaded: next.filesLoaded,
    };
  }

  return {
    files: previous.files,
    filesLoaded: previous.filesLoaded,
  };
}

function getBrowseFocusMode(state: AppState): FocusMode {
  return getBrowseFocusModeStack(state).at(-1) ?? "revisions";
}

function getBrowseFocusModeStack(
  state: Pick<AppState, "expandedRowId" | "focusModeStack">,
): readonly FocusMode[] {
  if (state.focusModeStack.includes("op-log")) {
    return ["revisions", "op-log"];
  }

  return state.expandedRowId !== null ? ["revisions", "files"] : ["revisions"];
}

function replaceFocusModeStack(
  state: AppState,
  focusModeStack: readonly FocusMode[],
): AppState {
  return normalizeFocusState({
    ...state,
    focusMode: focusModeStack.at(-1) ?? "revisions",
    focusModeStack: [...focusModeStack],
  });
}

function normalizeFocusState(state: AppState): AppState {
  const focusModeStack = normalizeFocusModeStack(resolveFocusModeStack(state), state);
  const focusMode = focusModeStack.at(-1) ?? "revisions";

  if (
    state.focusMode === focusMode &&
    state.focusModeStack.length === focusModeStack.length &&
    state.focusModeStack.every((mode, index) => mode === focusModeStack[index])
  ) {
    return state;
  }

  return {
    ...state,
    focusMode,
    focusModeStack,
  };
}

function resolveFocusModeStack(state: AppState): FocusMode[] {
  const stack = state.focusModeStack.length > 0
    ? [...state.focusModeStack]
    : [state.focusMode];
  const currentModeIndex = stack.lastIndexOf(state.focusMode);

  if (currentModeIndex === -1) {
    stack.push(state.focusMode);
  } else if (currentModeIndex !== stack.length - 1) {
    stack.splice(currentModeIndex + 1);
  }

  return stack;
}

function normalizeFocusModeStack(
  stack: readonly FocusMode[],
  state: Pick<AppState, "expandedRowId" | "inlineConfirmation" | "diffViewer">,
): FocusMode[] {
  const nextStack = stack.filter((mode) => {
    if (mode === "files") {
      return state.expandedRowId !== null;
    }

    if (mode === "inline-confirmation") {
      return state.expandedRowId !== null && state.inlineConfirmation !== null;
    }

    if (mode === "diff-viewer") {
      return state.diffViewer !== null;
    }

    return true;
  }).filter((mode, index) => mode !== "revisions" || index === 0);

  if (nextStack.length === 0) {
    return ["revisions"];
  }

  if (nextStack[0] === "revisions") {
    return nextStack;
  }

  return ["revisions", ...nextStack.filter((mode) => mode !== "revisions")];
}

function clampIndex(value: number, size: number): number {
  if (size <= 0) {
    return 0;
  }

  return Math.min(Math.max(value, 0), size - 1);
}
