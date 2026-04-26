import { CliRenderEvents, type TerminalColors } from "@opentui/core";
import { resolveAppConfig, type AppConfig, type ResolvedAppConfig } from "../config/schema.ts";

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

export function createPaletteDetector(args: {
  renderer: PaletteRenderer;
  rawConfig: AppConfig;
  applyResolvedConfig(config: ResolvedAppConfig): void;
}): () => Promise<void> {
  return async () => {
    try {
      const palette = await args.renderer.getPalette({ size: 16 });
      args.applyResolvedConfig(resolveAppConfig(args.rawConfig, { palette }));
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
  const handleThemeMode = () => {
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
  args.renderer.on(CliRenderEvents.THEME_MODE, handleThemeMode);
  args.renderer.on(CliRenderEvents.RESIZE, handleResize);

  return () => {
    args.renderer.off(CliRenderEvents.THEME_MODE, handleThemeMode);
    args.renderer.off(CliRenderEvents.RESIZE, handleResize);
  };
}

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