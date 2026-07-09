export type RevisionMarker = "working-copy" | "bookmark" | "plain" | "immutable" | "elided";

export type InlineConfirmationOptionId = "yes" | "interactive" | "no";
export type InlineConfirmationKind = "split-files";

export type InlineConfirmation = Readonly<{
  kind: InlineConfirmationKind;
  rowId: string;
  message: string;
  options: readonly InlineConfirmationOptionId[];
  selectedOption: InlineConfirmationOptionId;
  actualCommandByOption: Readonly<Record<InlineConfirmationOptionId, string>>;
  previewCommandByOption: Readonly<Record<InlineConfirmationOptionId, string>>;
}>;

export type FocusMode =
  | "revisions"
  | "files"
  | "op-log"
  | "evolog"
  | "inline-confirmation"
  | "command"
  | "revset"
  | "file-search"
  | "search"
  | "diff-viewer"
  | "notifications"
  | "bookmark"
  | "extra";
export type AppLayout = "loose" | "normal" | "tight";
export type CommandBarKind = "jj" | "shell";
export type SearchScopeId = "revision-log" | "operation-log" | "evolog";
export type SearchMode = "search" | "fast-jump";

export type ChangedFile = Readonly<{
  path: string;
  status: string;
  hasConflict?: boolean;
}>;

export type RevisionSummary = Readonly<{
  rowId: string;
  revisionId: string;
  parentRevisionIds?: readonly string[];
  changeIdPrefixLength: number;
  commitId: string;
  description: string;
  localTimestamp: string;
  bookmarks: readonly string[];
  workspaces: readonly string[];
  graphRows: readonly string[];
  isEmpty: boolean;
  hasConflict: boolean;
  marker: RevisionMarker;
  filesLoaded: boolean;
  files: readonly ChangedFile[];
}>;

export type OperationLogEntry = Readonly<{
  id: string;
  lines: readonly string[];
  // Only populated for evolog entries: the commit id of that historical
  // version, used to fetch its diff for the preview pane.
  commitId?: string;
}>;

export type PreviewPosition = "right" | "below";

// A session position preference set via `shift+p`. Includes `"auto"` so the user
// can cycle back to the responsive layout after pinning a fixed side.
export type PreviewPositionPreference = PreviewPosition | "auto";

export type RepositoryData = Readonly<{
  repoPath: string;
  revisions: readonly RevisionSummary[];
}>;

export type CommandDraftKind = "rebase" | "duplicate" | "revert" | "squash" | "bookmark-move" | "restore" | "interdiff" | "diff" | "absorb" | "set-parents" | "new-between";

export type CommandDraftConfig = Readonly<{
  kind: CommandDraftKind;
  template: string;
  badgeText: string;
  sourceBadgeText: string;
}>;

export type BookmarkSuggestionBucket = "current" | "behind" | "ahead" | "other";

export type BookmarkSuggestion = Readonly<{
  name: string;
  targetChangeId: string;
  bucket: BookmarkSuggestionBucket;
  distance: number;
}>;

export type CommandBarBookmarkContext = Readonly<{
  focusedRevisionId: string;
  initialCursorOffset: number;
  suggestions: readonly BookmarkSuggestion[];
}>;

export type RebaseSourceKind = "revisions" | "source" | "branch";
export type RebaseTargetKind = "destination" | "insert-before" | "insert-after" | "insert-between";

export type CommandDraft = Readonly<{
  config: CommandDraftConfig;
  descendantRevisionIds?: readonly string[];
  includeAnchor?: boolean;
  anchorRevisionIds?: readonly string[];
  rebaseSourceKind?: RebaseSourceKind;
  rebaseTargetKind?: RebaseTargetKind;
  rebaseSkipEmptied?: boolean;
  rebaseInsertAfterRevisionId?: string;
  interdiffSwapped?: boolean;
  absorbDefaultRowIds?: readonly string[];
  absorbSourceRevisionId?: string;
  setParentsSubjectRevisionId?: string;
  newBetweenBeforeRowIds?: readonly string[];
}>;

export type StatusLevel = "info" | "success" | "warning" | "error";

// A toast variant carries presentation semantics beyond its level. "help"
// toasts hold `jj help`/`--help` output: they persist until dismissed, use a
// blue border, and expand to fit their text up to the available height.
export type StatusMessageVariant = "help";

export type StatusMessage = Readonly<{
  id: string;
  text: string;
  level: StatusLevel;
  variant?: StatusMessageVariant;
  createdAt: number;
  lastInteractedAt: number;
}>;

export type EventLogEntry = Readonly<{
  id: string;
  text: string;
  level: StatusLevel;
  createdAt: number;
}>;

export type CommandBarState = Readonly<{
  kind: CommandBarKind;
  text: string;
  manual: boolean;
  // When true the jj bar opens directly in structured "complete at point"
  // completion instead of command history, so prefilled subcommands immediately
  // surface their completions.
  startInCompose?: boolean;
}>;

export type FailedCommand = Readonly<{
  commandText: string;
  commandArgs: readonly string[];
  interactive: boolean;
  errorText: string;
  stderr: string;
  statusMessageId?: string;
}>;

export type DiffViewerState = Readonly<{
  content: string;
}>;

export type AppState = Readonly<{
  repoPath: string;
  revisions: readonly RevisionSummary[];
  operationLogEntries: readonly OperationLogEntry[];
  operationLogLoading: boolean;
  evologEntries: readonly OperationLogEntry[];
  evologLoading: boolean;
  evologRevisionLabel: string;
  focusMode: FocusMode;
  focusModeStack: readonly FocusMode[];
  inlineConfirmation?: InlineConfirmation | null;
  shortcutPanelExpanded: boolean;
  focusedRevisionIndex: number;
  revisionScrollRequest: number;
  focusedOperationLogIndex: number;
  focusedEvologIndex: number;
  expandedRowId: string | null;
  focusedFileIndex: number;
  selectedRowIds: readonly string[];
  markedRowIds: readonly string[];
  selectedFilePaths: readonly string[];
  commandBar: CommandBarState;
  commandDraft: CommandDraft | null;
  lastFailedCommand: FailedCommand | null;
  statusMessages: readonly StatusMessage[];
  eventLog: readonly EventLogEntry[];
  notificationHistoryLimit: number;
  focusedNotificationIndex: number;
  expandedNotificationIds: readonly string[];
  loading: boolean;
  lastRefreshedAt: number;
  useShortFlags: boolean;
  layout: AppLayout;
  revsetQuery: string;
  revsetInputQuery: string | null;
  searchQuery: string;
  searchScope: SearchScopeId | null;
  searchStartIndex: number | null;
  searchIdOnly: boolean;
  searchMode: SearchMode;
  diffViewer: DiffViewerState | null;
  commandBarBookmark: CommandBarBookmarkContext | null;
  // Preview pane session overrides. `null` means "follow config default".
  previewPositionOverride: PreviewPositionPreference | null;
  previewVisibleOverride: boolean | null;
  previewSizePercentOverride: number | null;
  previewWordWrap: boolean;
  previewFullFile: boolean;
}>;

export type SampleRepoMaterialization = Readonly<{
  repoPath: string;
  workspacePaths: Readonly<Record<string, string>>;
}>;
