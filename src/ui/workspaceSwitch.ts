import type { AppState, StatusLevel } from "../domain/types.ts";
import { DEFAULT_REPOSITORY_LOAD_LIMIT } from "../jj/client.ts";
import type { RepositoryRefreshOptions } from "./repositoryRefresh.ts";

type WorkspaceSwitchActions = Readonly<{
  activateWorkspace(rootPath: string): void;
  setRevsetQuery(query: string): void;
  focusWorkingCopy(): void;
  pushEvent(text: string, level: StatusLevel): void;
}>;

export async function switchWorkspace(args: Readonly<{
  workspaceName: string;
  getWorkspaceState(): Pick<AppState, "repoPath" | "workspaceRefs">;
  actions: WorkspaceSwitchActions;
  resetViewState(): void;
  applyRuntimeConfig(rootPath: string): Promise<void>;
  loadDefaultRevset(): Promise<string>;
  loadActiveRevset(rootPath: string): Promise<string>;
  refreshRepository(
    revset?: string,
    limit?: number,
    options?: RepositoryRefreshOptions,
  ): Promise<boolean>;
}>): Promise<void> {
  const state = args.getWorkspaceState();
  const workspace = state.workspaceRefs.find((candidate) => candidate.name === args.workspaceName);
  if (!workspace) {
    args.actions.pushEvent(
      `Cannot switch workspace: root for ${args.workspaceName}@ is unavailable.`,
      "warning",
    );
    return;
  }

  if (workspace.rootPath === state.repoPath) {
    return;
  }

  args.resetViewState();
  args.actions.activateWorkspace(workspace.rootPath);
  await args.applyRuntimeConfig(workspace.rootPath);

  const [defaultRevset, savedRevset] = await Promise.all([
    args.loadDefaultRevset(),
    args.loadActiveRevset(workspace.rootPath),
  ]);
  const nextRevset = savedRevset || defaultRevset;
  if (nextRevset) {
    args.actions.setRevsetQuery(nextRevset);
  }

  const refreshed = await args.refreshRepository(
    nextRevset || undefined,
    DEFAULT_REPOSITORY_LOAD_LIMIT,
    { workingCopy: "snapshot", force: true },
  );
  if (!refreshed) {
    return;
  }

  args.actions.focusWorkingCopy();
  args.actions.pushEvent(`Switched to workspace ${workspace.name}@.`, "success");
}
