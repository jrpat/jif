import type {
  AppState,
  ChangedFile,
  CommandBarState,
  EventLogEntry,
  RepositoryData,
  RevisionSummary,
  StatusLevel,
} from "../domain/types.ts";

export function createInitialState(repoPath: string): AppState {
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
  };
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
  return {
    ...state,
    focusMode: "command",
    commandBar: {
      text: getDisplayedCommandText(state),
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
  };
}

export function startRebaseCommand(
  state: AppState,
  descendantIds: readonly string[],
): AppState {
  const revision = getFocusedRevision(state);
  if (!revision) {
    return state;
  }

  return {
    ...state,
    commandBar: createEmptyCommandBar(),
    commandDraft: {
      kind: "rebase",
      sourceRevisionId: revision.changeId,
      includeDescendants: false,
      descendantRevisionIds: descendantIds,
    },
  };
}

export function toggleRebaseDescendants(
  state: AppState,
  descendantIds: readonly string[],
): AppState {
  if (state.commandDraft?.kind !== "rebase") {
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

export function getCurrentRebaseTargetRevisionId(state: AppState): string | null {
  if (state.commandDraft?.kind !== "rebase") {
    return null;
  }

  const focusedRevision = getFocusedRevision(state);
  if (!focusedRevision || focusedRevision.changeId === state.commandDraft.sourceRevisionId) {
    return null;
  }

  return focusedRevision.changeId;
}

export function getDisplayedCommandText(state: AppState): string {
  if (state.commandBar.manual) {
    return state.commandBar.text;
  }

  if (state.commandDraft?.kind === "rebase") {
    const target = getCurrentRebaseTargetRevisionId(state);
    const scopeFlag = state.commandDraft.includeDescendants ? "-s" : "-r";
    const targetPart = target ? ` -o ${target}` : "";
    return `rebase ${scopeFlag} ${state.commandDraft.sourceRevisionId}${targetPart}`;
  }

  return "";
}

export function getOperationAffectedRevisionIds(state: AppState): ReadonlySet<string> {
  if (!state.commandDraft) {
    return new Set();
  }

  if (state.commandDraft.kind === "rebase") {
    return new Set(
      state.commandDraft.includeDescendants
        ? state.commandDraft.descendantRevisionIds
        : [state.commandDraft.sourceRevisionId],
    );
  }

  return new Set();
}

export function commandCanExecute(state: AppState): boolean {
  if (state.commandBar.manual) {
    return state.commandBar.text.trim().length > 0;
  }

  if (state.commandDraft?.kind === "rebase") {
    return getCurrentRebaseTargetRevisionId(state) !== null;
  }

  return false;
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
