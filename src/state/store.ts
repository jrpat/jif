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
  RebaseSourceKind,
  RebaseTargetKind,
  RepositoryData,
  RevisionSummary,
  SearchScopeId,
  StatusMessage,
  StatusLevel,
  StatusMessageVariant,
} from "../domain/types.ts";
import { getChangeIdFromRevisionId, getRevisionArg, isDivergentRevisionId } from "../domain/revisionIds.ts";
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
const LAYOUT_CYCLE: readonly AppLayout[] = ["loose", "normal", "tight"];

export const draftConfigs = {
  rebase: {
    kind: "rebase" as const,
    template: "rebase ${selected.map(s => `${sourceFlag()} ${s}`).join(' ')} ${targetFlags()}${skipEmptied ? ' ' + arg('--skip-emptied --skip-emptied') : ''}${forceApply ? ' ' + arg('--ignore-immutable --ignore-immutable') : ''}",
    badgeText: "onto",
    sourceBadgeText: "move",
  },
  squash: {
    kind: "squash" as const,
    template: "squash ${selected.map(s => `${arg('-f --from')} ${s}${anchorSuffix}`).join(' ')} ${arg('-t --into')} ${target}",
    badgeText: "into",
    sourceBadgeText: "from",
  },
  "bookmark-move-from": {
    kind: "bookmark-move" as const,
    template: "b move ${selected.map(s => `${arg('-f --from')} ${s}`).join(' ')} ${arg('-t --to')} ${target}",
    badgeText: "to",
    sourceBadgeText: "from",
  },
  restore: {
    kind: "restore" as const,
    template: "restore ${selected.map(s => `${arg('-f --from')} ${s}`).join(' ')} ${arg('-t --to')} ${target}",
    badgeText: "to",
    sourceBadgeText: "from",
  },
  interdiff: {
    kind: "interdiff" as const,
    template: "interdiff ${selected.map(s => `${arg(swapped ? '-t --to' : '-f --from')} ${s}`).join(' ')} ${arg(swapped ? '-f --from' : '-t --to')} ${target}",
    badgeText: "to",
    sourceBadgeText: "from",
  },
  diff: {
    kind: "diff" as const,
    template: "diff ${selected.map(s => `${arg('-f --from')} ${s}`).join(' ')} ${arg('-t --to')} ${target}",
    badgeText: "to",
    sourceBadgeText: "from",
  },
  absorb: {
    kind: "absorb" as const,
    template: "absorb${absorbFromSource ? ` ${arg('-f --from')} ${absorbSource}` : ''}${absorbConstrained ? ` ${arg('-t --into')} ${absorbTargets}` : ''}",
    badgeText: "into",
    sourceBadgeText: "into",
  },
  "set-parents": {
    kind: "set-parents" as const,
    template: "rebase ${arg('-r --revisions')} ${subject} ${destinations.map(d => `${arg('-d --destination')} ${d}`).join(' ')}",
    badgeText: "parent",
    sourceBadgeText: "parent",
  },
} satisfies Record<string, CommandDraftConfig>;

