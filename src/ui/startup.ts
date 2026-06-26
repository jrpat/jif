import { CliRenderEvents, type TerminalColors } from "@opentui/core";
import type { AppLayout } from "../domain/types.ts";
import { resolveAppConfig, type AppConfig, type ResolvedAppConfig } from "../config/schema.ts";
import type { RepositoryRefreshOptions } from "./repositoryRefresh.ts";

export type InitialRepositoryLoad = Readonly<{
  workspaceRoot: string | null;
  initialRevset: string;
}>;

type PaletteRenderer = Readonly<{
  getPalette(options: { size: number }): Promise<TerminalColors | null>;
}>;

type LifecycleRenderer = Readonly<{
  width: number;
  height: number;
  clearPaletteCache(): void;
  on(event: string, listener: () => void): void;
  off(event: string, listener: () => void): void;
}>;

const DEFAULT_STARTUP_RESERVED_ROWS = 3;

const MIN_REVISION_ROWS_BY_LAYOUT: Readonly<Record<AppLayout, number>> = {
  loose: 2,
  normal: 1,
  tight: 1,
};

export function createPaletteDetector(args: {
  renderer: PaletteRenderer;
  rawConfig: AppConfig | (() => AppConfig);
  applyResolvedConfig(config: ResolvedAppConfig): void;
}): () => Promise<void> {
  return async () => {
    try {
      const palette = await args.renderer.getPalette({ size: 16 });
      const rawConfig = typeof args.rawConfig === "function"
        ? args.rawConfig()
        : args.rawConfig;
      args.applyResolvedConfig(resolveAppConfig(rawConfig, { palette }));
    } catch {
      // Keep current (fallback) colors
    }
  };
}

export function bindViewRendererEvents(args: {
  renderer: LifecycleRenderer;
  detectAndApplyPalette: () => Promise<void>;
  setTerminalSize(size: Readonly<{ width: number; height: number }>): void;
}): () => void {
  // The terminal palette is queried once and cached, so the only way to pick up
  // a light/dark switch is to clear the cache and re-detect. Terminals report a
  // scheme change via THEME_MODE only when they support color-scheme update
  // notifications, and many deliver the change lazily on focus-in, so we also
  // re-detect whenever the terminal regains focus.
  const refreshPalette = () => {
    args.renderer.clearPaletteCache();
    void args.detectAndApplyPalette();
  };
  const handleResize = () => {
    args.setTerminalSize({
      width: Math.max(args.renderer.width, 1),
      height: Math.max(args.renderer.height, 1),
    });
  };

  handleResize();
  args.renderer.on(CliRenderEvents.THEME_MODE, refreshPalette);
  args.renderer.on(CliRenderEvents.FOCUS, refreshPalette);
  args.renderer.on(CliRenderEvents.RESIZE, handleResize);

  return () => {
    args.renderer.off(CliRenderEvents.THEME_MODE, refreshPalette);
    args.renderer.off(CliRenderEvents.FOCUS, refreshPalette);
    args.renderer.off(CliRenderEvents.RESIZE, handleResize);
  };
}

export function estimateInitialRevisionLoadLimit(args: Readonly<{
  terminalHeight: number;
  layout: AppLayout;
  reservedRows?: number;
  maximum?: number;
}>): number {
  const reservedRows = args.reservedRows ?? DEFAULT_STARTUP_RESERVED_ROWS;
  const availableRows = Math.max(1, args.terminalHeight - reservedRows);
  const minimumRowsPerRevision = MIN_REVISION_ROWS_BY_LAYOUT[args.layout];
  const estimatedLimit = Math.max(1, Math.ceil(availableRows / minimumRowsPerRevision));

  if (args.maximum === undefined) {
    return estimatedLimit;
  }

  return Math.min(args.maximum, estimatedLimit);
}

export function queueDeferredRepositoryLoad(args: Readonly<{
  initialRevisionLimit: number;
  backgroundRevisionLimit: number;
  revset?: string;
  schedule(task: () => void): void;
  refreshRepository(revset?: string, limit?: number, options?: RepositoryRefreshOptions): Promise<unknown>;
}>): boolean {
  if (args.initialRevisionLimit >= args.backgroundRevisionLimit) {
    return false;
  }

  args.schedule(() => {
    void args.refreshRepository(args.revset, args.backgroundRevisionLimit, { workingCopy: "read-only" });
  });

  return true;
}

export function startInitialRepositoryLoad(args: {
  initialRevisionLimit: number;
  detectAndApplyPalette: () => Promise<void>;
  loadWorkspaceRoot: () => Promise<string | null>;
  loadDefaultRevset: () => Promise<string>;
  loadSavedRevset: (workspaceRoot: string) => Promise<string>;
  refreshRepository: (revset?: string, limit?: number, options?: RepositoryRefreshOptions) => Promise<unknown>;
  setWorkspaceRoot: (workspaceRoot: string | null) => void;
  setRevsetQuery: (query: string) => void;
  focusWorkingCopy: () => void;
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

    await args.refreshRepository(initialRevset || undefined, args.initialRevisionLimit, { workingCopy: "read-only" });
    args.focusWorkingCopy();

    return {
      workspaceRoot,
      initialRevset,
    };
  })();
}
