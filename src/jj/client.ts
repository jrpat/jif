import { CommandExecutionError, runCommand } from "./process.ts";
import type {
  ChangedFile,
  RepositoryData,
  RevisionMarker,
  RevisionSummary,
} from "../domain/types.ts";
import { createRowId, createSyntheticRowId } from "../domain/rowIds.ts";
import { getChangeIdFromRevisionId } from "../domain/revisionIds.ts";
import { getMaxRevisionBaseGraphRowCount } from "../ui/revisionLayout.ts";

const FIELD_SEPARATOR = "\u001f";
const ROW_KIND_HEADER = "header";
const ROW_KIND_BODY = "body";
const LOG_TEMPLATE = buildLogTemplate(getMaxRevisionBaseGraphRowCount());

export class JjClient {
  constructor(readonly repoPath: string) {}

  async loadRepository(limit = 80, revset?: string): Promise<RepositoryData> {
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
    const logOutput = await this.runJj(args);

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

  async resolveDescendants(revisionId: string): Promise<readonly string[]> {
    const shortRevisionId = 'change_id.shortest(8) ++ if(divergent, surround("/", "", change_offset))';
    const result = await this.runJj([
      "log",
      "--revisions",
      `${revisionId}::`,
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

  async executeCommandArgs(args: readonly string[]): Promise<string> {
    if (args.length === 0) {
      return "";
    }

    const result = await this.runJj(["--color", "always", ...args], { color: true });
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    return stderr || stdout || `Executed: jj ${quoteCommand(args)}`;
  }

  async verifyRepository(): Promise<void> {
    await this.runJj(["root"]);
  }

  async loadWorkspaceRoot(): Promise<string> {
    const result = await this.runJj(["workspace", "root"]);
    return result.stdout.trim();
  }

  async loadDefaultRevset(): Promise<string> {
    try {
      const result = await this.runJj(["config", "get", "revsets.log"]);
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

  private async runJj(args: readonly string[], options?: { color?: boolean }) {
    return await runCommand(this.repoPath, ["jj", ...args], options);
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

function buildLogTemplate(baseGraphRowCount: number): string {
  const shortChangeId = "change_id.shortest(8)";
  const shortRevisionId = `${shortChangeId} ++ if(divergent, surround("/", "", change_offset))`;
  const parentRevisionIds = 'parents.map(|p| p.change_id().shortest(8) ++ if(p.divergent(), surround("/", "", p.change_offset()))).join(",")';
  const rows = [
    `${shortRevisionId} ++ "${FIELD_SEPARATOR}" ++ "${ROW_KIND_HEADER}" ++ "${FIELD_SEPARATOR}" ++ ${shortRevisionId} ++ "${FIELD_SEPARATOR}" ++ commit_id ++ "${FIELD_SEPARATOR}" ++ description.first_line() ++ "${FIELD_SEPARATOR}" ++ bookmarks ++ "${FIELD_SEPARATOR}" ++ working_copies.map(|wc| wc.name()).join(",") ++ "${FIELD_SEPARATOR}" ++ ${shortChangeId}.prefix() ++ "${FIELD_SEPARATOR}" ++ empty ++ "${FIELD_SEPARATOR}" ++ author.timestamp().local().format("%Y-%m-%d %H:%M:%S") ++ "${FIELD_SEPARATOR}" ++ conflict ++ "${FIELD_SEPARATOR}" ++ ${parentRevisionIds} ++ "\\n"`,
  ];

  for (let index = 1; index < baseGraphRowCount; index += 1) {
    rows.push(`"${FIELD_SEPARATOR}" ++ "${ROW_KIND_BODY}" ++ "${FIELD_SEPARATOR}" ++ ${shortRevisionId} ++ "\\n"`);
  }

  return rows.join(" ++ ");
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
