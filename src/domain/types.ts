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
  | "inline-confirmation"
  | "command"
  | "revset"
  | "search"
  | "diff-viewer";
export type AppLayout = "expanded" | "condensed" | "super-condensed";
export type CommandBarKind = "jj" | "shell";

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
}>;

export type RepositoryData = Readonly<{
  repoPath: string;
  revisions: readonly RevisionSummary[];
}>;

export type CommandDraftKind = "rebase" | "squash";

export type CommandDraftConfig = Readonly<{
  kind: CommandDraftKind;
  template: string;
  badgeText: string;
  sourceBadgeText: string;
}>;

export type CommandDraft = Readonly<{
  config: CommandDraftConfig;
  includeDescendants?: boolean;
  descendantRevisionIds?: readonly string[];
}>;

export type StatusLevel = "info" | "success" | "warning" | "error";

export type StatusMessage = Readonly<{
  id: string;
  text: string;
  level: StatusLevel;
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
  focusMode: FocusMode;
  focusModeStack: readonly FocusMode[];
  inlineConfirmation?: InlineConfirmation | null;
  shortcutPanelExpanded: boolean;
  focusedRevisionIndex: number;
  focusedOperationLogIndex: number;
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
  loading: boolean;
  useShortFlags: boolean;
  layout: AppLayout;
  revsetQuery: string;
  searchQuery: string;
  diffViewer: DiffViewerState | null;
}>;

export type SampleRepoMaterialization = Readonly<{
  repoPath: string;
  workspacePaths: Readonly<Record<string, string>>;
}>;
