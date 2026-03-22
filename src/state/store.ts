import type {
  AppState,
  ChangedFile,
  CommandBarState,
  CommandDraftConfig,
  EventLogEntry,
  RepositoryData,
  RevisionSummary,
  StatusLevel,
} from "../domain/types.ts";

export const DRAFT_PLACEHOLDER = "░░░░";

export const draftConfigs = {
  rebase: {
    kind: "rebase" as const,
    shortTemplate: "rebase -r ${selected} -d ${target}",
    longTemplate: "rebase --revisions ${selected} --destination ${target}",
    badgeText: "onto",
  },
  squash: {
    kind: "squash" as const,
    shortTemplate: "squash -f ${selected} -t ${target}",
    longTemplate: "squash --from ${selected} --into ${target}",
    badgeText: "into",
  },
} satisfies Record<string, CommandDraftConfig>;

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template
    .replace(/\$\{(\w+)\}/g, (_, key) => vars[key] || DRAFT_PLACEHOLDER)
    .replace(/\s+/g, " ")
    .trim();
}

export type CommandSegmentStyle = "command" | "selected" | "target" | "placeholder";

export type CommandSegment = Readonly<{
  text: string;
  style: CommandSegmentStyle;
}>;

export function buildCommandSegments(
  template: string,
  vars: Record<string, string>,
): readonly CommandSegment[] {
  const segments: CommandSegment[] = [];
  let lastIndex = 0;

  for (const match of template.matchAll(/\$\{(\w+)\}/g)) {
    const before = template.slice(lastIndex, match.index);
    if (before) {
      segments.push({ text: before, style: "command" });
    }

    const key = match[1]!;
    const value = vars[key] ?? "";
    if (value) {
      segments.push({ text: value, style: key === "target" ? "target" : "selected" });
    } else {
      segments.push({ text: DRAFT_PLACEHOLDER, style: "placeholder" });
    }

    lastIndex = match.index! + match[0].length;
  }

  const after = template.slice(lastIndex);
  if (after) {
    segments.push({ text: after, style: "command" });
  }

  return segments;
}

export function createInitialState(repoPath: string, options?: { useShortFlags?: boolean }): AppState {
  return {
    repoPath,
    graphWidth: 4,
    revisions: [],
    focusMode: "revisions",
    focusedRevisionIndex: 0,
    expandedRevisionId: null,
    focusedFileIndex: 0,
    commandBar: createEmptyCommandBar(),
    commandDraft: null,
    statusMessage: null,
    eventLog: [],
    loading: true,
    error: null,
    useShortFlags: options?.useShortFlags ?? true,
  };
}

export function toggleShortFlags(state: AppState): AppState {
  return { ...state, useShortFlags: !state.useShortFlags };
}

export function createEmptyCommandBar(): CommandBarState {
  return {
    text: "",
    manual: false,
  };
}

export function applyRepositoryData(
  state: AppState,
  repositoryData: RepositoryData,
): AppState {
  const previousFiles = new Map(
    state.revisions.map((revision) => [revision.changeId, revision.files] as const),
  );
  const revisions = repositoryData.revisions.map((revision) => ({
    ...revision,
    files: previousFiles.get(revision.changeId) ?? revision.files,
  }));
  const focusedRevisionId = getFocusedRevision(state)?.changeId;
  const focusedRevisionIndex = clampIndex(
    focusedRevisionId
      ? revisions.findIndex((revision) => revision.changeId === focusedRevisionId)
      : 0,
    revisions.length,
  );
  const expandedRevisionId =
    state.expandedRevisionId &&
    revisions.some((revision) => revision.changeId === state.expandedRevisionId)
      ? state.expandedRevisionId
      : null;
  const nextFocusMode =
    state.focusMode === "files" && expandedRevisionId === null
      ? "revisions"
      : state.focusMode;

  return {
    ...state,
    graphWidth: repositoryData.graphWidth,
    repoPath: repositoryData.repoPath,
    revisions,
    focusMode: nextFocusMode,
    focusedRevisionIndex,
    expandedRevisionId,
    focusedFileIndex: clampIndex(state.focusedFileIndex, getExpandedFilesCount(revisions, expandedRevisionId)),
    loading: false,
    error: null,
  };
}

