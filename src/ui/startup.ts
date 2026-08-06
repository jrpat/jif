import { CliRenderEvents, type TerminalColors } from "@opentui/core";
import type { AppLayout } from "../domain/types.ts";
import {
  FALLBACK_PALETTE_DARK,
  FALLBACK_PALETTE_LIGHT,
  resolveAppConfig,
  type AppConfig,
  type ResolvedAppConfig,
} from "../config/schema.ts";
import { inferThemeModeFromRgb, parseOsc11Response } from "../config/detectTerminalTheme.ts";
import type { RepositoryRefreshOptions } from "./repositoryRefresh.ts";

export type InitialRepositoryLoad = Readonly<{
  workspaceRoot: string | null;
  initialRevset: string;
}>;

type PaletteRenderer = Readonly<{
  getPalette(options: { size: number }): Promise<TerminalColors | null>;
  subscribeOsc?(handler: (sequence: string) => void): () => void;
}>;

export type PaletteDetector = (() => Promise<void>) & Readonly<{
  dispose(): void;
}>;

type LifecycleRenderer = Readonly<{
  width: number;
  height: number;
  clearPaletteCache(): void;
  on(event: string, listener: () => void): void;
  off(event: string, listener: () => void): void;
}>;

function hasTerminalDefaults(palette: TerminalColors | null): palette is TerminalColors {
  return palette !== null &&
    palette.defaultForeground !== null &&
    palette.defaultBackground !== null;
}

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
}): PaletteDetector {
  let latestPalette: TerminalColors | null = null;
  let lastAppliedPalette: TerminalColors | null = null;
  let observedBackground: Readonly<{
    color: string;
    rgb: Readonly<{ r: number; g: number; b: number }>;
    generation: number;
  }> | null = null;
  let disposed = false;

  const applyPalette = (palette: TerminalColors) => {
    if (disposed) {
      return;
    }
    const rawConfig = typeof args.rawConfig === "function"
      ? args.rawConfig()
      : args.rawConfig;
    lastAppliedPalette = palette;
    args.applyResolvedConfig(resolveAppConfig(rawConfig, { palette }));
  };

  // OpenTUI stops its palette query listeners when the startup idle timeout
  // expires. Keep a lightweight OSC observer for the renderer's lifetime so a
  // delayed default-background reply can still correct the active theme.
  const unsubscribeOsc = args.renderer.subscribeOsc?.((sequence) => {
    const background = parseOsc11Response(sequence);
    if (background === null) {
      return;
    }

    observedBackground = {
      color: rgbToHex(background),
      rgb: background,
      generation: (observedBackground?.generation ?? 0) + 1,
    };
    if (latestPalette !== null) {
      applyPalette(withTerminalBackground(
        latestPalette,
        lastAppliedPalette,
        observedBackground.color,
        observedBackground.rgb,
      ));
    }
  }) ?? (() => {});

  const detect = async () => {
    const startingBackgroundGeneration = observedBackground?.generation ?? 0;
    try {
      const palette = await args.renderer.getPalette({ size: 16 });
      latestPalette = palette;
      // OpenTUI represents unsupported or timed-out OSC color queries as a
      // successful palette result with null entries. Keep the last known-good
      // colors instead of resolving those missing terminal defaults against
      // jif's dark fallback.
      if (hasTerminalDefaults(palette)) {
        applyPalette(palette);
        return;
      }

      if (
        palette !== null &&
        observedBackground !== null &&
        observedBackground.generation > startingBackgroundGeneration
      ) {
        applyPalette(withTerminalBackground(
          palette,
          lastAppliedPalette,
          observedBackground.color,
          observedBackground.rgb,
        ));
      }
    } catch {
      // Keep the current colors.
    }
  };

  const detector = detect as PaletteDetector;
  Object.defineProperty(detector, "dispose", {
    value: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      unsubscribeOsc();
    },
  });
  return detector;
}

function withTerminalBackground(
  detected: TerminalColors,
  previous: TerminalColors | null,
  defaultBackground: string,
  backgroundRgb: Readonly<{ r: number; g: number; b: number }>,
): TerminalColors {
  const fallback = inferThemeModeFromRgb(backgroundRgb) === "light"
    ? FALLBACK_PALETTE_LIGHT
    : FALLBACK_PALETTE_DARK;
  const paletteSize = Math.max(detected.palette.length, previous?.palette.length ?? 0);

  return {
    ...detected,
    palette: Array.from({ length: paletteSize }, (_, index) =>
      detected.palette[index] ?? previous?.palette[index] ?? fallback.palette[index] ?? null
    ),
    defaultForeground: detected.defaultForeground ?? fallback.defaultForeground,
    defaultBackground,
  };
}

function rgbToHex(color: Readonly<{ r: number; g: number; b: number }>): string {
  return `#${[color.r, color.g, color.b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
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

export function queuePostReadyBackgroundTask(args: Readonly<{
  task?: (() => Promise<unknown>) | undefined;
  schedule?: (task: () => void) => unknown;
  onError?: (error: unknown) => void;
}>): boolean {
  const task = args.task;
  if (task === undefined) {
    return false;
  }

  const schedule = args.schedule ?? ((task: () => void) => {
    setTimeout(task, 0);
  });

  schedule(() => {
    try {
      void task().catch((error) => {
        args.onError?.(error);
      });
    } catch (error) {
      args.onError?.(error);
    }
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
    // Palette detection can stall for hundreds of milliseconds on terminals
    // that leave some of OpenTUI's color queries unanswered, so the repository
    // load must not queue behind it. Readiness still requires both: nothing is
    // painted until this function resolves, which keeps the first visible
    // frame on detected colors instead of the dark fallback.
    const paletteDetection = args.detectAndApplyPalette();

    const [workspaceRoot, defaultRevset] = await Promise.all([
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

    await Promise.all([
      args.refreshRepository(initialRevset || undefined, args.initialRevisionLimit, {
        workingCopy: "snapshot",
        throwOnError: true,
      }),
      paletteDetection,
    ]);
    args.focusWorkingCopy();

    return {
      workspaceRoot,
      initialRevset,
    };
  })();
}
