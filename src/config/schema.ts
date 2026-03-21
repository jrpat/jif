export type SemanticColorValue = string | undefined;
export type ThemeMode = "auto" | "light" | "dark";
export type ResolvedThemeMode = Exclude<ThemeMode, "auto">;

export type SemanticColorScheme = Readonly<{
  chromeFillOne: SemanticColorValue;
  chromeFillTwo: SemanticColorValue;
  chromeFillThree: SemanticColorValue;
  chromeBorderIdle: SemanticColorValue;
  chromeBorderFocus: SemanticColorValue;
  rowFocusedFill: SemanticColorValue;
  rowSelectedFill: SemanticColorValue;
  rowSelectedAccent: SemanticColorValue;
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
  textTertiary: SemanticColorValue;
  textQuaternary: SemanticColorValue;
  textMuted: SemanticColorValue;
  fileFocusMarker: SemanticColorValue;
  fileStatusAccent: SemanticColorValue;
  statusInfo: SemanticColorValue;
  statusSuccess: SemanticColorValue;
  statusWarning: SemanticColorValue;
  statusError: SemanticColorValue;
}>;

export type AppConfig = Readonly<{
  colorScheme?: Readonly<{
    mode?: ThemeMode;
    semanticColors?: Partial<SemanticColorScheme>;
    lightColors?: Partial<SemanticColorScheme>;
    darkColors?: Partial<SemanticColorScheme>;
  }>;
  log?: Readonly<{
    scrollMargin?: number;
  }>;
}>;

export type ResolvedAppConfig = Readonly<{
  colorScheme: Readonly<{
    mode: ResolvedThemeMode;
    semanticColors: SemanticColorScheme;
  }>;
  log: Readonly<{
    scrollMargin: number;
  }>;
}>;

const sharedDefaultColors: SemanticColorScheme = {
  chromeFillOne: undefined,
  chromeFillTwo: undefined,
  chromeFillThree: undefined,
  chromeBorderIdle: "#5b6773",
  chromeBorderFocus: "#4f8cff",
  rowFocusedFill: "#1f3a5f",
  rowSelectedFill: "#294445",
  rowSelectedAccent: "#6ac48a",
  rowAffectedFill: "#294445",
  rowCommandTargetBorder: "#d6842a",
  graphWorkingCopy: "#4f8cff",
  graphPlain: "#7f8a96",
  graphImmutable: "#8a6fb4",
  graphBookmark: "#d6842a",
  bookmarkTagFill: "#4b3b24",
  bookmarkTagText: "#f7d8a2",
  workspaceTagFill: "#1f4d4f",
  workspaceTagText: "#c7f0f2",
  textPrimary: "#edf2f7",
  textSecondary: "#b8c2cc",
  textTertiary: "#96a1ad",
  textQuaternary: "#7f8a96",
  textMuted: "#7f8a96",
  fileFocusMarker: "#4f8cff",
  fileStatusAccent: "#d6842a",
  statusInfo: "#72b7ff",
  statusSuccess: "#6ac48a",
  statusWarning: "#f0c36a",
  statusError: "#ff7a7a",
};

const lightDefaultColors: Partial<SemanticColorScheme> = {
  chromeBorderIdle: "#9aa6b2",
  chromeBorderFocus: "#0059d6",
  rowFocusedFill: "#d7e6ff",
  rowSelectedFill: "#d9ece1",
  rowSelectedAccent: "#1f8a4c",
  rowAffectedFill: "#d9ece1",
  rowCommandTargetBorder: "#b56c00",
  graphWorkingCopy: "#0059d6",
  graphPlain: "#62707d",
  graphImmutable: "#6a4fb5",
  graphBookmark: "#b56c00",
  bookmarkTagFill: "#f3dfbf",
  bookmarkTagText: "#523300",
  workspaceTagFill: "#cbe9eb",
  workspaceTagText: "#12383a",
  textPrimary: "#13202b",
  textSecondary: "#42515d",
  textTertiary: "#52606c",
  textQuaternary: "#62707d",
  textMuted: "#62707d",
  fileFocusMarker: "#0059d6",
  fileStatusAccent: "#b56c00",
  statusInfo: "#0059d6",
  statusSuccess: "#1f8a4c",
  statusWarning: "#a86400",
  statusError: "#c93b3b",
};

const darkDefaultColors: Partial<SemanticColorScheme> = {};

export const defaultAppConfig: AppConfig = {
  colorScheme: {
    mode: "auto",
  },
};

export function defineConfig(config: AppConfig): AppConfig {
  return config;
}

export function resolveThemeMode(
  requestedMode: ThemeMode | undefined,
  detectedThemeMode: ResolvedThemeMode | null,
): ResolvedThemeMode {
  if (requestedMode === "light" || requestedMode === "dark") {
    return requestedMode;
  }

  return detectedThemeMode ?? "dark";
}

export function resolveAppConfig(
  config: AppConfig,
  options: Readonly<{
    detectedThemeMode?: ResolvedThemeMode | null;
  }> = {},
): ResolvedAppConfig {
  const detectedThemeMode = options.detectedThemeMode ?? null;
  const mode = resolveThemeMode(config.colorScheme?.mode, detectedThemeMode);
  const defaults = mode === "light" ? lightDefaultColors : darkDefaultColors;
  const semanticColors = {
    ...sharedDefaultColors,
    ...defaults,
    ...config.colorScheme?.semanticColors,
    ...(mode === "light"
      ? config.colorScheme?.lightColors
      : config.colorScheme?.darkColors),
  };

  return {
    colorScheme: {
      mode,
      semanticColors,
    },
    log: {
      scrollMargin: config.log?.scrollMargin ?? 1,
    },
  };
}
