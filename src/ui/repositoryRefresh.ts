import { CliRenderEvents, type CliRenderer } from "@opentui/core";
import type { RepositoryData, StatusLevel } from "../domain/types.ts";
import { DEFAULT_REPOSITORY_LOAD_LIMIT } from "../jj/client.ts";

type RepositoryRefreshClient = {
  verifyRepository(): Promise<void>;
  loadRepository(limit?: number, revset?: string): Promise<RepositoryData>;
};

type RepositoryRefreshActions = {
  setLoading(loading: boolean): void;
  applyRepositoryData(repositoryData: RepositoryData): void;
  pushEvent(text: string, level: StatusLevel): void;
};

export type RepositoryRefreshSuccess = Readonly<{
  repositoryData: RepositoryData;
  requestedLimit: number;
  canLoadMore: boolean;
}>;

export function createRepositoryRefresher(args: {
  client: RepositoryRefreshClient;
  actions: RepositoryRefreshActions;
  getRevsetQuery: () => string;
  onRefreshSuccess?: (details: RepositoryRefreshSuccess) => void;
}) {
  let refreshInFlight: Promise<boolean> | null = null;
  let currentRevisionLimit = DEFAULT_REPOSITORY_LOAD_LIMIT;

  return async function refreshRepository(revset?: string, limit?: number): Promise<boolean> {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    const effectiveRevset = revset || args.getRevsetQuery() || undefined;
    const effectiveLimit = limit ?? currentRevisionLimit;
    refreshInFlight = (async () => {
      try {
        await args.client.verifyRepository();
        const repositoryData = await args.client.loadRepository(effectiveLimit, effectiveRevset);
        currentRevisionLimit = effectiveLimit;
        args.actions.applyRepositoryData(repositoryData);
        args.onRefreshSuccess?.({
          repositoryData,
          requestedLimit: effectiveLimit,
          canLoadMore: repositoryData.revisions.length >= effectiveLimit,
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        args.actions.pushEvent(message, "error");
        args.actions.setLoading(false);
        return false;
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
  refreshRepository: () => Promise<boolean>,
): () => void {
  const handleFocus = () => {
    void refreshRepository();
  };

  renderer.on(CliRenderEvents.FOCUS, handleFocus);

  return () => {
    renderer.off(CliRenderEvents.FOCUS, handleFocus);
  };
}
