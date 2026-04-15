import { CliRenderEvents, type CliRenderer } from "@opentui/core";
import type { RepositoryData, StatusLevel } from "../domain/types.ts";

type RepositoryRefreshClient = {
  verifyRepository(): Promise<void>;
  loadRepository(limit?: number, revset?: string): Promise<RepositoryData>;
};

type RepositoryRefreshActions = {
  setLoading(loading: boolean): void;
  applyRepositoryData(repositoryData: RepositoryData): void;
  pushEvent(text: string, level: StatusLevel): void;
};

export function createRepositoryRefresher(args: {
  client: RepositoryRefreshClient;
  actions: RepositoryRefreshActions;
  getRevsetQuery: () => string;
}) {
  let refreshInFlight: Promise<void> | null = null;

  return async function refreshRepository(revset?: string): Promise<void> {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    const effectiveRevset = revset || args.getRevsetQuery() || undefined;
    refreshInFlight = (async () => {
      try {
        await args.client.verifyRepository();
        const repositoryData = await args.client.loadRepository(undefined, effectiveRevset);
        args.actions.applyRepositoryData(repositoryData);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        args.actions.pushEvent(message, "error");
        args.actions.setLoading(false);
      } finally {
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  };
}

type FocusRefreshRenderer = {
  on(event: CliRenderEvents.FOCUS, listener: () => void): unknown;
  off(event: CliRenderEvents.FOCUS, listener: () => void): unknown;
};

export function bindRefreshOnFocus(
  renderer: FocusRefreshRenderer,
  refreshRepository: () => Promise<void>,
): () => void {
  const handleFocus = () => {
    void refreshRepository();
  };

  renderer.on(CliRenderEvents.FOCUS, handleFocus);

  return () => {
    renderer.off(CliRenderEvents.FOCUS, handleFocus);
  };
}
