import path from "node:path";
import { runCommand } from "./process.ts";
import { OPERATION_LOG_TEMPLATE, SHOW_TEMPLATE, STATUS_TEMPLATE } from "./templates.ts";
import type {
  ChangeSummary,
  FileStatus,
  FileStatusType,
  OperationLogEntry,
  RepositoryStatus,
  RevisionShowResult,
} from "./types.ts";

type RawChange = {
  change_id: string;
  commit_id: string;
  description: string;
  empty: boolean;
  conflict: boolean;
  divergent: boolean;
  change_offset: string;
  local_bookmarks: string[];
};

type RawDiffFile = {
  status_char: string;
  source_path: string;
  target_path: string;
  is_conflict: boolean;
};

type RawStatusEntry = RawChange & {
  diff_files: RawDiffFile[];
  conflicted_files: string[];
};

type RawOperationLogEntry = {
  id: string;
  description: string;
  tags: string;
  start: string;
  user: string;
  snapshot: boolean;
};

export class JjRepository {
  constructor(
    readonly repositoryRoot: string,
    readonly jjExecutable = "jj",
  ) {}

  async verifyRepository(): Promise<void> {
    await this.runRead(["root"]);
  }

  async getStatus(): Promise<RepositoryStatus> {
    const output = await this.runRead([
      "log",
      "-r",
      "@",
      "-T",
      STATUS_TEMPLATE,
      "--no-graph",
    ]);
    const entry = parseSingleJsonLine<RawStatusEntry>(output.stdout);

    return {
      workingCopy: toChangeSummary(entry),
      ...parseFileStatuses(this.repositoryRoot, entry.diff_files, entry.conflicted_files),
    };
  }

  async show(revset: string): Promise<RevisionShowResult> {
    const output = await this.runRead([
      "log",
      "-r",
      revset,
      "-T",
      SHOW_TEMPLATE,
      "--no-graph",
    ]);
    const entry = parseSingleJsonLine<RawStatusEntry>(output.stdout);

    return {
      revision: toChangeSummary(entry),
      ...parseFileStatuses(this.repositoryRoot, entry.diff_files, entry.conflicted_files),
    };
  }

  async tryShow(revset: string): Promise<RevisionShowResult | null> {
    try {
      return await this.show(revset);
    } catch {
      return null;
    }
  }

  async readFileAtRevision(revset: string, absolutePath: string): Promise<string> {
    const relativePath = path.relative(this.repositoryRoot, absolutePath).replace(/\\/g, "/");
    const output = await this.runRead([
      "file",
      "show",
      "--revision",
      revset,
      "--",
      relativePath,
    ]);
    return output.stdout;
  }

  async loadOperationLog(limit = 50): Promise<readonly OperationLogEntry[]> {
    const output = await this.runRead([
      "operation",
      "log",
      "--limit",
      String(limit),
      "-T",
      OPERATION_LOG_TEMPLATE,
      "--no-graph",
    ]);

    return output.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as RawOperationLogEntry)
      .map((entry) => ({
        id: entry.id,
        description: entry.description,
        tags: entry.tags,
        start: entry.start,
        user: entry.user,
        snapshot: entry.snapshot,
      }));
  }

  private async runRead(args: readonly string[]) {
    return await runCommand(this.repositoryRoot, [this.jjExecutable, "--ignore-working-copy", ...args]);
  }
}

export async function resolveRepositoryRoot(startPath: string, jjExecutable = "jj"): Promise<string> {
  const output = await runCommand(startPath, [jjExecutable, "--ignore-working-copy", "root"]);
  return output.stdout.trim();
}

function parseSingleJsonLine<T>(rawOutput: string): T {
  const line = rawOutput
    .split("\n")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0);

  if (!line) {
    throw new Error("jj returned no JSON output.");
  }

  return JSON.parse(line) as T;
}

function toChangeSummary(entry: RawChange): ChangeSummary {
  return {
    changeId: entry.change_id,
    commitId: entry.commit_id,
    description: entry.description,
    bookmarks: entry.local_bookmarks,
    isEmpty: entry.empty,
    isConflict: entry.conflict,
    divergent: entry.divergent || undefined,
    changeOffset: entry.change_offset || undefined,
  };
}

function parseFileStatuses(
  repositoryRoot: string,
  diffFiles: readonly RawDiffFile[],
  conflictedPaths: readonly string[],
): Pick<RepositoryStatus, "fileStatuses" | "conflictedFiles"> {
  const fileStatuses: FileStatus[] = [];
  const knownPaths = new Set<string>();
  const conflictedFiles = new Set<string>();

  for (const diffFile of diffFiles) {
    const targetPath = normalizeRepoPath(repositoryRoot, diffFile.target_path);
    const sourcePath = normalizeRepoPath(repositoryRoot, diffFile.source_path);
    const fileStatus: FileStatus = {
      type: diffFile.status_char as FileStatusType,
      file: path.basename(targetPath),
      path: targetPath,
      ...(diffFile.status_char === "R" || diffFile.status_char === "C"
        ? { renamedFrom: sourcePath }
        : {}),
    };
    fileStatuses.push(fileStatus);
    knownPaths.add(targetPath);
  }

  for (const conflictedPath of conflictedPaths) {
    const absolutePath = normalizeRepoPath(repositoryRoot, conflictedPath);
    conflictedFiles.add(absolutePath);
    if (knownPaths.has(absolutePath)) {
      continue;
    }

    fileStatuses.push({
      type: "X",
      file: path.basename(absolutePath),
      path: absolutePath,
    });
  }

  return {
    fileStatuses,
    conflictedFiles,
  };
}

function normalizeRepoPath(repositoryRoot: string, filePath: string): string {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  return path.join(repositoryRoot, normalized);
}