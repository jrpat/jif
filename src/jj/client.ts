import { CommandExecutionError, runCommand } from "./process.ts";
import type {
  ChangedFile,
  OperationLogEntry,
  RepositoryData,
  RevisionMarker,
  RevisionSummary,
} from "../domain/types.ts";
import { createRowId, createSyntheticRowId } from "../domain/rowIds.ts";
import { getChangeIdFromRevisionId } from "../domain/revisionIds.ts";
import { getMaxRevisionBaseGraphRowCount } from "../ui/revisionLayout.ts";
import {
  COMMAND_ALIAS_CONFIG_TEMPLATE,
  parseCommandAliasConfigOutput,
  type JjCommandAlias,
} from "./commandAliases.ts";

const FIELD_SEPARATOR = "\u001f";
const ROW_KIND_HEADER = "header";
const ROW_KIND_BODY = "body";
const LOG_TEMPLATE = buildLogTemplate(getMaxRevisionBaseGraphRowCount());
const FALLBACK_REPOSITORY_LOAD_LIMIT = 250;
const FALLBACK_OPERATION_LOG_LIMIT = 200;
const FULL_FILE_DIFF_CONTEXT_LINES = 999999;

export type WorkingCopyRefreshMode = "snapshot" | "read-only";

export type WorkingCopyRefreshOptions = Readonly<{
  workingCopy?: WorkingCopyRefreshMode;
}>;

type JjRunOptions = Readonly<{
  color?: boolean;
  cwd?: string;
}> & WorkingCopyRefreshOptions;

export type PreviewDiffOptions = Readonly<{
  fullFile?: boolean;
}>;

function previewDiffArgs(args: readonly string[], options?: PreviewDiffOptions): string[] {
  return options?.fullFile
    ? [...args, "--context", String(FULL_FILE_DIFF_CONTEXT_LINES)]
    : [...args];
}

