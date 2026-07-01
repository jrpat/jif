import type { ResolvedAppConfig } from "../config/schema.ts";
import type { PreviewPosition, PreviewPositionPreference } from "./types.ts";

export type PreviewConfig = ResolvedAppConfig["preview"];

// The subset of AppState the preview helpers need. Kept structural so tests can
// pass small literals and AppState remains assignable.
export type PreviewSettings = Readonly<{
  previewPositionOverride: PreviewPositionPreference | null;
  previewVisibleOverride: boolean | null;
  previewSizePercentOverride: number | null;
}>;

// The order `shift+p` cycles through: auto → right → below → auto.
const PREVIEW_POSITION_CYCLE: readonly PreviewPositionPreference[] = ["auto", "right", "below"];

/** The next position preference in the `shift+p` cycle. */
export function nextPreviewPosition(current: PreviewPositionPreference): PreviewPositionPreference {
  const index = PREVIEW_POSITION_CYCLE.indexOf(current);
  return PREVIEW_POSITION_CYCLE[(index + 1) % PREVIEW_POSITION_CYCLE.length]!;
}

/** The active position preference: a session override, else the config default. */
export function effectivePreviewPositionPreference(
  state: PreviewSettings,
  preview: PreviewConfig,
): PreviewPositionPreference {
  return state.previewPositionOverride ?? preview.position;
}

/**
 * Whether the preview pane should be shown. The pane is *wanted* when the
 * session visibility toggle (`p`) says so, or by config default. Even when
 * wanted, the `"auto"` layout hides it on a terminal narrower than `narrowWidth`
 * if `whenNarrow` is `"hide"` (the default `"below"` instead relocates it — see
 * {@link effectivePreviewPosition}). An explicit position — a config `position`
 * other than `"auto"`, or a `shift+p` override — takes the pane out of `"auto"`,
 * so it is always shown at that position regardless of width.
 */
export function effectivePreviewVisible(
  state: PreviewSettings,
  preview: PreviewConfig,
  terminalWidth: number,
): boolean {
  const wantsVisible = state.previewVisibleOverride ?? preview.showByDefault;
  if (!wantsVisible) {
    return false;
  }
  return !hiddenByNarrowTerminal(state, preview, terminalWidth);
}

/**
 * Resolve the concrete pane position. A session toggle (`shift+p`) wins;
 * otherwise the config value applies, and `"auto"` chooses `right` in a wide
 * terminal and `below` in a narrow one.
 */
export function effectivePreviewPosition(
  state: PreviewSettings,
  preview: PreviewConfig,
  terminalWidth: number,
): PreviewPosition {
  const preference = effectivePreviewPositionPreference(state, preview);
  if (preference === "auto") {
    return isNarrowTerminal(preview, terminalWidth) ? "below" : "right";
  }
  return preference;
}

// A terminal too narrow for the "auto" layout to place the pane on the right.
function isNarrowTerminal(preview: PreviewConfig, terminalWidth: number): boolean {
  return terminalWidth < preview.narrowWidth;
}

// Whether the "auto" layout suppresses the pane on this terminal: only when the
// effective preference is "auto" (config default or an explicit `shift+p` cycle
// back to auto), the terminal is narrow, and `whenNarrow` is set to hide rather
// than relocate. A pinned position takes the pane out of "auto", so it stays.
function hiddenByNarrowTerminal(
  state: PreviewSettings,
  preview: PreviewConfig,
  terminalWidth: number,
): boolean {
  return (
    effectivePreviewPositionPreference(state, preview) === "auto" &&
    preview.whenNarrow === "hide" &&
    isNarrowTerminal(preview, terminalWidth)
  );
}

/** The pane size as a percentage of the relevant terminal dimension. */
export function effectivePreviewPercent(
  state: PreviewSettings,
  preview: PreviewConfig,
): number {
  const requested = state.previewSizePercentOverride ?? preview.defaultWidthPercent;
  return clamp(requested, preview.minSizePercent, preview.maxSizePercent);
}

// Pane size along one axis: a percentage of the given terminal extent, at
// least one cell. Shared by the width (right) and height (below) variants.
function effectivePreviewExtent(
  state: PreviewSettings,
  preview: PreviewConfig,
  terminalExtent: number,
): number {
  return Math.max(1, Math.round((terminalExtent * effectivePreviewPercent(state, preview)) / 100));
}

/** Pane width in columns (used when the pane is on the right). */
export function effectivePreviewCols(
  state: PreviewSettings,
  preview: PreviewConfig,
  terminalWidth: number,
): number {
  return effectivePreviewExtent(state, preview, terminalWidth);
}

/** Pane height in rows (used when the pane is below). */
export function effectivePreviewRows(
  state: PreviewSettings,
  preview: PreviewConfig,
  terminalHeight: number,
): number {
  return effectivePreviewExtent(state, preview, terminalHeight);
}

/** Clamp a requested size percentage into the configured bounds. */
export function clampPreviewPercent(value: number, preview: PreviewConfig): number {
  return clamp(value, preview.minSizePercent, preview.maxSizePercent);
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    return max;
  }
  return Math.min(max, Math.max(min, value));
}
