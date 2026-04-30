import * as vscode from "vscode";
import type { JjRepository } from "@jif/jj-core";

export const JIF_JJ_SCHEME = "jif-jj";

export class JifDocumentContentProvider implements vscode.TextDocumentContentProvider {
  readonly scheme = JIF_JJ_SCHEME;

  constructor(private readonly repository: JjRepository) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const params = new URLSearchParams(uri.query);
    if (params.get("empty") === "1") {
      return "";
    }

    const revset = params.get("rev");
    if (!revset) {
      return "";
    }

    try {
      return await this.repository.readFileAtRevision(revset, uri.fsPath);
    } catch {
      return "";
    }
  }
}

export function createRevisionUri(filePath: string, revset: string): vscode.Uri {
  const fileUri = vscode.Uri.file(filePath);
  return fileUri.with({
    scheme: JIF_JJ_SCHEME,
    query: new URLSearchParams({ rev: revset }).toString(),
  });
}

export function createEmptyUri(filePath: string): vscode.Uri {
  const fileUri = vscode.Uri.file(filePath);
  return fileUri.with({
    scheme: JIF_JJ_SCHEME,
    query: new URLSearchParams({ empty: "1" }).toString(),
  });
}