export function setRevisionFiles(
  state: AppState,
  revisionId: string,
  files: readonly ChangedFile[],
): AppState {
  const revisions = state.revisions.map((revision) =>
    revision.changeId === revisionId ? { ...revision, files } : revision,
  );

  return {
    ...state,
    revisions,
    focusedFileIndex:
      state.expandedRevisionId === revisionId
        ? clampIndex(state.focusedFileIndex, files.length)
        : state.focusedFileIndex,
  };
}

export function moveFocus(state: AppState, delta: number): AppState {
  if (state.focusMode === "command") {
    return state;
  }

  if (state.focusMode === "files" && state.expandedRevisionId !== null) {
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

export function openFocusedRevision(state: AppState): AppState {
  const revision = getFocusedRevision(state);
  if (!revision) {
    return state;
  }

  return {
    ...state,
    focusMode: "files",
    expandedRevisionId: revision.changeId,
    focusedFileIndex: 0,
  };
}

export function closeFocusedRevision(state: AppState): AppState {
  const revision = getFocusedRevision(state);
  if (!revision || state.expandedRevisionId !== revision.changeId) {
    return state;
  }

  return {
    ...state,
    focusMode: "revisions",
    expandedRevisionId: null,
    focusedFileIndex: 0,
  };
}

export function focusCommandBar(state: AppState): AppState {
  const text = getDisplayedCommandText(state);
  return {
    ...state,
    focusMode: "command",
    commandBar: {
      text: text.length > 0 && !text.endsWith(" ") ? `${text} ` : text,
      manual: true,
    },
  };
}

export function blurCommandBar(state: AppState): AppState {
  return {
    ...state,
    focusMode: "revisions",
  };
}

export function setCommandBarText(state: AppState, text: string): AppState {
  return {
    ...state,
    commandBar: {
      text,
      manual: true,
    },
  };
}

export function cancelCommandState(state: AppState): AppState {
  return {
    ...state,
    focusMode: "revisions",
    commandBar: createEmptyCommandBar(),
    commandDraft: null,
    statusMessage: state.commandDraft ? null : state.statusMessage,
  };
}

export function startCommandDraft(
  state: AppState,
  config: CommandDraftConfig,
  options?: { descendantRevisionIds?: readonly string[] },
): AppState {
  const revision = getFocusedRevision(state);
  if (!revision) {
    return state;
  }

  return {
    ...state,
    commandBar: createEmptyCommandBar(),
    commandDraft: {
      config,
      selectedRevisionIds: [revision.changeId],
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
  if (!state.commandDraft) {
    return state;
  }

  const focusedRevision = getFocusedRevision(state);
  if (!focusedRevision) {
    return state;
  }

  const ids = state.commandDraft.selectedRevisionIds;
  const isSelected = ids.includes(focusedRevision.changeId);

  if (isSelected && ids.length === 1) {
    return state;
  }

  return {
    ...state,
    commandDraft: {
      ...state.commandDraft,
      selectedRevisionIds: isSelected
        ? ids.filter((id) => id !== focusedRevision.changeId)
        : [...ids, focusedRevision.changeId],
    },
  };
}

export function setLoading(state: AppState, loading: boolean): AppState {
  return {
    ...state,
    loading,
  };
}

export function setError(state: AppState, error: string | null): AppState {
  return {
    ...state,
    error,
    loading: false,
  };
}

export function pushEvent(
  state: AppState,
  text: string,
  level: StatusLevel,
  createdAt = Date.now(),
): AppState {
  const event: EventLogEntry = {
    id: `${createdAt}-${state.eventLog.length}`,
    text,
    level,
    createdAt,
  };

  return {
    ...state,
    statusMessage: { text, level, createdAt },
    eventLog: [...state.eventLog.slice(-19), event],
  };
}

export function dismissOldestError(state: AppState): AppState {
  if (state.error !== null) {
    return { ...state, error: null };
  }

  const oldestErrorIndex = state.eventLog.findIndex((entry) => entry.level === "error");
  if (oldestErrorIndex === -1) {
    if (state.statusMessage?.level === "error") {
      return { ...state, statusMessage: null };
    }
    return state;
  }

  const eventLog = state.eventLog.filter((_, index) => index !== oldestErrorIndex);
  const statusMessage =
    state.statusMessage?.level === "error" ? null : state.statusMessage;
  return { ...state, eventLog, statusMessage };
}

export function clearStatusMessage(state: AppState): AppState {
  return { ...state, statusMessage: null };
}

export function getFocusedRevision(state: AppState): RevisionSummary | null {
  return state.revisions[state.focusedRevisionIndex] ?? null;
}

export function getExpandedRevision(state: AppState): RevisionSummary | null {
  if (!state.expandedRevisionId) {
    return null;
  }

  return (
    state.revisions.find((revision) => revision.changeId === state.expandedRevisionId) ?? null
  );
}

export function isFileNavigationActive(state: AppState): boolean {
  return state.focusMode === "files" && state.expandedRevisionId !== null;
}

export function getCommandTargetRevisionId(state: AppState): string | null {
  if (!state.commandDraft) {
    return null;
  }

  const focusedRevision = getFocusedRevision(state);
  if (!focusedRevision || state.commandDraft.selectedRevisionIds.includes(focusedRevision.changeId)) {
    return null;
  }

  return focusedRevision.changeId;
}

export function getSelectedRevisionIds(state: AppState): ReadonlySet<string> {
  if (!state.commandDraft) {
    return new Set();
  }

  return new Set(state.commandDraft.selectedRevisionIds);
}

function resolveTemplate(state: AppState): { template: string; vars: Record<string, string> } | null {
  if (!state.commandDraft) {
    return null;
  }

  const draft = state.commandDraft;
  let template = state.useShortFlags ? draft.config.shortTemplate : draft.config.longTemplate;

  if (draft.config.kind === "rebase" && draft.includeDescendants) {
    template = state.useShortFlags
      ? template.replace("-r", "-s")
      : template.replace("--revisions", "--source");
  }

  return {
    template,
    vars: {
      selected: draft.selectedRevisionIds.map((id) => revisionPrefix(state, id)).join(" "),
      target: revisionPrefix(state, getCommandTargetRevisionId(state) ?? ""),
    },
  };
}

export function getDisplayedCommandText(state: AppState): string {
  if (state.commandBar.manual) {
    return state.commandBar.text;
  }

  const resolved = resolveTemplate(state);
  if (!resolved) {
    return "";
  }

  return interpolateTemplate(resolved.template, resolved.vars);
}

export function getDisplayedCommandSegments(state: AppState): readonly CommandSegment[] | null {
  if (state.commandBar.manual) {
    return null;
  }

  const resolved = resolveTemplate(state);
  if (!resolved) {
    return null;
  }

  return buildCommandSegments(resolved.template, resolved.vars);
}

function revisionPrefix(state: AppState, changeId: string): string {
  if (!changeId) {
    return "";
  }

  const rev = state.revisions.find((r) => r.changeId === changeId);
  return rev ? changeId.slice(0, rev.changeIdPrefixLength) : changeId;
}

export function getOperationAffectedRevisionIds(state: AppState): ReadonlySet<string> {
  if (!state.commandDraft) {
    return new Set();
  }

  if (state.commandDraft.config.kind === "rebase" && state.commandDraft.includeDescendants && state.commandDraft.descendantRevisionIds) {
    return new Set(state.commandDraft.descendantRevisionIds);
  }

  return new Set(state.commandDraft.selectedRevisionIds);
}

export function commandCanExecute(state: AppState): boolean {
  if (state.commandBar.manual) {
    return state.commandBar.text.trim().length > 0;
  }

  if (!state.commandDraft) {
    return false;
  }

  if (state.commandDraft.config.shortTemplate.includes("${target}")) {
    return getCommandTargetRevisionId(state) !== null;
  }

  return state.commandDraft.selectedRevisionIds.length > 0;
}

function getExpandedFilesCount(
  revisions: readonly RevisionSummary[],
  expandedRevisionId: string | null,
): number {
  if (!expandedRevisionId) {
    return 0;
  }

  return revisions.find((revision) => revision.changeId === expandedRevisionId)?.files.length ?? 0;
}

function clampIndex(value: number, size: number): number {
  if (size <= 0) {
    return 0;
  }

  return Math.min(Math.max(value, 0), size - 1);
}
