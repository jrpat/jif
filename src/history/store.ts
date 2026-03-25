import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { hasMatch, score } from "fzy.js";

export type HistoryKind = "command-history" | "revset-history";

const HISTORY_LIMIT = 200;

export function resolveHistoryFilePath(workspaceRoot: string, kind: HistoryKind): string {
  return join(workspaceRoot, ".jj", "jif", kind);
}

export class HistoryStore {
  constructor(private readonly workspaceRoot: string) {}

  async load(kind: HistoryKind): Promise<string[]> {
    const path = resolveHistoryFilePath(this.workspaceRoot, kind);
    try {
      const content = await readFile(path, "utf8");
      return content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, HISTORY_LIMIT);
    } catch {
      return [];
    }
  }

  async record(kind: HistoryKind, value: string): Promise<string[]> {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return await this.load(kind);
    }

    const history = await this.load(kind);
    const nextHistory = [trimmed, ...history.filter((entry) => entry !== trimmed)]
      .slice(0, HISTORY_LIMIT);
    const path = resolveHistoryFilePath(this.workspaceRoot, kind);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${nextHistory.join("\n")}\n`, "utf8");
    return nextHistory;
  }
}

export function matchHistoryEntries(query: string, entries: readonly string[]): string[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return entries.slice();
  }

  const matches = entries
    .filter((entry) => hasMatch(trimmed, entry))
    .map((entry) => ({ entry, score: score(trimmed, entry) }));

  matches.sort((a, b) => a.score - b.score);
  return matches.map((match) => match.entry).reverse();
}
