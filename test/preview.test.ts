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
  test("follows config default when no session override", () => {
    expect(effectivePreviewVisible(settings(), cfg({ showByDefault: true }))).toBe(true);
    expect(effectivePreviewVisible(settings(), cfg({ showByDefault: false }))).toBe(false);
  });

  test("session override wins over config default", () => {
    expect(
      effectivePreviewVisible(settings({ previewVisibleOverride: true }), cfg({ showByDefault: false })),
    ).toBe(true);
    expect(
      effectivePreviewVisible(settings({ previewVisibleOverride: false }), cfg({ showByDefault: true })),
    ).toBe(false);
  });
});

describe("effectivePreviewPosition", () => {
  const auto = cfg({ position: "auto", autoRightMinWidth: 100 });

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