export function resolveRepositoryLoadLimit(
  rawValue = process.env.JIF_REPOSITORY_LOAD_LIMIT,
  fallback = FALLBACK_REPOSITORY_LOAD_LIMIT,
): number {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

export const DEFAULT_REPOSITORY_LOAD_LIMIT = resolveRepositoryLoadLimit();
export const DEFAULT_OPERATION_LOG_LIMIT = FALLBACK_OPERATION_LOG_LIMIT;

export class JjClient {
  constructor(readonly repoPath: string) {}

  async loadRepository(
    limit = DEFAULT_REPOSITORY_LOAD_LIMIT,
    revset?: string,
    options?: WorkingCopyRefreshOptions,
  ): Promise<RepositoryData> {
    const args = [
      "log",
      "--limit",
      String(limit),
      "--color",
      "never",
      "--template",
      LOG_TEMPLATE,
    ];
    if (revset) {
      args.push("-r", revset);
    }
    const logOutput = await this.runJj(args, options);

    const revisions = parseLogOutput(logOutput.stdout);

    return {
      repoPath: this.repoPath,
      revisions,
    };
  }

  async loadElidedRevisions(
    afterRevisionId: string,
    beforeRevisionId: string | null,
    limit = 20,
  ): Promise<readonly RevisionSummary[]> {
    const revset = beforeRevisionId
      ? `${afterRevisionId}::${beforeRevisionId} ~ ${afterRevisionId} ~ ${beforeRevisionId}`
      : `${afterRevisionId}::`;
    const args = [
      "log",
      "--limit",
      String(limit),
      "--color",
      "never",
      "--template",
      LOG_TEMPLATE,
      "-r",
      revset,
    ];
    const logOutput = await this.runJj(args);
    return parseLogOutput(logOutput.stdout);
  }

  async loadConflictedFiles(revisionId: string): Promise<ReadonlySet<string>> {
    try {
      const result = await this.runJj([
        "resolve",
        "--list",
        "-r",
        revisionId,
        "--color",
        "never",
      ]);

      const paths = new Set<string>();
      for (const line of result.stdout.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        const path = trimmed.replace(/\s+\d+-sided conflict$/, "").trim();
        if (path.length > 0) paths.add(path);
      }
      return paths;
    } catch {
      return new Set();
    }
  }

  async loadChangedFiles(revisionId: string): Promise<readonly ChangedFile[]> {
    const result = await this.runJj([
      "diff",
      "--revisions",
      revisionId,
      "--summary",
      "--color",
      "never",
    ]);

    return result.stdout
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .map(parseChangedFile);
  }

  async loadKnownFiles(): Promise<readonly string[]> {
    const result = await this.runJj([
      "file",
      "list",
      "-r",
      "@",
      "--color",
      "never",
    ]);

    const seen = new Set<string>();
    const files: string[] = [];
    for (const line of result.stdout.split("\n")) {
      const path = line.trimEnd();
      if (path.length === 0 || seen.has(path)) {
        continue;
      }
      seen.add(path);
      files.push(path);
    }
    return files;
  }

  async loadOperationLog(limit = DEFAULT_OPERATION_LOG_LIMIT): Promise<readonly OperationLogEntry[]> {
    const result = await this.runJj([
      "op",
      "log",
      "--color",
      "always",
      "--ignore-working-copy",
      "--limit",
      String(limit),
    ], {
      color: true,
    });

    return parseOperationLogOutput(result.stdout);
  }

  async loadEvolog(revisionArg: string): Promise<readonly OperationLogEntry[]> {
    const result = await this.runJj([
      "evolog",
      "-r",
      revisionArg,
      "--color",
      "always",
      "--ignore-working-copy",
    ], {
      color: true,
    });

    return parseEvolutionLogOutput(result.stdout);
  }

  async loadOperationDiff(operationId: string): Promise<string> {
    const result = await this.runJj([
      "operation",
      "diff",
      "--operation",
      operationId,
      "--color",
      "always",
    ], { color: true });
    return result.stdout;
  }

  async loadInterdiff(commandArgs: readonly string[]): Promise<string> {
    const result = await this.runJj(["--color", "always", ...commandArgs], { color: true });
    return result.stdout;
  }

  // Preview-pane diffs are fetched in git format (not colored): OpenTUI's
  // `<diff>` component parses the raw patch itself and applies its own
  // highlighting, so ANSI would break it. All are read-only (no snapshot).
  async loadRevisionDiff(revisionArg: string): Promise<string> {
    const result = await this.runJj(
      ["diff", "-r", revisionArg, "--git"],
      { workingCopy: "read-only" },
    );
    return result.stdout;
  }

  async loadRevisionDescription(revisionArg: string): Promise<string> {
    const result = await this.runJj(
      ["log", "--no-graph", "--color", "never", "-r", revisionArg, "-T", "description"],
      { workingCopy: "read-only" },
    );
    return result.stdout;
  }

  async loadFileDiff(revisionArg: string, path: string, options?: PreviewDiffOptions): Promise<string> {
    const result = await this.runJj(
      [...previewDiffArgs(["diff", "-r", revisionArg, "--git"], options), path],
      { workingCopy: "read-only" },
    );
    return result.stdout;
  }

  async loadOperationDiffGit(operationId: string): Promise<string> {
    const result = await this.runJj(
      ["operation", "diff", "--operation", operationId, "--git"],
      { workingCopy: "read-only" },
    );
    return result.stdout;
  }

  async loadEvologEntryDiff(commitId: string): Promise<string> {
    const result = await this.runJj(
      ["evolog", "-r", commitId, "--git", "-p", "-n", "1"],
      { workingCopy: "read-only" },
    );
    return result.stdout;
  }

  async resolveDescendants(revisionId: string): Promise<readonly string[]> {
    return this.resolveRevset(`${revisionId}::`);
  }

  async resolveRange(from: string, to: string): Promise<readonly string[]> {
    return this.resolveRevset(`${from}::${to}`);
  }

  async resolveAbsorbTargets(source: string): Promise<readonly string[]> {
    return this.resolveRevset(`mutable() & ::${source}-`);
  }

  private async resolveRevset(revset: string): Promise<readonly string[]> {
    const shortRevisionId = 'change_id.shortest(8) ++ if(divergent, surround("/", "", change_offset))';
    const result = await this.runJj([
      "log",
      "--revisions",
      revset,
      "--no-graph",
      "--color",
      "never",
      "--template",
      `${shortRevisionId} ++ "\\n"`,
    ]);

    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  async executeCommand(commandText: string): Promise<string> {
    const args = tokenizeCommandText(commandText.trim());
    if (args.length === 0) {
      return "";
    }

    return await this.executeCommandArgs(args);
  }

  async executeCommandArgs(args: readonly string[], options?: { cwd?: string }): Promise<string> {
    if (args.length === 0) {
      return "";
    }

    const result = await this.runJj(["--color", "always", ...args], {
      color: true,
      cwd: options?.cwd,
    });
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    return stderr || stdout || `Executed: jj ${quoteCommand(args)}`;
  }

  async verifyRepository(options?: WorkingCopyRefreshOptions): Promise<void> {
    await this.runJj(["root"], options);
  }

  async loadWorkspaceRoot(options?: WorkingCopyRefreshOptions): Promise<string> {
    const result = await this.runJj(["workspace", "root"], options);
    return result.stdout.trim();
  }

  async loadDefaultRevset(options?: WorkingCopyRefreshOptions): Promise<string> {
    try {
      const result = await this.runJj(["config", "get", "revsets.log"], options);
      return result.stdout.trim();
    } catch {
      return "";
    }
  }

  async loadBookmarks(): Promise<string[]> {
    try {
      const result = await this.runJj(["bookmark", "list", "--color", "never"]);
      return result.stdout
        .split("\n")
        .map((line) => line.match(/^(\S+)/)?.[1])
        .filter((name): name is string => !!name);
    } catch {
      return [];
    }
  }

  async loadBookmarkTargets(): Promise<readonly { name: string; changeId: string }[]> {
    try {
      const template = `if(remote, "", name ++ "\\t" ++ self.normal_target().change_id().shortest(8) ++ "\\n")`;
      const result = await this.runJj([
        "bookmark",
        "list",
        "--color",
        "never",
        "-T",
        template,
      ]);
      const seen = new Set<string>();
      const targets: { name: string; changeId: string }[] = [];
      for (const line of result.stdout.split("\n")) {
        if (line.length === 0) continue;
        const tab = line.indexOf("\t");
        if (tab < 0) continue;
        const name = line.slice(0, tab).trim();
        const changeId = line.slice(tab + 1).trim();
        if (name.length === 0 || changeId.length === 0) continue;
        if (name.includes("@")) continue;
        if (seen.has(name)) continue;
        seen.add(name);
        targets.push({ name, changeId });
      }
      return targets;
    } catch {
      return [];
    }
  }

  async loadAncestorChangeIds(focusedChangeId: string, limit = 200): Promise<readonly string[]> {
    return this.loadChangeIdsForRevset(`ancestors(${focusedChangeId}) ~ ${focusedChangeId}`, limit);
  }

  async loadDescendantChangeIds(focusedChangeId: string, limit = 200): Promise<readonly string[]> {
    return this.loadChangeIdsForRevset(`descendants(${focusedChangeId}) ~ ${focusedChangeId}`, limit, { reversed: true });
  }

  private async loadChangeIdsForRevset(
    revset: string,
    limit: number,
    options?: { reversed?: boolean },
  ): Promise<readonly string[]> {
    try {
      const args = [
        "log",
        "-r",
        revset,
        "--no-graph",
        "--color",
        "never",
        "--limit",
        String(limit),
        "-T",
        `change_id.shortest(8) ++ "\\n"`,
      ];
      if (options?.reversed) {
        args.push("--reversed");
      }
      const result = await this.runJj(args);
      return result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    } catch {
      return [];
    }
  }

  async loadTags(): Promise<string[]> {
    try {
      const result = await this.runJj(["tag", "list", "--color", "never"]);
      return result.stdout
        .split("\n")
        .map((line) => line.match(/^(\S+)/)?.[1])
        .filter((name): name is string => !!name);
    } catch {
      return [];
    }
  }

  async loadAliases(): Promise<Record<string, string>> {
    try {
      const result = await this.runJj(["config", "list", "revset-aliases", "--color", "never"]);
      const aliases: Record<string, string> = {};
      for (const line of result.stdout.split("\n")) {
        const match = line.match(/^revset-aliases\.([^=]+)=(.*)$/);
        if (match) {
          const name = match[1]!.replace(/^"(.*)"$/, "$1");
          aliases[name] = match[2]!.trim().replace(/^"(.*)"$/, "$1");
        }
      }
      return aliases;
    } catch {
      return {};
    }
  }

  async loadCommandAliases(): Promise<readonly JjCommandAlias[]> {
    try {
      const result = await this.runJj([
        "config",
        "list",
        "aliases",
        "-T",
        COMMAND_ALIAS_CONFIG_TEMPLATE,
        "--color",
        "never",
      ]);
      return parseCommandAliasConfigOutput(result.stdout);
    } catch {
      return [];
    }
  }

  // Capture the compact `-h` help for a (possibly nested) subcommand path, used
  // to drive structured command-bar completion. `-h` exits 0 and never touches
  // the repo, so we just return stdout, swallowing any failure into "" so the
  // completion layer can fall back to history.
  async runHelp(path: readonly string[]): Promise<string> {
    try {
      const result = await this.runJj([...path, "-h"]);
      return result.stdout;
    } catch {
      return "";
    }
  }

  private async runJj(args: readonly string[], options?: JjRunOptions) {
    const workingCopyArgs = options?.workingCopy === "read-only"
      ? ["--ignore-working-copy"]
      : [];
    return await runCommand(options?.cwd ?? this.repoPath, ["jj", ...workingCopyArgs, ...args], options);
  }
}

export function parseLogOutput(
  output: string,
): readonly RevisionSummary[] {
  const revisions: RevisionSummary[] = [];

  for (const rawLine of output.split("\n")) {
    if (rawLine.length === 0) {
      continue;
    }

    if (!rawLine.includes(FIELD_SEPARATOR)) {
      if (isElidedLine(rawLine)) {
        const graphMatch = /^(?<graph>.*?)(?=\()/.exec(rawLine);
        revisions.push({
          rowId: createSyntheticRowId("elided", String(revisions.length)),
          revisionId: `__elided_${revisions.length}`,
          parentRevisionIds: [],
          changeIdPrefixLength: 0,
          commitId: "",
          description: "(elided revisions)",
          localTimestamp: "",
          bookmarks: [],
          workspaces: [],
          graphRows: [graphMatch?.groups?.graph ?? "~  "],
          isEmpty: false,
          hasConflict: false,
          marker: "elided",
          filesLoaded: true,
          files: [],
        });
      } else {
        const previous = revisions.at(-1);
        if (previous) {
          revisions[revisions.length - 1] = {
            ...previous,
            graphRows: [...previous.graphRows, rawLine],
          };
        }
      }
      continue;
    }

    const [visibleGraph = "", rowKind = "", ...fields] = rawLine.split(FIELD_SEPARATOR);
    if (rowKind === ROW_KIND_HEADER) {
      const [
        rawRevisionId = "",
        commitId = "",
        rawDescription = "",
        rawBookmarks = "",
        rawWorkspaces = "",
        rawChangeIdPrefix = "",
        rawEmpty = "",
        rawTimestamp = "",
        rawConflict = "",
        rawParentRevisionIds = "",
      ] = fields;
      if (rawRevisionId.length === 0) {
        continue;
      }

      const revisionId = rawRevisionId.trim();
      const commitIdentity = commitId.trim();
      const graphRow = extractGraphPrefix(visibleGraph, revisionId);
      const isEmpty = rawEmpty.trim() === "true";
      const hasConflict = rawConflict.trim() === "true";
      revisions.push({
        rowId: createRowId(commitIdentity, revisionId),
        revisionId,
        parentRevisionIds: splitCsv(rawParentRevisionIds),
        changeIdPrefixLength: rawChangeIdPrefix.trim().length || getChangeIdFromRevisionId(revisionId).length,
        commitId: commitIdentity,
        description: rawDescription.trim() || (isEmpty ? "(empty) (no description)" : "(no description)"),
        localTimestamp: rawTimestamp.trim(),
        bookmarks: splitWords(rawBookmarks),
        workspaces: splitCsv(rawWorkspaces),
        graphRows: [graphRow],
        isEmpty,
        hasConflict,
        marker: deriveRevisionMarker(graphRow),
        filesLoaded: isEmpty,
        files: [],
      });
      continue;
    }

    if (rowKind === ROW_KIND_BODY) {
      const [revisionId = ""] = fields;
      const previous = revisions.at(-1);
      if (previous && previous.revisionId === revisionId) {
        revisions[revisions.length - 1] = {
          ...previous,
          graphRows: [...previous.graphRows, visibleGraph],
        };
      }
    }
  }

  return revisions;
}

export function parseOperationLogOutput(output: string): readonly OperationLogEntry[] {
  const entries: OperationLogEntry[] = [];
  let currentId: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentId === null) {
      return;
    }

    entries.push({ id: currentId, lines: currentLines });
    currentId = null;
    currentLines = [];
  };

  for (const line of output.split("\n")) {
    if (line.length === 0) {
      if (currentId !== null) {
        currentLines.push(line);
      }
      continue;
    }

    const operationId = parseOperationIdFromLine(line);
    if (operationId !== null) {
      flush();
      currentId = operationId;
      currentLines = [stripJifInternalFlagsFromArgsLine(line)];
      continue;
    }

    if (currentId !== null) {
      currentLines.push(stripJifInternalFlagsFromArgsLine(line));
    }
  }

  flush();
  return entries;
}

const EVOLOG_GRAPH_NODE_CHARS = new Set(["@", "○", "◆", "×", "*", "+"]);
const EVOLOG_OPERATION_ID_PATTERN = /--\s+operation\s+([0-9a-f]{8,})/;
const EVOLOG_COMMIT_ID_PATTERN = /\b[0-9a-f]{8,}\b/g;

// The commit id of a historical version is the trailing hex token on the
// entry's header line (change ids use the k–z alphabet, so they never match).
// Used to fetch that version's diff for the preview pane.
function parseEvologCommitId(headerLine: string): string | undefined {
  const plain = headerLine.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
  const matches = plain.match(EVOLOG_COMMIT_ID_PATTERN);
  return matches && matches.length > 0 ? matches[matches.length - 1] : undefined;
}

export function parseEvolutionLogOutput(output: string): readonly OperationLogEntry[] {
  const entries: OperationLogEntry[] = [];
  let currentLines: string[] = [];
  let currentIndex = 0;

  const flush = () => {
    if (currentLines.length === 0) {
      return;
    }

    let id: string | null = null;
    for (const line of currentLines) {
      const plain = line.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
      const match = plain.match(EVOLOG_OPERATION_ID_PATTERN);
      if (match) {
        id = match[1] ?? null;
        break;
      }
    }

    const commitId = parseEvologCommitId(currentLines[0] ?? "");
    entries.push({
      id: id ?? `evolog-${currentIndex}`,
      lines: currentLines,
      ...(commitId ? { commitId } : {}),
    });
    currentIndex += 1;
    currentLines = [];
  };

  for (const line of output.split("\n")) {
    const plain = line.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").trimStart();
    const firstChar = plain.charAt(0);
    if (firstChar.length > 0 && EVOLOG_GRAPH_NODE_CHARS.has(firstChar)) {
      flush();
    }

    if (currentLines.length === 0 && line.length === 0) {
      continue;
    }

    currentLines.push(line);
  }

  flush();
  return entries;
}

// jif injects --color into argv so jj emits colored output through pipes.
// jj records the argv it received in its op log; we strip that injection
// here so the user's view matches what they typed. See spec/command-display.md.
function stripJifInternalFlagsFromArgsLine(line: string): string {
  const bare = line.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
  if (!/(^|\s)args: jj /.test(bare)) {
    return line;
  }
  return line.replace(/ --color(?:\s+|=)[^\s\x1b]+/g, "");
}

function buildLogTemplate(baseGraphRowCount: number): string {
  const shortChangeId = "change_id.shortest(8)";
  const shortRevisionId = `${shortChangeId} ++ if(divergent || self.hidden(), surround("/", "", change_offset))`;
  const parentRevisionIds = 'parents.map(|p| p.change_id().shortest(8) ++ if(p.divergent() || p.hidden(), surround("/", "", p.change_offset()))).join(",")';
  const rows = [
    `${shortRevisionId} ++ "${FIELD_SEPARATOR}" ++ "${ROW_KIND_HEADER}" ++ "${FIELD_SEPARATOR}" ++ ${shortRevisionId} ++ "${FIELD_SEPARATOR}" ++ commit_id ++ "${FIELD_SEPARATOR}" ++ description.first_line() ++ "${FIELD_SEPARATOR}" ++ bookmarks ++ "${FIELD_SEPARATOR}" ++ working_copies.map(|wc| wc.name()).join(",") ++ "${FIELD_SEPARATOR}" ++ ${shortChangeId}.prefix() ++ "${FIELD_SEPARATOR}" ++ empty ++ "${FIELD_SEPARATOR}" ++ author.timestamp().local().format("%Y-%m-%d %H:%M:%S") ++ "${FIELD_SEPARATOR}" ++ conflict ++ "${FIELD_SEPARATOR}" ++ ${parentRevisionIds} ++ "\\n"`,
  ];

  for (let index = 1; index < baseGraphRowCount; index += 1) {
    rows.push(`"${FIELD_SEPARATOR}" ++ "${ROW_KIND_BODY}" ++ "${FIELD_SEPARATOR}" ++ ${shortRevisionId} ++ "\\n"`);
  }

  return rows.join(" ++ ");
}

function parseOperationIdFromLine(line: string): string | null {
  const plainLine = line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").trimStart();
  const match = plainLine.match(/^(?:[^A-Za-z0-9]*\s*)?(?<id>[0-9a-f]{12,})\b/i);
  return match?.groups?.id ?? null;
}

function splitWords(rawValue: string): readonly string[] {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return [];
  }

  return trimmed.split(/\s+/);
}

