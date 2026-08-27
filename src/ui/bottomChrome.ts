import type { FocusMode } from "../domain/types.ts";

export type BottomChromeLayout = Readonly<{
  showExpandedShortcutPanel: boolean;
  showCollapsedStatusArea: boolean;
  bottomSurfaceHeight: number;
}>;

export function shouldShowTransientShortcutPanel(args: {
  showsPersistentShortcutPanel: boolean;
  focusMode: FocusMode;
  previewFullScreen: boolean;
  modeShortcutBindingCount: number;
  showsCommandPreview: boolean;
}): boolean {
  if (args.showsPersistentShortcutPanel) {
    return false;
  }

  if (args.focusMode === "preview") {
    return !args.previewFullScreen;
  }

  return args.focusMode === "copy" || args.focusMode === "extra" ||
    (args.modeShortcutBindingCount > 0 &&
      (args.showsCommandPreview || args.focusMode === "bookmark"));
}

export function shouldShowCommandPreview(args: {
  showsPromptSurface: boolean;
  showsPersistentShortcutPanel: boolean;
  hasCommandSegments: boolean;
  hasCommandDraft: boolean;
}): boolean {
  return !args.showsPromptSurface &&
    args.hasCommandSegments &&
    (!args.showsPersistentShortcutPanel || args.hasCommandDraft);
}

export function resolveBottomChromeLayout(args: {
  showsCommandPrompt: boolean;
  showsRevsetPrompt: boolean;
  showsFileSearchPrompt: boolean;
  showsSearchPrompt: boolean;
  showsCommandPreview: boolean;
  showsPersistentShortcutPanel: boolean;
  showsTransientShortcutPanel: boolean;
  promptSurfaceHeight: number;
  shortcutPanelRenderedHeight: number;
}): BottomChromeLayout {
  const showsPromptSurface =
    args.showsCommandPrompt ||
    args.showsRevsetPrompt ||
    args.showsFileSearchPrompt ||
    args.showsSearchPrompt;
  const showExpandedShortcutPanel = !showsPromptSurface &&
    (args.showsPersistentShortcutPanel || args.showsTransientShortcutPanel);
  const showCollapsedStatusArea = !showsPromptSurface && !args.showsCommandPreview && !showExpandedShortcutPanel;

  if (showsPromptSurface) {
    return {
      showExpandedShortcutPanel: false,
      showCollapsedStatusArea: false,
      bottomSurfaceHeight: args.promptSurfaceHeight,
    };
  }

  let bottomSurfaceHeight = 0;
  if (showExpandedShortcutPanel) {
    bottomSurfaceHeight += args.shortcutPanelRenderedHeight;
  }
  if (args.showsCommandPreview) {
    bottomSurfaceHeight += args.promptSurfaceHeight;
  }
  if (bottomSurfaceHeight === 0) {
    bottomSurfaceHeight = 3;
  }

  return {
    showExpandedShortcutPanel,
    showCollapsedStatusArea,
    bottomSurfaceHeight,
  };
}
