import path from "node:path";
import * as vscode from "vscode";
import type { JjRepository, OperationLogEntry } from "@jif/jj-core";

class OperationLogItem extends vscode.TreeItem {
  constructor(readonly entry: OperationLogEntry) {
    super(entry.tags.startsWith("args: ") ? entry.tags.slice(6) : entry.tags, vscode.TreeItemCollapsibleState.None);
    this.description = entry.description;
    this.tooltip = `${entry.start}\n${entry.tags}\n${entry.description}`;
  }
}

export class JifOperationLogProvider implements vscode.TreeDataProvider<OperationLogItem>, vscode.Disposable {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<OperationLogItem | null | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  private readonly treeView: vscode.TreeView<OperationLogItem>;
  private items: OperationLogItem[] = [];

  constructor(
    private readonly repository: JjRepository,
    repositoryRoot: string,
  ) {
    this.treeView = vscode.window.createTreeView("jifOperationLog", {
      treeDataProvider: this,
      showCollapseAll: false,
    });
    this.treeView.title = `Operation Log (${path.basename(repositoryRoot)})`;
  }

  getTreeItem(element: OperationLogItem): vscode.TreeItem {
    return element;
  }

  getChildren(): OperationLogItem[] {
    return this.items;
  }

  async refresh(): Promise<void> {
    const entries = await this.repository.loadOperationLog();
    this.items = entries.map((entry) => new OperationLogItem(entry));
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
    this.treeView.dispose();
  }
}