export type TemplateContext = Readonly<{
  selected: readonly (string | Tagged)[];
  target: string | Tagged;
  subject: string | Tagged;
  destinations: readonly (string | Tagged)[];
  anchorSuffix: string;
  arg: (pair: string) => string;
  sourceFlag: () => string;
  targetFlags: () => string;
  skipEmptied: boolean;
  forceApply: boolean;
  swapped: boolean;
  absorbConstrained: boolean;
  absorbTargets: string | Tagged;
  absorbFromSource: boolean;
  absorbSource: string | Tagged;
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
    evologEntries: [],
    evologLoading: false,
    evologRevisionLabel: "",
    focusMode: "revisions",
    focusModeStack: ["revisions"],
    inlineConfirmation: null,
    shortcutPanelExpanded: false,
    focusedRevisionIndex: 0,
    focusedOperationLogIndex: 0,
    focusedEvologIndex: 0,
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
    lastRefreshedAt: Date.now(),
    useShortFlags: options?.useShortFlags ?? true,
    layout: options?.layout ?? "loose",
    revsetQuery: "",
    searchQuery: "",
    searchScope: null,
    searchStartIndex: null,
    searchIdOnly: false,
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
    lastRefreshedAt: Date.now(),
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

  if (state.focusMode === "evolog") {
    return {
      ...state,
      focusedEvologIndex: clampIndex(
        state.focusedEvologIndex + delta,
        state.evologEntries.length,
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

export function moveFocusToNextDivergentSibling(state: AppState): AppState {
  const nextIndex = getNextDivergentSiblingIndex(state);
  if (nextIndex === null) {
    return state;
  }

  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
    expandedRowId: null,
    focusedRevisionIndex: nextIndex,
    focusedFileIndex: 0,
    selectedFilePaths: [],
  }, ["revisions"]);
}

function getAdjacentRevisionIndex(
  state: AppState,
  direction: 1 | -1,
  matches: (revision: RevisionSummary) => boolean,
): number | null {
  const total = state.revisions.length;
  for (
    let index = state.focusedRevisionIndex + direction;
    index >= 0 && index < total;
    index += direction
  ) {
    const candidate = state.revisions[index];
    if (!candidate) continue;
    if (candidate.marker === "elided") continue;
    if (matches(candidate)) {
      return index;
    }
  }

  return null;
}

export function getAdjacentWorkspaceRevisionIndex(
  state: AppState,
  direction: 1 | -1,
): number | null {
  return getAdjacentRevisionIndex(state, direction, (revision) => revision.workspaces.length > 0);
}

export function getAdjacentBookmarkRevisionIndex(
  state: AppState,
  direction: 1 | -1,
): number | null {
  return getAdjacentRevisionIndex(state, direction, (revision) => revision.bookmarks.length > 0);
}

function moveFocusToIndex(state: AppState, nextIndex: number | null): AppState {
  if (nextIndex === null) {
    return state;
  }

  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
    expandedRowId: null,
    focusedRevisionIndex: nextIndex,
    focusedFileIndex: 0,
    selectedFilePaths: [],
  }, ["revisions"]);
}

export function moveFocusToWorkspace(state: AppState, direction: 1 | -1): AppState {
  return moveFocusToIndex(state, getAdjacentWorkspaceRevisionIndex(state, direction));
}

