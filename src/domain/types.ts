export type RevisionMarker = "working-copy" | "bookmark" | "plain" | "immutable" | "elided";

export type FocusMode = "revisions" | "files" | "command" | "revset" | "search";
export type AppLayout = "expanded" | "condensed" | "super-condensed";

export type ChangedFile = Readonly<{
  path: string;
  status: string;
  hasConflict?: boolean;
}>;

export type RevisionSummary = Readonly<{
  changeId: string;
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
  id: string;
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
  shortcutPanelExpanded: boolean;
  focusedRevisionIndex: number;
  expandedRevisionId: string | null;
  focusedFileIndex: number;
  selectedRevisionIds: readonly string[];
  selectedFilePaths: readonly string[];
  commandBar: CommandBarState;
  commandDraft: CommandDraft | null;
  statusMessages: readonly StatusMessage[];
  eventLog: readonly EventLogEntry[];
  loading: boolean;
  useShortFlags: boolean;
  layout: AppLayout;
  revsetQuery: string;
  searchQuery: string;
}>;

export type SampleRepoMaterialization = Readonly<{
  repoPath: string;
  workspacePaths: Readonly<Record<string, string>>;
}>;
