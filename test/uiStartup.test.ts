import { EventEmitter } from "node:events";
import { expect, test } from "bun:test";
import { CliRenderEvents } from "@opentui/core";
import { FALLBACK_PALETTE_DARK } from "../src/config/index.ts";
import { bindViewRendererEvents, createPaletteDetector, startInitialRepositoryLoad } from "../src/ui/startup.ts";

test("startInitialRepositoryLoad awaits palette detection before refreshing", async () => {
  const events: string[] = [];

  const result = await startInitialRepositoryLoad({
    detectAndApplyPalette: async () => {
      events.push("palette.done");
    },
    loadWorkspaceRoot: async () => {
      events.push("workspace.load");
      return "/repo";
    },
    loadDefaultRevset: async () => {
      events.push("default-revset.load");
      return "all()";
    },
    loadSavedRevset: async (workspaceRoot) => {
      events.push(`saved-revset.load:${workspaceRoot}`);
      return "";
    },
    refreshRepository: async (revset) => {
      events.push(`refresh:${revset}`);
      return true;
    },
    setWorkspaceRoot: (workspaceRoot) => {
      events.push(`workspace.set:${workspaceRoot}`);
    },
    setRevsetQuery: (query) => {
      events.push(`revset.set:${query}`);
    },
  });

  expect(result).toEqual({
    workspaceRoot: "/repo",
    initialRevset: "all()",
  });
  // palette.done must appear before refresh — it's awaited in Promise.all
  const paletteIndex = events.indexOf("palette.done");
  const refreshIndex = events.indexOf("refresh:all()");
  expect(paletteIndex).toBeGreaterThanOrEqual(0);
  expect(refreshIndex).toBeGreaterThan(paletteIndex);
});

test("startInitialRepositoryLoad prefers saved revset over default revset", async () => {
  const result = await startInitialRepositoryLoad({
    detectAndApplyPalette: async () => {},
    loadWorkspaceRoot: async () => "/repo",
    loadDefaultRevset: async () => "default()",
    loadSavedRevset: async () => "mine()",
    refreshRepository: async (revset) => revset === "mine()",
    setWorkspaceRoot: () => {},
    setRevsetQuery: () => {},
  });

  expect(result).toEqual({
    workspaceRoot: "/repo",
    initialRevset: "mine()",
  });
});

test("createPaletteDetector resolves config from the renderer palette", async () => {
  let applyCalls = 0;
  const detectAndApplyPalette = createPaletteDetector({
    renderer: {
      async getPalette() {
        return FALLBACK_PALETTE_DARK;
      },
    },
    rawConfig: {},
    applyResolvedConfig: (config) => {
      applyCalls += 1;
      expect(typeof config.colorScheme.semanticColors.chromeFillOne).toBe("string");
      expect(config.terminalPalette).toHaveLength(16);
    },
  });

  await detectAndApplyPalette();

  expect(applyCalls).toBe(1);
});

test("bindViewRendererEvents updates size, refreshes palette on theme change, and unsubscribes cleanly", async () => {
  class FakeRenderer extends EventEmitter {
    width = 120;
    height = 40;
    clearPaletteCacheCalls = 0;

    clearPaletteCache() {
      this.clearPaletteCacheCalls += 1;
    }
  }

  const renderer = new FakeRenderer();
  const sizes: Array<{ width: number; height: number }> = [];
  let paletteDetections = 0;

  const dispose = bindViewRendererEvents({
    renderer,
    detectAndApplyPalette: async () => {
      paletteDetections += 1;
    },
    setTerminalSize: (size) => {
      sizes.push({ ...size });
    },
  });

  expect(sizes).toEqual([{ width: 120, height: 40 }]);

  renderer.width = 90;
  renderer.height = 24;
  renderer.emit(CliRenderEvents.RESIZE);
  renderer.emit(CliRenderEvents.THEME_MODE);
  await Promise.resolve();

  expect(sizes).toEqual([
    { width: 120, height: 40 },
    { width: 90, height: 24 },
  ]);
  expect(renderer.clearPaletteCacheCalls).toBe(1);
  expect(paletteDetections).toBe(1);

  dispose();
  renderer.width = 60;
  renderer.height = 20;
  renderer.emit(CliRenderEvents.RESIZE);
  renderer.emit(CliRenderEvents.THEME_MODE);
  await Promise.resolve();

  expect(sizes).toEqual([
    { width: 120, height: 40 },
    { width: 90, height: 24 },
  ]);
  expect(renderer.clearPaletteCacheCalls).toBe(1);
  expect(paletteDetections).toBe(1);
});