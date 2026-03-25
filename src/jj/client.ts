import { CommandExecutionError, runCommand } from "./process.ts";
import type {
  ChangedFile,
  RepositoryData,
  RevisionMarker,
  RevisionSummary,
} from "../domain/types.ts";

const FIELD_SEPARATOR = "\u001f";

export class JjClient {
  constructor(readonly repoPath: string) {}

  async loadRepository(limit = 80): Promise<RepositoryData> {
    const workspaceNamesByChangeId = await this.loadWorkspaceNamesByChangeId();
    const logOutput = await this.runJj([
      "log",
      "--limit",
      String(limit),
      "--color",
      "never",
      "--template",
      `change_id.shortest(8) ++ "${FIELD_SEPARATOR}" ++ commit_id.shortest(8) ++ "${FIELD_SEPARATOR}" ++ description.first_line() ++ "${FIELD_SEPARATOR}" ++ bookmarks ++ "${FIELD_SEPARATOR}" ++ change_id.shortest(8).prefix() ++ "${FIELD_SEPARATOR}" ++ "\\n"`,
    ]);

    const revisions = parseLogOutput(logOutput.stdout, workspaceNamesByChangeId);

    return {
      repoPath: this.repoPath,
      revisions,
    };
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
    const result = await this.runJj([
      "log",
      "--revisions",
      `${revisionId}::`,
      "--no-graph",
      "--color",
      "never",
      "--template",
      'change_id.shortest(8) ++ "\\n"',
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

    const result = await this.runJj(args);
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    return stderr || stdout || `Executed: jj ${commandText.trim()}`;
  }

  async verifyRepository(): Promise<void> {
    await this.runJj(["root"]);
  }

  private async loadWorkspaceNamesByChangeId(): Promise<ReadonlyMap<string, readonly string[]>> {
    const result = await this.runJj(["workspace", "list", "--color", "never"]);
    const mapping = new Map<string, string[]>();

    for (const rawLine of result.stdout.split("\n")) {
      const line = rawLine.trim();
      if (line.length === 0) {
        continue;
      }

      const match = /^(?<name>[^:]+):\s+(?<change>[a-z0-9]+)\s+[a-z0-9]+/.exec(line);
      if (!match?.groups) {
        continue;
      }

      const changeId = match.groups.change ?? "";
      const workspaceName = match.groups.name ?? "";
      if (changeId.length === 0 || workspaceName.length === 0) {
        continue;
      }

      const existing = mapping.get(changeId) ?? [];
      existing.push(workspaceName);
      mapping.set(changeId, existing);
    }

    return mapping;
  }

  private async runJj(args: readonly string[]) {
    try {
      return await runCommand(this.repoPath, ["jj", ...args]);
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        throw new Error(error.message);
      }
      throw error;
    }
  }
}

export function parseLogOutput(
  output: string,
  workspaceNamesByChangeId: ReadonlyMap<string, readonly string[]>,
): readonly RevisionSummary[] {
  const revisions: RevisionSummary[] = [];

  for (const rawLine of output.split("\n")) {
    if (rawLine.length === 0) {
      continue;
    }

    if (!rawLine.includes(FIELD_SEPARATOR)) {
      const previous = revisions.at(-1);
      if (previous) {
        revisions[revisions.length - 1] = {
          ...previous,
          graphTail: [...previous.graphTail, rawLine],
        };
      }
      continue;
    }

    const [
      graphAndChangeId = "",
      commitId = "",
      rawDescription = "",
      rawBookmarks = "",
      rawChangeIdPrefix = "",
    ] = rawLine.split(FIELD_SEPARATOR);
    const graphMatch = /^(?<graph>.*?)(?<change>[a-z0-9]+)$/.exec(graphAndChangeId);
    if (!graphMatch?.groups) {
      continue;
    }

    const changeId = graphMatch.groups.change ?? "";
    const graphHead = graphMatch.groups.graph ?? "";
    if (changeId.length === 0) {
      continue;
    }

    revisions.push({
      changeId,
      changeIdPrefixLength: rawChangeIdPrefix.trim().length || changeId.length,
      commitId: commitId.trim(),
      description: rawDescription.trim() || "(no description)",
      bookmarks: splitWords(rawBookmarks),
      workspaces: workspaceNamesByChangeId.get(changeId) ?? [],
      graphHead,
      graphTail: [],
      marker: deriveRevisionMarker(graphHead),
      files: [],
    });
  }

  return revisions;
}

function splitWords(rawValue: string): readonly string[] {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return [];
  }

  return trimmed.split(/\s+/);
}

function deriveRevisionMarker(graphHead: string): RevisionMarker {
  if (graphHead.includes("@")) {
    return "working-copy";
  }
  if (graphHead.includes("◆")) {
    return "immutable";
  }
  if (graphHead.includes("*")) {
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
