import { expect, test } from "bun:test";
import { resolveBottomChromeLayout } from "../src/ui/bottomChrome.ts";

test("resolveBottomChromeLayout stacks transient shortcuts above the command preview", () => {
  expect(resolveBottomChromeLayout({
    showsCommandPrompt: false,
    showsRevsetPrompt: false,
    showsSearchPrompt: false,
    showsCommandPreview: true,
    showsPersistentShortcutPanel: false,
    showsTransientShortcutPanel: true,
    promptSurfaceHeight: 3,
    shortcutPanelRenderedHeight: 8,
  })).toEqual({
    showExpandedShortcutPanel: true,
    showCollapsedStatusArea: false,
    bottomSurfaceHeight: 11,
  });
});

test("resolveBottomChromeLayout keeps the persistent shortcut panel behavior unchanged", () => {
  expect(resolveBottomChromeLayout({
    showsCommandPrompt: false,
    showsRevsetPrompt: false,
    showsSearchPrompt: false,
    showsCommandPreview: false,
    showsPersistentShortcutPanel: true,
    showsTransientShortcutPanel: false,
    promptSurfaceHeight: 3,
    shortcutPanelRenderedHeight: 8,
  })).toEqual({
    showExpandedShortcutPanel: true,
    showCollapsedStatusArea: false,
    bottomSurfaceHeight: 8,
  });
});