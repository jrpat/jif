export type InitialRepositoryLoad = Readonly<{
  workspaceRoot: string | null;
  initialRevset: string;
}>;

export function startInitialRepositoryLoad(args: {
  detectAndApplyPalette: () => Promise<void>;
  loadWorkspaceRoot: () => Promise<string | null>;
  loadDefaultRevset: () => Promise<string>;
  loadSavedRevset: (workspaceRoot: string) => Promise<string>;
  refreshRepository: (revset?: string) => Promise<unknown>;
  setWorkspaceRoot: (workspaceRoot: string | null) => void;
  setRevsetQuery: (query: string) => void;
}): Promise<InitialRepositoryLoad> {
  return (async (): Promise<InitialRepositoryLoad> => {
    const [, workspaceRoot, defaultRevset] = await Promise.all([
      args.detectAndApplyPalette(),
      args.loadWorkspaceRoot(),
      args.loadDefaultRevset(),
    ]);

    args.setWorkspaceRoot(workspaceRoot);

    const savedRevset = workspaceRoot
      ? await args.loadSavedRevset(workspaceRoot)
      : "";
    const initialRevset = savedRevset || defaultRevset;

    if (initialRevset) {
      args.setRevsetQuery(initialRevset);
    }

    await args.refreshRepository(initialRevset || undefined);

    return {
      workspaceRoot,
      initialRevset,
    };
  })();
}