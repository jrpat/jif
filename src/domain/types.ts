export type RevisionMarker = "working-copy" | "bookmark" | "plain" | "immutable";

export type ChangedFile = Readonly<{
  path: string;
  status: string;
}>;

export type RevisionSummary = Readonly<{
  changeId: string;
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

export type RebaseCommandDraft = Readonly<{
  kind: "rebase";
  sourceRevisionId: string;
  includeDescendants: boolean;
  affectedRevisionIds: readonly string[];
}>;

export type CommandDraft = RebaseCommandDraft;

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
  focus: boolean;
  manual: boolean;
  text: string;
  cursor: number;
}>;

export type AppState = Readonly<{
  repoPath: string;
  graphWidth: number;
  revisions: readonly RevisionSummary[];
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
