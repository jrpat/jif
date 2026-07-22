import { watch } from "node:fs";
import { CliRenderEvents, type CliRenderer } from "@opentui/core";
import type { RepositoryData, StatusLevel } from "../domain/types.ts";
import {
  DEFAULT_REPOSITORY_LOAD_LIMIT,
  type WorkingCopyRefreshOptions,
} from "../jj/client.ts";
import { unionRevsetWithCommits } from "../revset/compose.ts";

type RepositoryRefreshClient = {
  loadRepository(
    limit?: number,
    revset?: string,
    options?: WorkingCopyRefreshOptions,
  ): Promise<RepositoryData>;
  loadDefaultRevset?(options?: WorkingCopyRefreshOptions): Promise<string>;
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

export type RepositoryRefreshOptions = WorkingCopyRefreshOptions & Readonly<{
  // Apply the loaded data even when it matches the last applied payload.
  // Explicit refreshes (ctrl-r, terminal focus) use this so the store —
  // including the relative-time anchor lastRefreshedAt — always re-anchors.
  force?: boolean;
  // Startup has no usable UI to recover into, so its initial load propagates
  // failures to the process entrypoint. Interactive refreshes keep reporting
  // failures as toast events.
  throwOnError?: boolean;
}>;

export function createRepositoryRefresher(args: {
  client: RepositoryRefreshClient;
  actions: RepositoryRefreshActions;
  getRevsetQuery: () => string;
  getRevealedCommitIds?: () => readonly string[];
  getRefreshScope?: () => string;
  onRefreshSuccess?: (details: RepositoryRefreshSuccess) => void;
}) {
  const refreshInFlightByScope = new Map<string, Promise<boolean>>();
  const currentRevisionLimitByScope = new Map<string, number>();
  const lastAppliedFingerprintByScope = new Map<string, number | bigint>();
  const defaultRevsetByScope = new Map<string, string>();

  // Revisions revealed by expanding elided rows are unioned into every load so
  // expansions survive refreshes. When no revset is active the configured
  // default must be resolved first, because passing -r would otherwise replace
  // it instead of extending it; the resolved text is cached per scope so the
  // config lookup subprocess doesn't run on every refresh.
  async function composeRevset(
    refreshScope: string,
    baseRevset: string | undefined,
    options?: RepositoryRefreshOptions,
  ): Promise<string | undefined> {
    const revealedCommitIds = args.getRevealedCommitIds?.() ?? [];
    if (revealedCommitIds.length === 0) {
      return baseRevset;
    }

    let base = baseRevset ?? defaultRevsetByScope.get(refreshScope);
    if (base === undefined) {
      base = await args.client.loadDefaultRevset?.({ workingCopy: options?.workingCopy }) ?? "";
      if (base) {
        defaultRevsetByScope.set(refreshScope, base);
      }
    }
    if (!base) {
      return baseRevset;
    }

    return unionRevsetWithCommits(base, revealedCommitIds);
  }

  return async function refreshRepository(
    revset?: string,
    limit?: number,
    options?: RepositoryRefreshOptions,
  ): Promise<boolean> {
    const refreshScope = args.getRefreshScope?.() ?? "";
    const refreshInFlight = refreshInFlightByScope.get(refreshScope);
    if (refreshInFlight) {
      return refreshInFlight;
    }

    const baseRevset = revset || args.getRevsetQuery() || undefined;
    const effectiveLimit = limit ?? currentRevisionLimitByScope.get(refreshScope) ?? DEFAULT_REPOSITORY_LOAD_LIMIT;
    let refreshPromise!: Promise<boolean>;
    refreshPromise = (async () => {
      try {
        const effectiveRevset = await composeRevset(refreshScope, baseRevset, options);
        const repositoryData = await args.client.loadRepository(effectiveLimit, effectiveRevset, options);
        if ((args.getRefreshScope?.() ?? "") !== refreshScope) {
          return false;
        }

        currentRevisionLimitByScope.set(refreshScope, effectiveLimit);
        // Applying identical data still rebuilds every revision object and
        // reconciles the whole store, so periodic refreshes would churn CPU
        // even when the repository is untouched. Skip the apply when the
        // loaded payload matches what was last applied; clearing the loading
        // flag is the only apply side effect that must survive the skip.
        // A 64-bit hash stands in for the payload; a collision only skips a
        // refresh that should have applied, and the next change repairs it.
        const fingerprint = Bun.hash(JSON.stringify(repositoryData));
        const lastAppliedFingerprint = lastAppliedFingerprintByScope.get(refreshScope) ?? null;
        if (fingerprint === lastAppliedFingerprint && !options?.force) {
          args.actions.setLoading(false);
        } else {
          args.actions.applyRepositoryData(repositoryData);
          lastAppliedFingerprintByScope.set(refreshScope, fingerprint);
        }
        args.onRefreshSuccess?.({
          repositoryData,
          requestedLimit: effectiveLimit,
          canLoadMore: repositoryData.revisions.length >= effectiveLimit,
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        args.actions.setLoading(false);
        if (options?.throwOnError) {
          throw error;
        }
        args.actions.pushEvent(message, "error");
        return false;
      } finally {
        if (refreshInFlightByScope.get(refreshScope) === refreshPromise) {
          refreshInFlightByScope.delete(refreshScope);
        }
      }
    })();

    refreshInFlightByScope.set(refreshScope, refreshPromise);
    return refreshPromise;
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

type OpHeadsWatchHandle = Readonly<{ close(): void }>;
type OpHeadsWatchFactory = (path: string, onChange: () => void) => OpHeadsWatchHandle;

type DebounceScheduler = Readonly<{
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof globalThis.setTimeout>;
  clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>): void;
}>;

const defaultDebounceScheduler: DebounceScheduler = {
  setTimeout(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
  clearTimeout(handle) {
    globalThis.clearTimeout(handle);
  },
};

const defaultOpHeadsWatchFactory: OpHeadsWatchFactory = (path, onChange) => {
  const watcher = watch(path, onChange);
  // Without a listener, a watch error (e.g. the directory disappearing during
  // a repo GC) would crash the process; degrade to no watching instead.
  watcher.on("error", () => watcher.close());
  return watcher;
};

// A single jj operation touches the heads directory more than once (the new
// head is written before the old one is removed), so changes are debounced
// into one refresh.
const OP_HEADS_DEBOUNCE_MS = 1000;

export function bindOpHeadsWatcher(args: Readonly<{
  opHeadsPath: string;
  refreshRepository(options?: RepositoryRefreshOptions): Promise<boolean>;
  watch?: OpHeadsWatchFactory;
  scheduler?: DebounceScheduler;
}>): () => void {
  const scheduler = args.scheduler ?? defaultDebounceScheduler;
  const watchFactory = args.watch ?? defaultOpHeadsWatchFactory;
  let pending: ReturnType<typeof globalThis.setTimeout> | null = null;

  const handleChange = () => {
    if (pending !== null) {
      scheduler.clearTimeout(pending);
    }
    pending = scheduler.setTimeout(() => {
      pending = null;
      void args.refreshRepository({ workingCopy: "read-only" });
    }, OP_HEADS_DEBOUNCE_MS);
  };

  let watcher: OpHeadsWatchHandle;
  try {
    watcher = watchFactory(args.opHeadsPath, handleChange);
  } catch {
    return () => {};
  }

  return () => {
    if (pending !== null) {
      scheduler.clearTimeout(pending);
      pending = null;
    }
    watcher.close();
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
    void refreshRepository({ workingCopy: "snapshot", force: true });
  };

  renderer.on(CliRenderEvents.FOCUS, handleFocus);

  return () => {
    renderer.off(CliRenderEvents.FOCUS, handleFocus);
  };
}
