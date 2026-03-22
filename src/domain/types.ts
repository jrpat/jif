export type RevisionMarker = "working-copy" | "bookmark" | "plain" | "immutable";

export type FocusMode = "revisions" | "files" | "command";

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
  graphWidth: number;
}>;

export type CommandDraftKind = "rebase" | "squash";

export type CommandDraftConfig = Readonly<{
  kind: CommandDraftKind;
  template: string;
  badgeText: string;
}>;

export type CommandDraft = Readonly<{
  config: CommandDraftConfig;
  selectedRevisionIds: readonly string[];
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
  graphWidth: number;
  revisions: readonly RevisionSummary[];
  focusMode: FocusMode;
  focusedRevisionIndex: number;
  expandedRevisionId: string | null;
  focusedFileIndex: number;
  commandBar: CommandBarState;
  commandDraft: CommandDraft | null;
  statusMessage: StatusMessage | null;
  eventLog: readonly EventLogEntry[];
  loading: boolean;
  error: string | null;
}>;

export type SampleRepoMaterialization = Readonly<{
  repoPath: string;
  workspacePaths: Readonly<Record<string, string>>;
}>;
