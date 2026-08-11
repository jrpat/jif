import { expect, test } from "bun:test";
import {
  resolveBottomChromeLayout,
  shouldShowCommandPreview,
  shouldShowTransientShortcutPanel,
} from "../src/ui/bottomChrome.ts";

test("full-screen preview does not automatically show shortcut bindings", () => {
  expect(shouldShowTransientShortcutPanel({
    showsPersistentShortcutPanel: false,
    focusMode: "preview",
    previewFullScreen: true,
    modeShortcutBindingCount: 11,
    showsCommandPreview: false,
  })).toBeFalse();

  expect(shouldShowTransientShortcutPanel({
    showsPersistentShortcutPanel: true,
    focusMode: "preview",
    previewFullScreen: true,
    modeShortcutBindingCount: 11,
    showsCommandPreview: false,
  })).toBeFalse();

  expect(shouldShowTransientShortcutPanel({
    showsPersistentShortcutPanel: false,
    focusMode: "preview",
    previewFullScreen: false,
    modeShortcutBindingCount: 11,
    showsCommandPreview: false,
  })).toBeTrue();
});

test("resolveBottomChromeLayout stacks transient shortcuts above the command preview", () => {
  expect(resolveBottomChromeLayout({
    showsCommandPrompt: false,
    showsRevsetPrompt: false,
    showsFileSearchPrompt: false,
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
    showsFileSearchPrompt: false,
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

test("persistent shortcuts keep a command draft preview visible", () => {
  expect(shouldShowCommandPreview({
    showsPromptSurface: false,
    showsPersistentShortcutPanel: true,
    hasCommandSegments: true,
    hasCommandDraft: true,
  })).toBeTrue();

  expect(resolveBottomChromeLayout({
    showsCommandPrompt: false,
    showsRevsetPrompt: false,
    showsFileSearchPrompt: false,
    showsSearchPrompt: false,
    showsCommandPreview: true,
    showsPersistentShortcutPanel: true,
    showsTransientShortcutPanel: false,
    promptSurfaceHeight: 3,
    shortcutPanelRenderedHeight: 8,
  })).toEqual({
    showExpandedShortcutPanel: true,
    showCollapsedStatusArea: false,
    bottomSurfaceHeight: 11,
  });
});

test("persistent shortcuts still suppress non-draft command previews", () => {
  expect(shouldShowCommandPreview({
    showsPromptSurface: false,
    showsPersistentShortcutPanel: true,
    hasCommandSegments: true,
    hasCommandDraft: false,
  })).toBeFalse();
});
