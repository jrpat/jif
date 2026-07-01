import { describe, expect, test } from "bun:test";
import { resolveAppConfig } from "../src/config/index.ts";
import type { ResolvedAppConfig } from "../src/config/schema.ts";
import {
  effectivePreviewCols,
  effectivePreviewPercent,
  effectivePreviewPosition,
  effectivePreviewVisible,
  type PreviewSettings,
} from "../src/domain/preview.ts";
import {
  createInitialState,
  setPreviewPositionOverride,
  setPreviewSizePercentOverride,
  setPreviewVisibleOverride,
} from "../src/state/store.ts";

const base = resolveAppConfig({});
function cfg(preview: Partial<ResolvedAppConfig["preview"]>): ResolvedAppConfig["preview"] {
  return { ...base.preview, ...preview };
}
function settings(over: Partial<PreviewSettings> = {}): PreviewSettings {
  return {
    previewPositionOverride: null,
    previewVisibleOverride: null,
    previewSizePercentOverride: null,
    ...over,
  };
}

describe("effectivePreviewVisible", () => {
  const WIDE = 200;

  test("follows config default when no session override", () => {
    expect(effectivePreviewVisible(settings(), cfg({ showByDefault: true }), WIDE)).toBe(true);
    expect(effectivePreviewVisible(settings(), cfg({ showByDefault: false }), WIDE)).toBe(false);
  });

  test("session override wins over config default", () => {
    expect(
      effectivePreviewVisible(settings({ previewVisibleOverride: true }), cfg({ showByDefault: false }), WIDE),
    ).toBe(true);
    expect(
      effectivePreviewVisible(settings({ previewVisibleOverride: false }), cfg({ showByDefault: true }), WIDE),
    ).toBe(false);
  });

  test("auto + whenNarrow:hide hides the pane in a narrow terminal", () => {
    const c = cfg({ showByDefault: true, position: "auto", narrowWidth: 100, whenNarrow: "hide" });
    expect(effectivePreviewVisible(settings(), c, 99)).toBe(false);
    expect(effectivePreviewVisible(settings(), c, 100)).toBe(true);
    expect(effectivePreviewVisible(settings(), c, 160)).toBe(true);
  });

  test("whenNarrow:below keeps the pane visible when narrow (default)", () => {
    const c = cfg({ showByDefault: true, position: "auto", narrowWidth: 100, whenNarrow: "below" });
    expect(effectivePreviewVisible(settings(), c, 40)).toBe(true);
  });

  test("whenNarrow:hide only applies to the auto layout", () => {
    // A fixed position ignores the narrow behavior entirely.
    const right = cfg({ showByDefault: true, position: "right", narrowWidth: 100, whenNarrow: "hide" });
    expect(effectivePreviewVisible(settings(), right, 40)).toBe(true);
    // A session position override takes the pane out of "auto", so it stays shown.
    const auto = cfg({ showByDefault: true, position: "auto", narrowWidth: 100, whenNarrow: "hide" });
    expect(
      effectivePreviewVisible(settings({ previewPositionOverride: "below" }), auto, 40),
    ).toBe(true);
  });

  test("narrow-hide applies even when visibility comes from the `p` toggle", () => {
    const c = cfg({ showByDefault: false, position: "auto", narrowWidth: 100, whenNarrow: "hide" });
    // Toggled on with `p`, but still hidden because the auto layout is too narrow.
    expect(effectivePreviewVisible(settings({ previewVisibleOverride: true }), c, 40)).toBe(false);
    // Toggled on and wide enough: shown.
    expect(effectivePreviewVisible(settings({ previewVisibleOverride: true }), c, WIDE)).toBe(true);
  });
});

describe("effectivePreviewPosition", () => {
  const auto = cfg({ position: "auto", narrowWidth: 100 });

  test("auto resolves to right when wide, below when narrow", () => {
    expect(effectivePreviewPosition(settings(), auto, 100)).toBe("right");
    expect(effectivePreviewPosition(settings(), auto, 160)).toBe("right");
    expect(effectivePreviewPosition(settings(), auto, 99)).toBe("below");
  });

  test("fixed config position is respected regardless of width", () => {
    expect(effectivePreviewPosition(settings(), cfg({ position: "below" }), 200)).toBe("below");
    expect(effectivePreviewPosition(settings(), cfg({ position: "right" }), 40)).toBe("right");
  });

  test("session override wins over auto", () => {
    expect(effectivePreviewPosition(settings({ previewPositionOverride: "below" }), auto, 200)).toBe(
      "below",
    );
  });
});

describe("effectivePreviewPercent / cols", () => {
  const c = cfg({ defaultWidthPercent: 50, minSizePercent: 15, maxSizePercent: 90 });

  test("derives from default and clamps to [min, max]", () => {
    expect(effectivePreviewPercent(settings(), c)).toBe(50);
    expect(effectivePreviewPercent(settings({ previewSizePercentOverride: 5 }), c)).toBe(15);
    expect(effectivePreviewPercent(settings({ previewSizePercentOverride: 200 }), c)).toBe(90);
  });

  test("cols are a rounded percentage of terminal width", () => {
    expect(effectivePreviewCols(settings(), c, 200)).toBe(100);
    expect(effectivePreviewCols(settings({ previewSizePercentOverride: 30 }), c, 100)).toBe(30);
  });
});

describe("preview reducers", () => {
  const initial = createInitialState("/repo");

  test("initial overrides are null (follow config)", () => {
    expect(initial.previewPositionOverride).toBeNull();
    expect(initial.previewVisibleOverride).toBeNull();
    expect(initial.previewSizePercentOverride).toBeNull();
  });

  test("setters round-trip without mutating the input state", () => {
    const positioned = setPreviewPositionOverride(initial, "below");
    expect(positioned.previewPositionOverride).toBe("below");
    expect(initial.previewPositionOverride).toBeNull();

    expect(setPreviewVisibleOverride(initial, true).previewVisibleOverride).toBe(true);
    expect(setPreviewSizePercentOverride(initial, 60).previewSizePercentOverride).toBe(60);
    expect(setPreviewPositionOverride(positioned, null).previewPositionOverride).toBeNull();
  });
});
