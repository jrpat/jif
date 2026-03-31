import type {
  AppState,
  ChangedFile,
  CommandBarState,
  CommandDraftConfig,
  EventLogEntry,
  FocusMode,
  RepositoryData,
  RevisionSummary,
  StatusMessage,
  StatusLevel,
} from "../domain/types.ts";

export const DRAFT_PLACEHOLDER = "░░░░";

export const draftConfigs = {
  rebase: {
    kind: "rebase" as const,
    template: "rebase ${selected.map(s => `${arg(descendants ? '-s --source' : '-r --revisions')} ${s}`).join(' ')} ${arg('-d --destination')} ${target}",
    badgeText: "onto",
  },
  squash: {
    kind: "squash" as const,
    template: "squash ${selected.map(s => `${arg('-f --from')} ${s}`).join(' ')} ${arg('-t --into')} ${target}",
    badgeText: "into",
  },
} satisfies Record<string, CommandDraftConfig>;

export type TemplateContext = Readonly<{
  selected: readonly (string | Tagged)[];
  target: string | Tagged;
  descendants: boolean;
  arg: (pair: string) => string;
}>;

export type CommandSegmentStyle = "command" | "selected" | "target" | "placeholder";

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
  options?: { useShortFlags?: boolean; condensedLayout?: boolean },
): AppState {
  return {
    repoPath,
    revisions: [],
    focusMode: "revisions",
    shortcutPanelExpanded: false,
    focusedRevisionIndex: 0,
    expandedRevisionId: null,
    focusedFileIndex: 0,
    selectedRevisionIds: [],
    selectedFilePaths: [],
    commandBar: createEmptyCommandBar(),
    commandDraft: null,
    statusMessages: [],
    eventLog: [],
    loading: true,
    useShortFlags: options?.useShortFlags ?? true,
    condensedLayout: options?.condensedLayout ?? false,
    revsetQuery: "",
  };
}

export function toggleShortFlags(state: AppState): AppState {
  return { ...state, useShortFlags: !state.useShortFlags };
}

export function toggleCondensedLayout(state: AppState): AppState {
  return { ...state, condensedLayout: !state.condensedLayout };
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
  return { ...state, focusMode: "revset" };
}

export function closeRevsetInput(state: AppState): AppState {
  return { ...state, focusMode: getBrowseFocusMode(state) };
}

