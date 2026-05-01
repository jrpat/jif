import * as vscode from "vscode";
import { JjRepository, resolveRepositoryRoot } from "@jif/jj-core";
import { JifDocumentContentProvider } from "./jjDocumentProvider.ts";
import { JifGraphViewProvider } from "./graphView.ts";
import { JifOperationLogProvider } from "./operationLogView.ts";
import { JifScmProvider } from "./scmProvider.ts";

const REPO_ACTIVE_CONTEXT = "jif.repoActive";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("Jif");
  context.subscriptions.push(outputChannel);

  const repositoryRoot = await findRepositoryRoot();
  if (!repositoryRoot) {
    outputChannel.appendLine("[activate] No Jujutsu repository found in the current workspace.");
    await vscode.commands.executeCommand("setContext", REPO_ACTIVE_CONTEXT, false);
    return;
  }

  outputChannel.appendLine(`[activate] Repository root: ${repositoryRoot}`);

  const repository = new JjRepository(repositoryRoot);
  const documentProvider = new JifDocumentContentProvider(repository);
  const scmProvider = new JifScmProvider(repository, repositoryRoot);
  const operationLogProvider = new JifOperationLogProvider(repository, repositoryRoot);
  const graphViewProvider = new JifGraphViewProvider(context.extensionUri, repositoryRoot, outputChannel);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(documentProvider.scheme, documentProvider),
    graphViewProvider.register(),
    scmProvider,
    operationLogProvider,
    graphViewProvider,
  );

  const refreshRepositoryViews = async () => {
    await Promise.all([
      scmProvider.refresh(),
      operationLogProvider.refresh(),
    ]);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("jif.refresh", async () => {
      await refreshRepositoryViews();
      await graphViewProvider.refresh();
    }),
    vscode.commands.registerCommand("jif.refreshOperationLog", () => operationLogProvider.refresh()),
    vscode.commands.registerCommand("jif.refreshGraph", () => graphViewProvider.refresh()),
    vscode.commands.registerCommand("jif.focusGraph", async () => {
      await vscode.commands.executeCommand("jifGraph.focus");
      graphViewProvider.blink();
    }),
    vscode.commands.registerCommand("jif.openAllChanges", (group: vscode.SourceControlResourceGroup) => scmProvider.openAllChanges(group)),
  );

  await vscode.commands.executeCommand("setContext", REPO_ACTIVE_CONTEXT, true);
  await refreshRepositoryViews();

  const watcher = createRefreshWatcher(repositoryRoot, refreshRepositoryViews);
  context.subscriptions.push(watcher);
}

async function findRepositoryRoot(): Promise<string | null> {
  for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
    try {
      return await resolveRepositoryRoot(workspaceFolder.uri.fsPath);
    } catch {
      continue;
    }
  }

  return null;
}

function createRefreshWatcher(repositoryRoot: string, refreshAll: () => Promise<void>): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(repositoryRoot, "**/*"));
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleRefresh = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void refreshAll();
    }, 150);
  };

  const createListener = watcher.onDidCreate(scheduleRefresh);
  const changeListener = watcher.onDidChange(scheduleRefresh);
  const deleteListener = watcher.onDidDelete(scheduleRefresh);

  return vscode.Disposable.from(
    watcher,
    createListener,
    changeListener,
    deleteListener,
    new vscode.Disposable(() => {
      if (timer) {
        clearTimeout(timer);
      }
    }),
  );
}