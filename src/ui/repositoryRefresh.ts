import { CliRenderEvents, type CliRenderer } from "@opentui/core";
import type { RepositoryData, StatusLevel } from "../domain/types.ts";
import {
  DEFAULT_REPOSITORY_LOAD_LIMIT,
  type WorkingCopyRefreshOptions,
} from "../jj/client.ts";

type RepositoryRefreshClient = {
  verifyRepository(options?: WorkingCopyRefreshOptions): Promise<void>;
  loadRepository(
    limit?: number,
    revset?: string,
    options?: WorkingCopyRefreshOptions,
  ): Promise<RepositoryData>;
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

export type RepositoryRefreshOptions = WorkingCopyRefreshOptions;

export function createRepositoryRefresher(args: {
  client: RepositoryRefreshClient;
  actions: RepositoryRefreshActions;
  getRevsetQuery: () => string;
  onRefreshSuccess?: (details: RepositoryRefreshSuccess) => void;
}) {
  let refreshInFlight: Promise<boolean> | null = null;
  let currentRevisionLimit = DEFAULT_REPOSITORY_LOAD_LIMIT;
  let lastAppliedFingerprint: string | null = null;

  return async function refreshRepository(
    revset?: string,
    limit?: number,
    options?: RepositoryRefreshOptions,
  ): Promise<boolean> {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    const effectiveRevset = revset || args.getRevsetQuery() || undefined;
    const effectiveLimit = limit ?? currentRevisionLimit;
    refreshInFlight = (async () => {
      try {
        await args.client.verifyRepository(options);
        const repositoryData = await args.client.loadRepository(effectiveLimit, effectiveRevset, options);
        currentRevisionLimit = effectiveLimit;
        // Applying identical data still rebuilds every revision object and
        // reconciles the whole store, so periodic refreshes would churn CPU
        // even when the repository is untouched. Skip the apply when the
        // loaded payload matches what was last applied; clearing the loading
        // flag is the only apply side effect that must survive the skip.
        const fingerprint = JSON.stringify(repositoryData);
        if (fingerprint === lastAppliedFingerprint) {
          args.actions.setLoading(false);
        } else {
          args.actions.applyRepositoryData(repositoryData);
          lastAppliedFingerprint = fingerprint;
        }
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

type RefreshScheduler = Readonly<{
  setInterval(callback: () => void, delayMs: number): ReturnType<typeof globalThis.setInterval>;
  clearInterval(handle: ReturnType<typeof globalThis.setInterval>): void;
}>;

const defaultRefreshScheduler: RefreshScheduler = {
  setInterval(callback, delayMs) {
    return globalThis.setInterval(callback, delayMs);
  },
  clearInterval(handle) {
    globalThis.clearInterval(handle);
  },
};

export function bindAutoRefresh(args: Readonly<{
  intervalMs: number;
  refreshRepository(options?: RepositoryRefreshOptions): Promise<boolean>;
  scheduler?: RefreshScheduler;
}>): () => void {
  if (args.intervalMs <= 0) {
    return () => {};
  }

  const scheduler = args.scheduler ?? defaultRefreshScheduler;
  const handle = scheduler.setInterval(() => {
    void args.refreshRepository({ workingCopy: "read-only" });
  }, args.intervalMs);

  return () => {
    scheduler.clearInterval(handle);
  };
}

type FocusRefreshRenderer = {
  on(event: CliRenderEvents.FOCUS, listener: () => void): unknown;
  off(event: CliRenderEvents.FOCUS, listener: () => void): unknown;
};

export function bindRefreshOnFocus(
  renderer: FocusRefreshRenderer,
  refreshRepository: (options?: RepositoryRefreshOptions) => Promise<boolean>,
): () => void {
  const handleFocus = () => {
    void refreshRepository({ workingCopy: "snapshot" });
  };

  renderer.on(CliRenderEvents.FOCUS, handleFocus);

  return () => {
    renderer.off(CliRenderEvents.FOCUS, handleFocus);
  };
}
