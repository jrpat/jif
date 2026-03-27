export type RevisionMarker = "working-copy" | "bookmark" | "plain" | "immutable";

export type FocusMode = "revisions" | "files" | "command" | "revset";

export type ChangedFile = Readonly<{
  path: string;
  status: string;
}>;

export type RevisionSummary = Readonly<{
  changeId: string;
  changeIdPrefixLength: number;
  commitId: string;
  description: string;
  bookmarks: readonly string[];
  workspaces: readonly string[];
  graphHead: string;
  graphTail: readonly string[];
  marker: RevisionMarker;
  files: readonly ChangedFile[];
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
}>;

export type CommandDraft = Readonly<{
  config: CommandDraftConfig;
  includeDescendants?: boolean;
  descendantRevisionIds?: readonly string[];
}>;

export type StatusLevel = "info" | "success" | "warning" | "error";

export type StatusMessage = Readonly<{
  text: string;
  level: StatusLevel;
  createdAt: number;
}>;

export type EventLogEntry = Readonly<{
  id: string;
  text: string;
  level: StatusLevel;
  createdAt: number;
}>;

export type CommandBarState = Readonly<{
  text: string;
  manual: boolean;
}>;

export type AppState = Readonly<{
  repoPath: string;
  revisions: readonly RevisionSummary[];
  focusMode: FocusMode;
  focusedRevisionIndex: number;
  expandedRevisionId: string | null;
  focusedFileIndex: number;
  selectedRevisionIds: readonly string[];
  selectedFilePaths: readonly string[];
  commandBar: CommandBarState;
  commandDraft: CommandDraft | null;
  statusMessage: StatusMessage | null;
  eventLog: readonly EventLogEntry[];
  loading: boolean;
  error: string | null;
  useShortFlags: boolean;
  condensedLayout: boolean;
  revsetQuery: string;
}>;

export type SampleRepoMaterialization = Readonly<{
  repoPath: string;
  workspacePaths: Readonly<Record<string, string>>;
}>;
