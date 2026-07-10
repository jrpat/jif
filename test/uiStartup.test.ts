import { EventEmitter } from "node:events";
import { expect, test } from "bun:test";
import { CliRenderEvents } from "@opentui/core";
import { FALLBACK_PALETTE_DARK } from "../src/config/index.ts";
import {
  bindViewRendererEvents,
  createPaletteDetector,
  estimateInitialRevisionLoadLimit,
  queuePostReadyBackgroundTask,
  queueDeferredRepositoryLoad,
  startInitialRepositoryLoad,
} from "../src/ui/startup.ts";

test("estimateInitialRevisionLoadLimit uses layout-specific row budgets", () => {
  expect(estimateInitialRevisionLoadLimit({ terminalHeight: 24, layout: "tight" })).toBe(21);
  expect(estimateInitialRevisionLoadLimit({ terminalHeight: 24, layout: "normal" })).toBe(21);
  expect(estimateInitialRevisionLoadLimit({ terminalHeight: 24, layout: "loose" })).toBe(11);
});

test("estimateInitialRevisionLoadLimit clamps to the configured maximum", () => {
  expect(
    estimateInitialRevisionLoadLimit({ terminalHeight: 500, layout: "tight", maximum: 250 }),
  ).toBe(250);
});

test("startInitialRepositoryLoad awaits palette detection before refreshing", async () => {
  const events: string[] = [];

  const result = await startInitialRepositoryLoad({
    initialRevisionLimit: 21,
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
    refreshRepository: async (revset, limit, options) => {
      events.push(`refresh:${revset}:${limit}:${options?.workingCopy ?? "snapshot"}`);
      return true;
    },
    setWorkspaceRoot: (workspaceRoot) => {
      events.push(`workspace.set:${workspaceRoot}`);
    },
    setRevsetQuery: (query) => {
      events.push(`revset.set:${query}`);
    },
    focusWorkingCopy: () => {
      events.push("focus-working-copy");
    },
  });

  expect(result).toEqual({
    workspaceRoot: "/repo",
    initialRevset: "all()",
  });
  // palette.done must appear before refresh — it's awaited in Promise.all
  const paletteIndex = events.indexOf("palette.done");
  const refreshIndex = events.indexOf("refresh:all():21:snapshot");
  expect(paletteIndex).toBeGreaterThanOrEqual(0);
  expect(refreshIndex).toBeGreaterThan(paletteIndex);
  // focus on the working-copy revision must run after the refresh lands
  const focusIndex = events.indexOf("focus-working-copy");
  expect(focusIndex).toBeGreaterThan(refreshIndex);
});

test("startInitialRepositoryLoad prefers saved revset over default revset", async () => {
  const result = await startInitialRepositoryLoad({
    initialRevisionLimit: 34,
    detectAndApplyPalette: async () => {},
    loadWorkspaceRoot: async () => "/repo",
    loadDefaultRevset: async () => "default()",
    loadSavedRevset: async () => "mine()",
    refreshRepository: async (revset, limit, options) =>
      revset === "mine()" && limit === 34 && options?.workingCopy === "snapshot",
    setWorkspaceRoot: () => {},
    setRevsetQuery: () => {},
    focusWorkingCopy: () => {},
  });

  expect(result).toEqual({
    workspaceRoot: "/repo",
    initialRevset: "mine()",
  });
});

test("queueDeferredRepositoryLoad schedules a follow-up refresh after the initial render", async () => {
  const scheduled: Array<() => void> = [];
  const refreshCalls: Array<{
    revset: string | undefined;
    limit: number | undefined;
    workingCopy: string | undefined;
  }> = [];

  const queued = queueDeferredRepositoryLoad({
    initialRevisionLimit: 21,
    backgroundRevisionLimit: 250,
    revset: "mine()",
    schedule(task) {
      scheduled.push(task);
    },
    refreshRepository: async (revset, limit, options) => {
      refreshCalls.push({ revset, limit, workingCopy: options?.workingCopy });
      return true;
    },
  });

  expect(queued).toBe(true);
  expect(refreshCalls).toEqual([]);
  expect(scheduled).toHaveLength(1);

  scheduled[0]!();
  await Promise.resolve();

  expect(refreshCalls).toEqual([{ revset: "mine()", limit: 250, workingCopy: "read-only" }]);
});

test("queueDeferredRepositoryLoad skips the follow-up refresh when the initial load already hit the ceiling", () => {
  const queued = queueDeferredRepositoryLoad({
    initialRevisionLimit: 250,
    backgroundRevisionLimit: 250,
    revset: "mine()",
    schedule() {
      throw new Error("background load should not be scheduled");
    },
    refreshRepository: async () => true,
  });

  expect(queued).toBe(false);
});

test("queuePostReadyBackgroundTask defers fire-and-forget work", async () => {
  const scheduled: Array<() => void> = [];
  const errors: unknown[] = [];
  let calls = 0;

  const queued = queuePostReadyBackgroundTask({
    task: async () => {
      calls += 1;
      throw new Error("background failure");
    },
    schedule(task) {
      scheduled.push(task);
    },
    onError(error) {
      errors.push(error);
    },
  });

  expect(queued).toBe(true);
  expect(calls).toBe(0);
  expect(scheduled).toHaveLength(1);

  scheduled[0]!();
  await Promise.resolve();

  expect(calls).toBe(1);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toBeInstanceOf(Error);
  expect((errors[0] as Error).message).toBe("background failure");
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

test("bindViewRendererEvents re-detects palette when the terminal regains focus", async () => {
  class FakeRenderer extends EventEmitter {
    width = 120;
    height = 40;
    clearPaletteCacheCalls = 0;

    clearPaletteCache() {
      this.clearPaletteCacheCalls += 1;
    }
  }

  const renderer = new FakeRenderer();
  let paletteDetections = 0;

  const dispose = bindViewRendererEvents({
    renderer,
    detectAndApplyPalette: async () => {
      paletteDetections += 1;
    },
    setTerminalSize: () => {},
  });

  renderer.emit(CliRenderEvents.FOCUS);
  await Promise.resolve();

  expect(renderer.clearPaletteCacheCalls).toBe(1);
  expect(paletteDetections).toBe(1);

  dispose();
  renderer.emit(CliRenderEvents.FOCUS);
  await Promise.resolve();

  expect(renderer.clearPaletteCacheCalls).toBe(1);
  expect(paletteDetections).toBe(1);
});
