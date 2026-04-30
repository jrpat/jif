export type FileStatusType = "A" | "M" | "D" | "R" | "C" | "X";

export type FileStatus = Readonly<{
  type: FileStatusType;
  file: string;
  path: string;
  renamedFrom?: string;
}>;

export type ChangeSummary = Readonly<{
  changeId: string;
  commitId: string;
  description: string;
  bookmarks: readonly string[];
  isEmpty: boolean;
  isConflict: boolean;
  divergent?: boolean;
  changeOffset?: string;
}>;

export type RepositoryStatus = Readonly<{
  workingCopy: ChangeSummary;
  fileStatuses: readonly FileStatus[];
  conflictedFiles: ReadonlySet<string>;
}>;

export type RevisionShowResult = Readonly<{
  revision: ChangeSummary;
  fileStatuses: readonly FileStatus[];
  conflictedFiles: ReadonlySet<string>;
}>;

export type OperationLogEntry = Readonly<{
  id: string;
  description: string;
  tags: string;
  start: string;
  user: string;
  snapshot: boolean;
}>;

export type TrackedParentRevision = Readonly<{
  id: "parent-1" | "parent-2";
  label: "@-" | "@--";
  revset: "@-" | "@--";
  baseRevset: "@--" | "first_parent(@, 3)";
}>;

export type CommandOutput = Readonly<{
  stdout: string;
  stderr: string;
  exitCode: number;
}>;