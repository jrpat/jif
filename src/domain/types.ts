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
  | "file-filter"
  | "op-log"
  | "evolog"
  | "inline-confirmation"
  | "command"
  | "revset"
  | "file-search"
  | "search"
  | "shortcut-filter"
  | "diff-viewer"
  | "notifications"
  | "bookmark"
  | "preview"
  | "extra";
export type AppLayout = "loose" | "normal" | "tight";
export type CommandBarKind = "jj" | "shell";
export type SearchScopeId = "revision-log" | "operation-log" | "evolog";
export type SearchMode = "search" | "fast-jump";

export type ChangedFile = Readonly<{
  // A real repository path jj accepts as a fileset argument. For a rename/copy
  // this is the post-change (new) path — never the `{old => new}` display form.
  path: string;
  // The compressed `src/{old => new}.ext` form jj prints for a rename/copy, kept
  // only for display in the file list. Absent for ordinary add/modify/delete.
  displayPath?: string;
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

export type WorkspaceRef = Readonly<{
  name: string;
  rootPath: string;
}>;

export type OperationLogEntry = Readonly<{
  id: string;
  lines: readonly string[];
  // Only populated for evolog entries: the commit id of that historical
  // version, used to fetch its diff for the preview pane.
  commitId?: string;
}>;

export type PreviewPosition = "right" | "below";

// An ad-hoc diff pinned into the preview pane (a composed `jj diff`/`jj
// interdiff` result). While one is pinned the pane shows it instead of the
// diff derived from whatever row is focused; leaving Preview mode drops it.
export type PreviewPin = Readonly<{
  header: string;
  diff: string;
}>;

// A session position preference set via `alt+p`. Includes `"auto"` so the user
// can cycle back to the responsive layout after pinning a fixed side.
export type PreviewPositionPreference = PreviewPosition | "auto";

export type RepositoryData = Readonly<{
  repoPath: string;
  workspaceRefs?: readonly WorkspaceRef[];
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

/**
 * How a diff draft turns its picked revisions into a `jj diff` invocation.
 *
 * - `range` — `jj diff -r A::B`, the combined change of every revision from A
 *   through B, both endpoints included. The default, because it is the reading
 *   of "diff these revisions" that a chip pair can state unambiguously.
 * - `between` — `jj diff --from A --to B`, comparing the two trees. A's own
 *   change is *not* part of the result, and A and B need not be related.
 * - `descendants` — `jj diff -r A::`, A plus everything descended from it. jj
 *   merges the heads when the descendants fan out.
 */
export type DiffRangeKind = "range" | "between" | "descendants";

export type RebaseSourceKind = "revisions" | "source" | "branch";
export type RebaseTargetKind = "destination" | "insert-before" | "insert-after" | "insert-between";
export type RebaseSelectionKind = "subject" | "target";

export type CommandDraft = Readonly<{
  config: CommandDraftConfig;
  descendantRevisionIds?: readonly string[];
  includeAnchor?: boolean;
  anchorRevisionIds?: readonly string[];
  rebaseSourceKind?: RebaseSourceKind;
  rebaseTargetKind?: RebaseTargetKind;
  rebaseSkipEmptied?: boolean;
  rebaseInsertAfterRevisionId?: string;
  // Explicit override of what the spacebar selects; undefined derives the
  // default from the source kind (subjects for -r, targets for -s/-b).
  rebaseSelectionKind?: RebaseSelectionKind;
  // Pinned additional target rows; while non-empty they replace the
  // cursor-following target.
  rebaseTargetRowIds?: readonly string[];
  interdiffSwapped?: boolean;
  diffRangeKind?: DiffRangeKind;
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
  commandText?: string;
  level: StatusLevel;
  variant?: StatusMessageVariant;
  createdAt: number;
  lastInteractedAt: number;
}>;

export type EventLogEntry = Readonly<{
  id: string;
  text: string;
  commandText?: string;
  level: StatusLevel;
  createdAt: number;
}>;

export type CommandBarState = Readonly<{
  kind: CommandBarKind;
  text: string;
  manual: boolean;
  // Direct commands routed through dry-run mode retain the execution behavior
  // of the action that composed them when the edited prompt is submitted.
  submissionOptions?: Readonly<{
    interactive: boolean;
    cwd?: string;
    focusWorkingCopyAfterRefresh?: boolean;
  }>;
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
  workspaceRefs: readonly WorkspaceRef[];
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
  shortcutFilterQuery: string;
  focusedRevisionIndex: number;
  revisionScrollRequest: number;
  focusedOperationLogIndex: number;
  focusedEvologIndex: number;
  expandedRowId: string | null;
  focusedFileIndex: number;
  // Stable identity for file focus. Unlike the display index, this survives
  // the brief empty list while a rewritten revision reloads its files.
  focusedFilePath: string | null;
  // Case-insensitive substring narrowing the expanded revision's file list.
  // Scoped to that revision: collapsing or moving to another one clears it.
  fileFilterQuery: string;
  selectedRowIds: readonly string[];
  markedRowIds: readonly string[];
  selectedFilePaths: readonly string[];
  commandBar: CommandBarState;
  dryRun: boolean;
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
  // Commits revealed by expanding elided log rows. Unioned into the log revset
  // on every refresh so expansions survive reloads; in-memory only and cleared
  // when the revset changes, so they never outlive the session.
  revealedCommitIds: readonly string[];
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
  // Preview mode only: the pane takes over the whole screen instead of sharing
  // it with the log. Cleared on leaving Preview mode.
  previewFullScreen: boolean;
  previewPin: PreviewPin | null;
}>;

export type SampleRepoMaterialization = Readonly<{
  repoPath: string;
  workspacePaths: Readonly<Record<string, string>>;
}>;
