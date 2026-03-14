import {
  dimmedTheme,
  resolveColorOrRgb,
  type ColorPath,
  type ThemeDefinition,
} from "@rezi-ui/core";

export type SemanticColorValue = ColorPath | number | undefined;

export type SemanticColorScheme = Readonly<{
  chromeFillOne: SemanticColorValue;
  chromeFillTwo: SemanticColorValue;
  chromeFillThree: SemanticColorValue;
  chromeBorderIdle: SemanticColorValue;
  chromeBorderFocus: SemanticColorValue;
  rowFocusedFill: SemanticColorValue;
  rowAffectedFill: SemanticColorValue;
  rowCommandTargetBorder: SemanticColorValue;
  graphWorkingCopy: SemanticColorValue;
  graphPlain: SemanticColorValue;
  graphImmutable: SemanticColorValue;
  graphBookmark: SemanticColorValue;
  bookmarkTagFill: SemanticColorValue;
  bookmarkTagText: SemanticColorValue;
  workspaceTagFill: SemanticColorValue;
  workspaceTagText: SemanticColorValue;
  textPrimary: SemanticColorValue;
  textSecondary: SemanticColorValue;
  textMuted: SemanticColorValue;
  fileFocusMarker: SemanticColorValue;
  fileStatusAccent: SemanticColorValue;
  statusInfo: SemanticColorValue;
  statusSuccess: SemanticColorValue;
  statusWarning: SemanticColorValue;
  statusError: SemanticColorValue;
}>;

export type AppConfig = Readonly<{
  colorScheme: Readonly<{
    theme: ThemeDefinition;
    semanticColors: SemanticColorScheme;
  }>;
}>;

export type ResolvedAppConfig = Readonly<{
  colorScheme: Readonly<{
    theme: ThemeDefinition;
    semanticColors: Readonly<{
      [K in keyof SemanticColorScheme]: number | undefined;
    }>;
  }>;
}>;

export const defaultAppConfig: AppConfig = {
  colorScheme: {
    theme: dimmedTheme,
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
};

export function defineConfig(config: AppConfig): AppConfig {
  return config;
}

export function resolveAppConfig(config: AppConfig): ResolvedAppConfig {
  const theme = config.colorScheme.theme;
  const semanticColors = Object.fromEntries(
    Object.entries(config.colorScheme.semanticColors).map(([name, value]) => [
      name,
      value === undefined
        ? undefined
        : resolveColorOrRgb(theme, value, resolveColorOrRgb(theme, "fg.primary", 0xffffff)),
    ]),
  ) as ResolvedAppConfig["colorScheme"]["semanticColors"];

  return {
    colorScheme: {
      theme,
      semanticColors,
    },
  };
}