export function moveFocusToBookmark(state: AppState, direction: 1 | -1): AppState {
  return moveFocusToIndex(state, getAdjacentBookmarkRevisionIndex(state, direction));
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

  if (state.focusMode === "evolog") {
    if (state.evologEntries.length === 0) {
      return state;
    }

    return {
      ...state,
      focusedEvologIndex: state.evologEntries.length - 1,
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

export function enterExtraMode(state: AppState): AppState {
  if (state.focusMode === "extra") {
    return state;
  }

  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
  }, [...getBrowseFocusModeStack(state), "extra"]);
}

export function exitExtraMode(state: AppState): AppState {
  if (state.focusMode !== "extra") {
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

export function openEvolog(state: AppState, revisionLabel: string): AppState {
  return replaceFocusModeStack({
    ...state,
    inlineConfirmation: null,
    evologRevisionLabel: revisionLabel,
    focusedEvologIndex: 0,
  }, ["revisions", "evolog"]);
}

export function closeEvolog(state: AppState): AppState {
  if (state.focusMode !== "evolog") {
    return state;
  }

  return replaceFocusModeStack(state, ["revisions"]);
}

export function setEvologEntries(
  state: AppState,
  evologEntries: readonly OperationLogEntry[],
): AppState {
  return {
    ...state,
    evologEntries,
    focusedEvologIndex: clampIndex(state.focusedEvologIndex, evologEntries.length),
  };
}

export function setEvologLoading(state: AppState, evologLoading: boolean): AppState {
  return {
    ...state,
    evologLoading,
  };
}

export function focusEvologEntryAt(state: AppState, index: number): AppState {
  if (state.evologEntries.length === 0) {
    return state;
  }

  const clamped = clampIndex(index, state.evologEntries.length);
  if (clamped === state.focusedEvologIndex) {
    return state;
  }

  return {
    ...state,
    focusedEvologIndex: clamped,
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

  const hasLiveQuery = state.searchQuery !== "" && state.searchScope === searchScope;
  const nextState = {
    ...state,
    inlineConfirmation: null,
    searchQuery: hasLiveQuery ? state.searchQuery : "",
    searchScope,
    searchStartIndex: getFocusedSearchIndex(state, searchScope),
    searchIdOnly: hasLiveQuery ? state.searchIdOnly : false,
  };
  return replaceFocusModeStack(nextState, [...getBrowseFocusModeStack(nextState), "search"]);
}

export function toggleSearchIdOnly(state: AppState): AppState {
  const searchScope = state.searchScope ?? getSearchScopeForState(state);
  if (searchScope === null) {
    return state;
  }

  const nextState: AppState = {
    ...state,
    searchIdOnly: !state.searchIdOnly,
    searchScope,
  };

  if (state.searchQuery === "" || state.focusMode !== "search") {
    return nextState;
  }

  const firstMatchIndex = getSearchMatchItems(nextState, state.searchQuery)[0]?.index ?? -1;
  if (firstMatchIndex < 0) {
    return nextState;
  }

  return setFocusedSearchIndex(nextState, searchScope, firstMatchIndex);
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
      searchIdOnly: false,
    }, getBrowseFocusModeStack(state));
  }

  return {
    ...state,
    searchQuery: "",
    searchScope: null,
    searchStartIndex: null,
    searchIdOnly: false,
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

  if (state.focusMode === "extra") {
    const withoutDraft = state.commandDraft !== null ? cancelCommandDraft(state) : state;
    return exitExtraMode(withoutDraft);
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

  if (state.focusMode === "evolog") {
    return closeEvolog(state);
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

export function selectAllFiles(state: AppState): AppState {
  if (state.focusMode !== "files" || state.expandedRowId === null) {
    return state;
  }

  const revision = getExpandedRevision(state);
  if (!revision || revision.files.length === 0) {
    return state;
  }

  const allPaths = revision.files.map((file) => file.path);
  const allSelected = allPaths.every((path) => state.selectedFilePaths.includes(path));

  return {
    ...state,
    selectedFilePaths: allSelected ? [] : allPaths,
  };
}

export function startCommandDraft(
  state: AppState,
  config: CommandDraftConfig,
  options?: {
    descendantRevisionIds?: readonly string[];
    focusDirection?: "down" | "up";
    presetRevisionIds?: readonly string[];
    absorbSourceRevisionId?: string;
  },
): AppState {
  const revision = getFocusedRevision(state);
  if (!revision) {
    return state;
  }

  if (options?.presetRevisionIds) {
    const presetRowIds = state.revisions
      .filter((candidate) => options.presetRevisionIds!.includes(candidate.revisionId))
      .map((candidate) => candidate.rowId);

    return {
      ...state,
      commandBar: createEmptyCommandBar(),
      inlineConfirmation: null,
      selectedRowIds: presetRowIds,
      markedRowIds: presetRowIds,
      commandDraft: {
        config,
        absorbDefaultRowIds: presetRowIds,
        absorbSourceRevisionId: options.absorbSourceRevisionId,
      },
    };
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
      descendantRevisionIds: options?.descendantRevisionIds,
    },
  };
}

// The "squash onto" entry keeps the focused revision as the `-t` target rather
// than selecting it as a source, and selects the whole branch above it as the
// source. The source anchor is the lowest (bottom-most) selected revision when
// there is a selection, otherwise the revision directly above the focus; the
// source then extends to that anchor plus every descendant of it shown above
// (the branch heading toward the working copy). Every source revision is a real
// selection, so the rows render as selected rather than relying on a `::@` range
// — which is empty whenever the branch above is not an ancestor of `@`.
export function startSquashOnto(state: AppState): AppState {
  const focused = getFocusedRevision(state);
  if (!focused) {
    return state;
  }

  const sourceRowIds = resolveSquashOntoSourceRowIds(state);
  if (sourceRowIds.length === 0) {
    return state;
  }

  return {
    ...state,
    commandBar: createEmptyCommandBar(),
    inlineConfirmation: null,
    selectedRowIds: sourceRowIds,
    markedRowIds: [],
    commandDraft: {
      config: draftConfigs.squash,
    },
  };
}

function resolveSquashOntoAnchorIndex(state: AppState): number {
  if (state.selectedRowIds.length > 0) {
    let anchorIndex = -1;
    for (const rowId of state.selectedRowIds) {
      const index = state.revisions.findIndex((revision) => revision.rowId === rowId);
      if (index > anchorIndex) {
        anchorIndex = index;
      }
    }
    return anchorIndex;
  }

  const aboveIndex = state.focusedRevisionIndex - 1;
  return aboveIndex >= 0 && aboveIndex < state.revisions.length ? aboveIndex : -1;
}

function resolveSquashOntoSourceRowIds(state: AppState): readonly string[] {
  const anchorIndex = resolveSquashOntoAnchorIndex(state);
  const anchor = state.revisions[anchorIndex];
  if (!anchor) {
    return [];
  }

  // Collect the anchor plus every revision above it that descends from it, so
  // the source covers the contiguous branch heading up out of the anchor.
  const sourceRevisionIds = new Set<string>([anchor.revisionId]);
  const rowIds: string[] = [anchor.rowId];
  for (let index = anchorIndex - 1; index >= 0; index--) {
    const revision = state.revisions[index];
    if (revision?.parentRevisionIds?.some((parentId) => sourceRevisionIds.has(parentId))) {
      sourceRevisionIds.add(revision.revisionId);
      rowIds.push(revision.rowId);
    }
  }

  // Order top-to-bottom (ascending row index) for a stable, readable command.
  return rowIds.reverse();
}

// Set-parents keeps a fixed subject (the revision focused when the mode opened)
// and lets the cursor roam to toggle a working set of parent picks. Each pick
// XORs against the subject's current parents: toggling an existing parent
// removes it, toggling any other revision adds it. The picks start empty so the
// preview shows today's parents until the user changes something.
export function startSetParents(state: AppState): AppState {
  const subject = getFocusedRevision(state);
  if (!subject) {
    return state;
  }

  return {
    ...state,
    commandBar: createEmptyCommandBar(),
    inlineConfirmation: null,
    selectedRowIds: [],
    markedRowIds: [],
    commandDraft: {
      config: draftConfigs["set-parents"],
      setParentsSubjectRevisionId: subject.revisionId,
    },
  };
}

export function toggleSetParentsPick(state: AppState): AppState {
  if (state.commandDraft?.config.kind !== "set-parents") {
    return state;
  }

  const focused = getFocusedRevision(state);
  if (!focused) {
    return state;
  }

  // A revision cannot become its own parent, so the subject is never a pick.
  if (focused.revisionId === state.commandDraft.setParentsSubjectRevisionId) {
    return state;
  }

  const isSelected = state.selectedRowIds.includes(focused.rowId);
  const nextSelected = isSelected
    ? state.selectedRowIds.filter((id) => id !== focused.rowId)
    : [...state.selectedRowIds, focused.rowId];

  return {
    ...state,
    // Advance past a newly added pick like normal multi-select; hold on removal
    // so the same row can be toggled back without re-navigating.
    focusedRevisionIndex: isSelected
      ? state.focusedRevisionIndex
      : clampIndex(state.focusedRevisionIndex + 1, state.revisions.length),
    selectedRowIds: nextSelected,
    markedRowIds: nextSelected,
  };
}

function getSetParentsSubject(state: AppState): RevisionSummary | null {
  const draft = state.commandDraft;
  if (!draft || draft.config.kind !== "set-parents" || !draft.setParentsSubjectRevisionId) {
    return null;
  }
  return state.revisions.find((revision) => revision.revisionId === draft.setParentsSubjectRevisionId) ?? null;
}

// The new parent set is the subject's current parents XOR the toggled picks:
// untoggled parents stay, toggled parents drop, toggled non-parents join. Picks
// are always visible rows, so an off-graph parent only ever survives untouched.
function getSetParentsDestinationRevisionIds(state: AppState): readonly string[] {
  const draft = state.commandDraft;
  if (!draft || draft.config.kind !== "set-parents") {
    return [];
  }

  const subject = getSetParentsSubject(state);
  const existingParents = subject?.parentRevisionIds ?? [];
  const toggledRevisionIds = new Set(getSelectedRevisionIds(state));
  const existingSet = new Set(existingParents);

  const kept = existingParents.filter((parentId) => !toggledRevisionIds.has(parentId));
  const added = getSelectedRevisionIds(state).filter((revisionId) => !existingSet.has(revisionId));
  return [...kept, ...added];
}

export function setRebaseSourceKind(
  state: AppState,
  kind: RebaseSourceKind,
  descendantIds?: readonly string[],
): AppState {
  if (state.commandDraft?.config.kind !== "rebase") {
    return state;
  }

  const currentKind = state.commandDraft.rebaseSourceKind ?? "revisions";
  const nextKind = currentKind === kind ? "revisions" : kind;

  return {
    ...state,
    commandDraft: {
      ...state.commandDraft,
      rebaseSourceKind: nextKind === "revisions" ? undefined : nextKind,
      descendantRevisionIds: nextKind === "source"
        ? descendantIds ?? state.commandDraft.descendantRevisionIds
        : state.commandDraft.descendantRevisionIds,
    },
  };
}

export function setRebaseTargetKind(
  state: AppState,
  kind: RebaseTargetKind,
): AppState {
  if (state.commandDraft?.config.kind !== "rebase") {
    return state;
  }

  const currentKind = state.commandDraft.rebaseTargetKind ?? "destination";
  const nextKind = currentKind === kind ? "destination" : kind;
  const focused = getFocusedRevision(state);

  return {
    ...state,
    commandDraft: {
      ...state.commandDraft,
      rebaseTargetKind: nextKind === "destination" ? undefined : nextKind,
      rebaseInsertAfterRevisionId: nextKind === "insert-between" && focused
        ? focused.revisionId
        : undefined,
    },
  };
}

export function toggleRebaseSkipEmptied(state: AppState): AppState {
  if (state.commandDraft?.config.kind !== "rebase") {
    return state;
  }

  return {
    ...state,
    commandDraft: {
      ...state.commandDraft,
      rebaseSkipEmptied: !state.commandDraft.rebaseSkipEmptied,
    },
  };
}

export function toggleInterdiffSwap(state: AppState): AppState {
  if (state.commandDraft?.config.kind !== "interdiff") {
    return state;
  }

  return {
    ...state,
    commandDraft: {
      ...state.commandDraft,
      interdiffSwapped: !state.commandDraft.interdiffSwapped,
    },
  };
}

export function toggleSquashAnchor(
  state: AppState,
  anchorIds: readonly string[] = [],
): AppState {
  if (state.commandDraft?.config.kind !== "squash") {
    return state;
  }

  return {
    ...state,
    commandDraft: {
      ...state.commandDraft,
      includeAnchor: !state.commandDraft.includeAnchor,
      anchorRevisionIds: anchorIds,
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
  // In absorb mode the candidates start marked, so unmarking one would normally
  // pin the focus. Reviewers step through the preselected list, so advance the
  // focus on every toggle regardless of direction, mirroring normal selection.
  const isAbsorbDraft = state.commandDraft?.config.kind === "absorb";

  return {
    ...state,
    focusedRevisionIndex: isMarked && !isAbsorbDraft
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

// Showing a new toast retires any visible help toast: help output is a modal
// aside, so the next piece of feedback supersedes it rather than stacking on top.
function dismissHelpToasts(
  messages: readonly StatusMessage[],
): readonly StatusMessage[] {
  return messages.filter((message) => message.variant !== "help");
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
    statusMessages: [...dismissHelpToasts(state.statusMessages), statusMessage],
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
  return { ...state, statusMessages: [...dismissHelpToasts(state.statusMessages), message] };
}

export function updateStatusMessage(
  state: AppState,
  id: string,
  text: string,
  level: StatusLevel,
  variant?: StatusMessageVariant,
): AppState {
  const now = Date.now();
  return {
    ...state,
    statusMessages: state.statusMessages.map((m) =>
      m.id === id ? { ...m, text, level, variant, lastInteractedAt: now } : m,
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

export function getNextDivergentSiblingIndex(state: AppState): number | null {
  const focused = getFocusedRevision(state);
  if (!focused || !isDivergentRevisionId(focused.revisionId)) {
    return null;
  }

  const focusedChangeId = getChangeIdFromRevisionId(focused.revisionId);
  const total = state.revisions.length;
  for (let step = 1; step < total; step += 1) {
    const candidateIndex = (state.focusedRevisionIndex + step) % total;
    const candidate = state.revisions[candidateIndex];
    if (!candidate) continue;
    if (!isDivergentRevisionId(candidate.revisionId)) continue;
    if (getChangeIdFromRevisionId(candidate.revisionId) === focusedChangeId) {
      return candidateIndex;
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

// The value `ctrl-'` inserts into the command bar. It mirrors whatever list the
// command bar was opened from: the focused operation id in op-log, the focused
// entry id in evolog, otherwise the focused revision's change-id prefix.
export function getFocusedInsertArg(state: AppState): string | null {
  switch (getBrowseFocusMode(state)) {
    case "op-log":
      return getFocusedOperationLogEntry(state)?.id ?? null;
    case "evolog": {
      const id = state.evologEntries[state.focusedEvologIndex]?.id ?? null;
      // Skip the synthetic placeholder ids emitted when no operation id parsed.
      return id !== null && !id.startsWith("evolog-") ? id : null;
    }
    default:
      return getFocusedRevisionArg(state);
  }
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

  if (state.commandDraft.config.kind === "set-parents") {
    return getSetParentsSubject(state)?.revisionId ?? null;
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

  const draft = state.commandDraft;

  if (draft.config.kind === "set-parents") {
    const subject = getSetParentsSubject(state);
    if (subject && subject.rowId === rowId) {
      return "subject";
    }
    if (state.selectedRowIds.includes(rowId)) {
      const revision = state.revisions.find((candidate) => candidate.rowId === rowId);
      const isExistingParent = revision !== undefined &&
        (subject?.parentRevisionIds ?? []).includes(revision.revisionId);
      return isExistingParent ? "remove" : "add";
    }
    return null;
  }

  if (draft.config.kind === "absorb") {
    if (state.selectedRowIds.includes(rowId)) {
      return draft.config.sourceBadgeText;
    }
    // A default target that has been deselected still shows a muted reminder.
    if ((draft.absorbDefaultRowIds ?? []).includes(rowId)) {
      return "default";
    }
    return null;
  }

  const isRebase = draft.config.kind === "rebase";
  const targetKind: RebaseTargetKind = draft.rebaseTargetKind ?? "destination";
  const sourceKind: RebaseSourceKind = draft.rebaseSourceKind ?? "revisions";
  const swapped = draft.config.kind === "interdiff" && (draft.interdiffSwapped ?? false);
  const targetBadge = swapped ? draft.config.sourceBadgeText : draft.config.badgeText;
  const sourceBadge = swapped ? draft.config.badgeText : draft.config.sourceBadgeText;

  if (isRebase && draft.rebaseInsertAfterRevisionId) {
    const anchorRow = state.revisions.find(
      (revision) => revision.revisionId === draft.rebaseInsertAfterRevisionId,
    );
    if (anchorRow && anchorRow.rowId === rowId) {
      return "after";
    }
  }

  if (getCommandTargetRowId(state) === rowId) {
    if (isRebase) {
      switch (targetKind) {
        case "insert-before": return "before";
        case "insert-after": return "after";
        case "insert-between": return "before";
      }
    }
    return targetBadge;
  }

  if (state.selectedRowIds.includes(rowId)) {
    if (isRebase && sourceKind === "branch") {
      return "branch";
    }
    return sourceBadge;
  }

  return null;
}

export function getCommandTargetRowId(state: AppState): string | null {
  if (!state.commandDraft) {
    return null;
  }

  if (state.commandDraft.config.kind === "set-parents") {
    return getSetParentsSubject(state)?.rowId ?? null;
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

type ContextOverrides = Readonly<{ forceApply?: boolean }>;

function buildContext(
  state: AppState,
  overrides?: ContextOverrides,
): { template: string; context: TemplateContext } | null {
  if (!state.commandDraft) {
    return null;
  }

  const draft = state.commandDraft;
  const useShort = state.useShortFlags;
  const arg = (pair: string) => {
    const [s, l] = pair.split(" ");
    return useShort ? s! : l!;
  };

  const target = revisionPrefix(state, getCommandTargetRevisionId(state) ?? "") || DRAFT_PLACEHOLDER;
  const sourceKind: RebaseSourceKind = draft.rebaseSourceKind ?? "revisions";
  const targetKind: RebaseTargetKind = draft.rebaseTargetKind ?? "destination";
  const anchorRaw = draft.rebaseInsertAfterRevisionId
    ? revisionPrefix(state, draft.rebaseInsertAfterRevisionId)
    : "";
  const anchor = anchorRaw || DRAFT_PLACEHOLDER;

  const squashAnchor = draft.config.kind === "squash" && (draft.includeAnchor ?? false)
    ? getSquashAnchorArg(state)
    : "";

  const isAbsorb = draft.config.kind === "absorb";
  const absorbDefaultSet = new Set(draft.absorbDefaultRowIds ?? []);
  const absorbSelectedSet = new Set(state.selectedRowIds);
  const absorbSetChanged = absorbDefaultSet.size !== absorbSelectedSet.size ||
    state.selectedRowIds.some((id) => !absorbDefaultSet.has(id));
  const absorbConstrained = isAbsorb && absorbSetChanged && state.selectedRowIds.length > 0;
  const absorbTargets = state.selectedRowIds
    .map((id) => revisionPrefixFromRowId(state, id))
    .join("|");
  const absorbSourceRevision = isAbsorb && draft.absorbSourceRevisionId
    ? state.revisions.find((revision) => revision.revisionId === draft.absorbSourceRevisionId)
    : undefined;
  // `--from` is implied for the working copy, so only emit it for other sources.
  const absorbFromSource = isAbsorb && absorbSourceRevision !== undefined &&
    absorbSourceRevision.marker !== "working-copy";
  const absorbSource = absorbSourceRevision
    ? getRevisionArg(absorbSourceRevision.revisionId, absorbSourceRevision.changeIdPrefixLength)
    : "";

  const isSetParents = draft.config.kind === "set-parents";
  const setParentsSubject = isSetParents
    ? revisionPrefix(state, getSetParentsSubject(state)?.revisionId ?? "") || DRAFT_PLACEHOLDER
    : "";
  const setParentsDestinationArgs = isSetParents
    ? getSetParentsDestinationRevisionIds(state).map((revisionId) => revisionPrefix(state, revisionId))
    : [];
  // An empty result is an incomplete state (every parent removed): show a single
  // placeholder so the preview reads `-d ░░░░` rather than a bare `rebase -r`.
  const setParentsDestinations = setParentsDestinationArgs.length > 0
    ? setParentsDestinationArgs
    : isSetParents
      ? [DRAFT_PLACEHOLDER]
      : [];

  return {
    template: draft.config.template,
    context: {
      selected: state.selectedRowIds.map((id) => revisionPrefixFromRowId(state, id)),
      target,
      subject: setParentsSubject,
      destinations: setParentsDestinations,
      absorbConstrained,
      absorbTargets,
      absorbFromSource,
      absorbSource,
      arg,
      sourceFlag: () => {
        switch (sourceKind) {
          case "branch": return arg("-b --branch");
          case "source": return arg("-s --source");
          default: return arg("-r --revisions");
        }
      },
      targetFlags: () => {
        switch (targetKind) {
          case "insert-before":
            return `${arg("-B --insert-before")} ${target}`;
          case "insert-after":
            return `${arg("-A --insert-after")} ${target}`;
          case "insert-between":
            return `${arg("-A --insert-after")} ${anchor} ${arg("-B --insert-before")} ${target}`;
          default:
            return `${arg("-d --destination")} ${target}`;
        }
      },
      skipEmptied: draft.rebaseSkipEmptied ?? false,
      forceApply: overrides?.forceApply ?? false,
      swapped: draft.interdiffSwapped ?? false,
      anchorSuffix: squashAnchor ? `::${squashAnchor}` : "",
    },
  };
}

export function getSquashAnchorArg(state: AppState): "@" | "@-" {
  const workingCopy = state.revisions.find((r) => r.marker === "working-copy");
  return workingCopy && workingCopy.isEmpty ? "@-" : "@";
}

function buildTaggedContext(
  state: AppState,
  overrides?: ContextOverrides,
): { template: string; context: TemplateContext } | null {
  const resolved = buildContext(state, overrides);
  if (!resolved) return null;

  const { context } = resolved;
  const targetRaw = context.target as string;
  const draft = state.commandDraft!;
  const arg = context.arg;
  const sourceKind: RebaseSourceKind = draft.rebaseSourceKind ?? "revisions";
  const targetKind: RebaseTargetKind = draft.rebaseTargetKind ?? "destination";
  const anchorRaw = draft.rebaseInsertAfterRevisionId
    ? revisionPrefix(state, draft.rebaseInsertAfterRevisionId)
    : "";
  const taggedTarget = new Tagged(targetRaw === DRAFT_PLACEHOLDER ? "" : targetRaw, "target");
  const taggedAnchor = new Tagged(anchorRaw, "target");
  const subjectRaw = context.subject as string;
  const taggedSubject = new Tagged(subjectRaw === DRAFT_PLACEHOLDER ? "" : subjectRaw, "selected");
  const taggedDestinations = (context.destinations as string[]).map(
    (destination) => new Tagged(destination === DRAFT_PLACEHOLDER ? "" : destination, "target"),
  );

  return {
    template: resolved.template,
    context: {
      ...context,
      selected: (context.selected as string[]).map((s) => new Tagged(s, "selected")),
      target: taggedTarget,
      subject: taggedSubject,
      destinations: taggedDestinations,
      absorbTargets: (context.selected as string[])
        .map((s) => new Tagged(s, "selected").toString())
        .join("|"),
      absorbSource: new Tagged(context.absorbSource as string, "target"),
      targetFlags: () => {
        switch (targetKind) {
          case "insert-before":
            return `${arg("-B --insert-before")} ${taggedTarget}`;
          case "insert-after":
            return `${arg("-A --insert-after")} ${taggedTarget}`;
          case "insert-between":
            return `${arg("-A --insert-after")} ${taggedAnchor} ${arg("-B --insert-before")} ${taggedTarget}`;
          default:
            return `${arg("-d --destination")} ${taggedTarget}`;
        }
      },
      sourceFlag: () => {
        switch (sourceKind) {
          case "branch": return arg("-b --branch");
          case "source": return arg("-s --source");
          default: return arg("-r --revisions");
        }
      },
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

export function getDisplayedCommandText(
  state: AppState,
  overrides?: { forceApply?: boolean },
): string {
  if (state.commandBar.manual) {
    return state.commandBar.text;
  }

  const inlineConfirmation = getInlineConfirmation(state);
  if (inlineConfirmation) {
    return inlineConfirmation.previewCommandByOption[inlineConfirmation.selectedOption];
  }

  const resolved = buildContext(state, overrides);
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

  if (state.commandDraft.config.kind === "rebase" && state.commandDraft.rebaseSourceKind === "source" && state.commandDraft.descendantRevisionIds) {
    return new Set(
      state.revisions
        .filter((revision) => state.commandDraft?.descendantRevisionIds?.includes(revision.revisionId))
        .map((revision) => revision.rowId),
    );
  }

  if (state.commandDraft.config.kind === "squash" && state.commandDraft.includeAnchor && state.commandDraft.anchorRevisionIds) {
    const anchorIds = state.commandDraft.anchorRevisionIds;
    const anchorRowIds = state.revisions
      .filter((revision) => anchorIds.includes(revision.revisionId))
      .map((revision) => revision.rowId);
    return new Set([...state.selectedRowIds, ...anchorRowIds]);
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

  if (state.commandDraft.config.kind === "set-parents") {
    // Require an actual change (a pick) that still leaves at least one parent.
    return state.selectedRowIds.length > 0 &&
      getSetParentsDestinationRevisionIds(state).length > 0;
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

  if (state.focusModeStack.includes("evolog")) {
    return ["revisions", "evolog"];
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
