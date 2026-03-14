import { defineConfig } from "./src/config/index.ts";
import { darkTheme, lightTheme } from "@rezi-ui/core";

export default defineConfig({
  colorScheme: {
    mode: "auto",
    lightTheme,
    darkTheme,
    semanticColors: {
      chromeFillOne: undefined,
      chromeFillTwo: undefined,
      chromeFillThree: undefined,
      chromeBorderIdle: "border.subtle",
      chromeBorderFocus: "focus.ring",
      rowFocusedFill: "focus.bg",
      rowAffectedFill: "selected.bg",
      rowCommandTargetBorder: "accent.secondary",
      graphWorkingCopy: "accent.primary",
      graphPlain: "fg.secondary",
      graphImmutable: "disabled.fg",
      graphBookmark: "accent.secondary",
      bookmarkTagFill: "accent.secondary",
      bookmarkTagText: "fg.inverse",
      workspaceTagFill: "accent.tertiary",
      workspaceTagText: "fg.inverse",
      textPrimary: "fg.primary",
      textSecondary: "fg.secondary",
      textMuted: "fg.muted",
      fileFocusMarker: "focus.ring",
      fileStatusAccent: "accent.secondary",
      statusInfo: "info",
      statusSuccess: "success",
      statusWarning: "warning",
      statusError: "error",
    },
  },
});
