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
    focus: false,
    manual: false,
    text: "",
    cursor: 0,
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

  return {
    ...state,
    graphWidth: repositoryData.graphWidth,
    repoPath: repositoryData.repoPath,
    revisions,
    focusedRevisionIndex,
    expandedRevisionId,
    focusedFileIndex: 0,
    loading: false,
    error: null,
  };
}

export function setRevisionFiles(
  state: AppState,
  revisionId: string,
  files: readonly ChangedFile[],
): AppState {
  return {
    ...state,
    revisions: state.revisions.map((revision) =>
      revision.changeId === revisionId ? { ...revision, files } : revision,
    ),
  };
}

export function moveFocus(state: AppState, delta: number): AppState {
  if (state.commandBar.focus) {
    return state;
  }

  if (isFileNavigationActive(state)) {
    const revision = getFocusedRevision(state);
    const nextFileIndex = clampIndex(
      state.focusedFileIndex + delta,
      revision?.files.length ?? 0,
    );
    return {
      ...state,
      focusedFileIndex: nextFileIndex,
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
    expandedRevisionId: null,
    focusedFileIndex: 0,
  };
}

export function focusCommandBar(state: AppState): AppState {
  const currentText = getDisplayedCommandText(state);
  return {
    ...state,
    commandBar: {
      focus: true,
      manual: true,
      text: currentText,
      cursor: currentText.length,
    },
  };
}

export function cancelCommandState(state: AppState): AppState {
  return {
    ...state,
    commandBar: createEmptyCommandBar(),
    commandDraft: null,
  };
}

export function blurCommandBar(state: AppState): AppState {
  return {
    ...state,
    commandBar: {
      ...state.commandBar,
      focus: false,
      manual: state.commandDraft === null ? false : state.commandBar.manual,
    },
  };
}

export function insertCommandText(state: AppState, text: string): AppState {
  if (!state.commandBar.focus) {
    return state;
  }

  const { cursor, text: currentText } = state.commandBar;
  const nextText = `${currentText.slice(0, cursor)}${text}${currentText.slice(cursor)}`;
  return {
    ...state,
    commandBar: {
      ...state.commandBar,
      manual: true,
      text: nextText,
      cursor: cursor + text.length,
    },
  };
}

export function moveCommandCursor(state: AppState, delta: number): AppState {
  if (!state.commandBar.focus) {
    return state;
  }

  return {
    ...state,
    commandBar: {
      ...state.commandBar,
      cursor: clampNumber(
        state.commandBar.cursor + delta,
        0,
        state.commandBar.text.length,
      ),
    },
  };
}

export function backspaceCommandText(state: AppState): AppState {
  if (!state.commandBar.focus || state.commandBar.cursor === 0) {
    return state;
  }

  const { cursor, text } = state.commandBar;
  return {
    ...state,
    commandBar: {
      ...state.commandBar,
      manual: true,
      text: `${text.slice(0, cursor - 1)}${text.slice(cursor)}`,
      cursor: cursor - 1,
    },
  };
}

export function deleteCommandText(state: AppState): AppState {
  if (!state.commandBar.focus || state.commandBar.cursor >= state.commandBar.text.length) {
    return state;
  }

  const { cursor, text } = state.commandBar;
  return {
    ...state,
    commandBar: {
      ...state.commandBar,
      manual: true,
      text: `${text.slice(0, cursor)}${text.slice(cursor + 1)}`,
      cursor,
    },
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
      affectedRevisionIds: descendantIds,
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
      affectedRevisionIds: descendantIds,
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
  const focusedRevision = getFocusedRevision(state);
  return (
    focusedRevision !== null &&
    state.expandedRevisionId === focusedRevision.changeId &&
    focusedRevision.files.length > 0
  );
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
        ? state.commandDraft.affectedRevisionIds
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

function clampIndex(value: number, size: number): number {
  if (size <= 0) {
    return 0;
  }

  return clampNumber(value, 0, size - 1);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