function splitCsv(rawValue: string): readonly string[] {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return [];
  }

  return trimmed.split(",").map((value) => value.trim()).filter((value) => value.length > 0);
}

function isElidedLine(line: string): boolean {
  return /~.*\(elided revisions\)/.test(line);
}

function extractGraphPrefix(visibleGraph: string, revisionId: string): string {
  if (visibleGraph.endsWith(revisionId)) {
    return visibleGraph.slice(0, -revisionId.length);
  }

  const graphMatch = /^(?<graph>.*?)(?<revision>[a-z0-9]+(?:\/\d+)?)$/.exec(visibleGraph);
  if (graphMatch?.groups?.revision === revisionId) {
    return graphMatch.groups.graph ?? "";
  }

  return visibleGraph;
}

function deriveRevisionMarker(graphRow: string): RevisionMarker {
  if (graphRow.includes("@") || graphRow.includes("×")) {
    return "working-copy";
  }
  if (graphRow.includes("◆")) {
    return "immutable";
  }
  if (graphRow.includes("*")) {
    return "bookmark";
  }
  return "plain";
}

function parseChangedFile(line: string): ChangedFile {
  const status = line.slice(0, 1);
  const path = line.slice(2).trim();
  return { status, path };
}

export function tokenizeCommandText(commandText: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escape = false;

  for (const char of commandText) {
    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function quoteCommand(command: readonly string[]): string {
  return command
    .map((part) => {
      if (/^[A-Za-z0-9_./:-]+$/.test(part)) {
        return part;
      }

      return JSON.stringify(part);
    })
    .join(" ");
}