export function setRevsetQuery(state: AppState, query: string): AppState {
  return { ...state, revsetQuery: query };
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
  const previousRevisions = new Map(
    state.revisions.map((revision) => [revision.changeId, revision] as const),
  );
  const revisions = repositoryData.revisions.map((revision) => ({
    ...revision,
    ...resolveRevisionFiles(previousRevisions.get(revision.changeId), revision),
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

  const revisionIdSet = new Set(revisions.map((r) => r.changeId));
  const selectedRevisionIds = state.selectedRevisionIds.filter((id) => revisionIdSet.has(id));
  const selectedFilePaths =
    expandedRevisionId === state.expandedRevisionId
      ? state.selectedFilePaths
      : [];

  return {
    ...state,
    repoPath: repositoryData.repoPath,
    revisions,
    focusMode: nextFocusMode,
    focusedRevisionIndex,
    expandedRevisionId,
    focusedFileIndex: clampIndex(state.focusedFileIndex, getExpandedFilesCount(revisions, expandedRevisionId)),
    selectedRevisionIds,
    selectedFilePaths,
    loading: false,
  };
}

export function setRevisionFiles(
  state: AppState,
  revisionId: string,
  files: readonly ChangedFile[],
): AppState {
  const revisions = state.revisions.map((revision) =>
    revision.changeId === revisionId ? { ...revision, files, filesLoaded: true } : revision,
  );

  const filePaths = new Set(files.map((f) => f.path));
  const selectedFilePaths =
    state.expandedRevisionId === revisionId
      ? state.selectedFilePaths.filter((p) => filePaths.has(p))
      : state.selectedFilePaths;

  return {
    ...state,
    revisions,
    selectedFilePaths,
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

export function openFocusedRevision(state: AppState): AppState {
  const revision = getFocusedRevision(state);
  if (!revision || revision.marker === "elided") {
    return state;
  }

  return {
    ...state,
    focusMode: "files",
    expandedRevisionId: revision.changeId,
    focusedFileIndex: 0,
    selectedFilePaths: [],
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
  if (state.expandedRevisionId === null) {
    return state;
  }

  return {
    ...state,
    focusMode: "revisions",
    expandedRevisionId: null,
    focusedFileIndex: 0,
    selectedFilePaths: [],
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
    focusMode: getBrowseFocusMode(state),
  };
}

export function setCommandBarText(state: AppState, text: string): AppState {
  return {
    ...state,
    commandBar: {
      text: text.startsWith("jj ") ? text.slice(3) : text,
      manual: true,
    },
  };
}

export function cancelCommandState(state: AppState): AppState {
  return {
    ...state,
    focusMode: getBrowseFocusMode(state),
    commandBar: createEmptyCommandBar(),
    commandDraft: null,
    selectedRevisionIds: [],
    selectedFilePaths: [],
    statusMessages: state.commandDraft ? [] : state.statusMessages,
  };
}

export function cancelCommandDraft(state: AppState): AppState {
  return {
    ...state,
    commandBar: createEmptyCommandBar(),
    commandDraft: null,
    selectedRevisionIds: [],
    statusMessages: state.commandDraft ? [] : state.statusMessages,
  };
}

export function clearRevisionSelection(state: AppState): AppState {
  return {
    ...state,
    selectedRevisionIds: [],
  };
}

export function toggleFileSelection(state: AppState): AppState {
  if (state.focusMode !== "files" || state.expandedRevisionId === null) {
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
    selectedFilePaths: isSelected
      ? state.selectedFilePaths.filter((p) => p !== file.path)
      : [...state.selectedFilePaths, file.path],
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

  const hasPreSelection = state.selectedRevisionIds.length > 0;
  const sourceIds = hasPreSelection
    ? state.selectedRevisionIds
    : [revision.changeId];

  return {
    ...state,
    commandBar: createEmptyCommandBar(),
    focusedRevisionIndex: hasPreSelection
      ? state.focusedRevisionIndex
      : clampIndex(state.focusedRevisionIndex + 1, state.revisions.length),
    selectedRevisionIds: sourceIds,
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

  const ids = state.selectedRevisionIds;
  const isSelected = ids.includes(focusedRevision.changeId);

  return {
    ...state,
    selectedRevisionIds: isSelected
      ? ids.filter((id) => id !== focusedRevision.changeId)
      : [...ids, focusedRevision.changeId],
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
  };

  return {
    ...state,
    statusMessages: [...state.statusMessages, statusMessage],
    eventLog: [...state.eventLog.slice(-99), event],
  };
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

export function getFocusedRevisionArg(state: AppState): string | null {
  const revision = getFocusedRevision(state);
  if (!revision) {
    return null;
  }

  return revision.changeId.slice(0, revision.changeIdPrefixLength);
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
  if (!focusedRevision || state.selectedRevisionIds.includes(focusedRevision.changeId)) {
    return null;
  }

  return focusedRevision.changeId;
}

export function getSelectedRevisionIds(state: AppState): ReadonlySet<string> {
  return new Set(state.selectedRevisionIds);
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
      selected: state.selectedRevisionIds.map((id) => revisionPrefix(state, id)),
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

export function getDisplayedCommandText(state: AppState): string {
  if (state.commandBar.manual) {
    return state.commandBar.text;
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

  const resolved = buildTaggedContext(state);
  if (!resolved) {
    return null;
  }

  return buildCommandSegments(resolved.template, resolved.context);
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

  return new Set(state.selectedRevisionIds);
}

export function commandCanExecute(state: AppState): boolean {
  if (state.commandBar.manual) {
    return state.commandBar.text.trim().length > 0;
  }

  if (!state.commandDraft) {
    return false;
  }

  if (state.commandDraft.config.template.includes("${target}")) {
    return getCommandTargetRevisionId(state) !== null;
  }

  return state.selectedRevisionIds.length > 0;
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

  if (!previous || previous.commitId !== next.commitId || !previous.filesLoaded) {
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
  return state.expandedRevisionId !== null ? "files" : "revisions";
}

function clampIndex(value: number, size: number): number {
  if (size <= 0) {
    return 0;
  }

  return Math.min(Math.max(value, 0), size - 1);
}
