export type BottomChromeLayout = Readonly<{
  showExpandedShortcutPanel: boolean;
  showCollapsedStatusArea: boolean;
  bottomSurfaceHeight: number;
}>;

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
