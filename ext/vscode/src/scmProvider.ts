import path from "node:path";
import * as vscode from "vscode";
import { buildChangeLabel, type FileStatus, type JjRepository, type RepositoryStatus } from "@jif/jj-core";
import { createEmptyUri, createRevisionUri } from "./jjDocumentProvider.ts";

type GroupDiffEntry = readonly [label: vscode.Uri, original: vscode.Uri, modified: vscode.Uri];

export class JifScmProvider implements vscode.Disposable {
  private readonly sourceControl: vscode.SourceControl;
  private readonly workingCopyGroup: vscode.SourceControlResourceGroup;
  private readonly groupDiffEntries = new WeakMap<vscode.SourceControlResourceGroup, readonly GroupDiffEntry[]>();

  constructor(
    private readonly repository: JjRepository,
    private readonly repositoryRoot: string,
  ) {
    this.sourceControl = vscode.scm.createSourceControl("jif", "Jujutsu", vscode.Uri.file(repositoryRoot));
    this.sourceControl.inputBox.visible = false;
    this.workingCopyGroup = this.sourceControl.createResourceGroup("working-copy", "Working Copy");
    this.workingCopyGroup.hideWhenEmpty = false;
  }

  async refresh(): Promise<void> {
    const workingCopy = await this.repository.getStatus();
    this.renderWorkingCopy(workingCopy);
  }

  async openAllChanges(group: vscode.SourceControlResourceGroup): Promise<void> {
    const entries = this.groupDiffEntries.get(group) ?? [];
    if (entries.length === 0) {
      return;
    }

    await vscode.commands.executeCommand("vscode.changes", group.label, entries);
  }

  dispose(): void {
    this.sourceControl.dispose();
  }

  private renderWorkingCopy(status: RepositoryStatus): void {
    const rendered = this.buildResourceStates(status.fileStatuses, {
      baseRevset: "@-",
      targetRevset: null,
      groupTitleSuffix: "(Working Copy)",
    });

    this.workingCopyGroup.label = buildChangeLabel("Working Copy", status.workingCopy);
    this.workingCopyGroup.resourceStates = rendered.resourceStates;
    this.groupDiffEntries.set(this.workingCopyGroup, rendered.diffEntries);
    this.sourceControl.count = status.fileStatuses.length;
  }

  private buildResourceStates(
    fileStatuses: readonly FileStatus[],
    options: {
      baseRevset: string;
      targetRevset: string | null;
      groupTitleSuffix: string;
    },
  ): {
    resourceStates: vscode.SourceControlResourceState[];
    diffEntries: GroupDiffEntry[];
  } {
    const resourceStates: vscode.SourceControlResourceState[] = [];
    const diffEntries: GroupDiffEntry[] = [];

    for (const fileStatus of fileStatuses) {
      const labelUri = vscode.Uri.file(fileStatus.path);
      const originalPath = fileStatus.renamedFrom ?? fileStatus.path;
      const originalUri = fileStatus.type === "A"
        ? createEmptyUri(originalPath)
        : createRevisionUri(originalPath, options.baseRevset);
      const modifiedUri = fileStatus.type === "D"
        ? createEmptyUri(fileStatus.path)
        : options.targetRevset
          ? createRevisionUri(fileStatus.path, options.targetRevset)
          : vscode.Uri.file(fileStatus.path);

      resourceStates.push({
        resourceUri: labelUri,
        decorations: {
          strikeThrough: fileStatus.type === "D",
          tooltip: path.relative(this.repositoryRoot, fileStatus.path),
        },
        command: {
          title: "Open Diff",
          command: "vscode.diff",
          arguments: [
            originalUri,
            modifiedUri,
            `${path.relative(this.repositoryRoot, fileStatus.path)} ${options.groupTitleSuffix}`,
          ],
        },
      });
      diffEntries.push([labelUri, originalUri, modifiedUri]);
    }

    return {
      resourceStates,
      diffEntries,
    };
  }
}