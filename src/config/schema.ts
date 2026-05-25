import type { TerminalColors } from "@opentui/core";
import type { AppLayout } from "../domain/types.ts";
import type { UserKeyMap } from "./keymap.ts";

export type SemanticColorValue = string | undefined;

export type PaletteSource =
  | "foreground" | "background"
  | "black" | "red" | "green" | "yellow"
  | "blue" | "magenta" | "cyan" | "white"
  | "brightBlack" | "brightRed" | "brightGreen" | "brightYellow"
  | "brightBlue" | "brightMagenta" | "brightCyan" | "brightWhite";

export type PaletteColorDef = Readonly<{ source: PaletteSource; opacity: number }>;

export type SemanticColorOverride = string | PaletteColorDef;

export type SemanticColorScheme = Readonly<{
  chromeFillOne: SemanticColorValue;
  chromeFillTwo: SemanticColorValue;
  chromeFillThree: SemanticColorValue;
  chromeScrollbarThumb: SemanticColorValue;
  chromeBorderIdle: SemanticColorValue;
  chromeBorderFocus: SemanticColorValue;
  rowFocusedFill: SemanticColorValue;
  rowSelectedFill: SemanticColorValue;
  rowSelectedAccent: SemanticColorValue;
  rowAffectedFill: SemanticColorValue;
  rowCommandTargetBorder: SemanticColorValue;
  rowBorderIdle: SemanticColorValue;
  rowBorderFocus: SemanticColorValue;
  rowBorderSelected: SemanticColorValue;
  rowBorderCommandTarget: SemanticColorValue;
  graphWorkingCopy: SemanticColorValue;
  graphPlain: SemanticColorValue;
  graphImmutable: SemanticColorValue;
  graphBookmark: SemanticColorValue;
  bookmarkTagFill: SemanticColorValue;
  bookmarkTagText: SemanticColorValue;
  workspaceTagFill: SemanticColorValue;
  workspaceTagText: SemanticColorValue;
  conflictTagFill: SemanticColorValue;
  conflictTagText: SemanticColorValue;
  textPrimary: SemanticColorValue;
  textSecondary: SemanticColorValue;
  textTertiary: SemanticColorValue;
  textQuaternary: SemanticColorValue;
  revsetPrefix: SemanticColorValue;
  fileFocusMarker: SemanticColorValue;
  fileStatusAccent: SemanticColorValue;
  statusInfo: SemanticColorValue;
  statusSuccess: SemanticColorValue;
  statusWarning: SemanticColorValue;
  statusError: SemanticColorValue;
  statusInfoFill: SemanticColorValue;
  statusSuccessFill: SemanticColorValue;
  statusWarningFill: SemanticColorValue;
  statusErrorFill: SemanticColorValue;
}>;

type SemanticColorKey = keyof SemanticColorScheme;

export type AppConfig = Readonly<{
  colorScheme?: Readonly<{
    colors?: Partial<Record<SemanticColorKey, SemanticColorOverride>>;
  }>;
  keymap?: UserKeyMap;
  log?: Readonly<{
    scrollMargin?: number;
    revisionIdAdditionalChars?: number;
  }>;
  commands?: Readonly<{
    shortFlags?: boolean;
    layout?: AppLayout;
  }>;
  notifications?: Readonly<{
    historyLimit?: number;
  }>;
}>;

export type ResolvedAppConfig = Readonly<{
  colorScheme: Readonly<{
    semanticColors: SemanticColorScheme;
  }>;
  terminalPalette: readonly (string | null)[];
  log: Readonly<{
    scrollMargin: number;
    revisionIdAdditionalChars: number;
  }>;
  commands: Readonly<{
    shortFlags: boolean;
    layout: AppLayout;
  }>;
  notifications: Readonly<{
    historyLimit: number;
  }>;
}>;

// ---------- Default color definitions ----------

const defaultColorDefs: Record<SemanticColorKey, PaletteColorDef> = {
  // Chrome / containers
  chromeFillOne:          { source: "background",  opacity: 1.0  },
  chromeFillTwo:          { source: "foreground",  opacity: 0.08 },
  chromeFillThree:        { source: "foreground",  opacity: 0.12 },
  chromeScrollbarThumb:   { source: "foreground",  opacity: 0.24 },
  chromeBorderIdle:       { source: "foreground",  opacity: 0.35 },
  chromeBorderFocus:      { source: "blue",        opacity: 1.0  },

  // Row states
  rowFocusedFill:         { source: "blue",        opacity: 0.15 },
  rowSelectedFill:        { source: "green",       opacity: 0.12 },
  rowSelectedAccent:      { source: "green",       opacity: 1.0  },
  rowAffectedFill:        { source: "green",       opacity: 0.12 },
  rowCommandTargetBorder: { source: "yellow",      opacity: 1.0  },
  rowBorderIdle:          { source: "foreground",  opacity: 0.20 },
  rowBorderFocus:         { source: "blue",        opacity: 0.50 },
  rowBorderSelected:      { source: "green",       opacity: 0.50 },
  rowBorderCommandTarget: { source: "yellow",      opacity: 0.50 },

  // Graph markers
  graphWorkingCopy:       { source: "blue",        opacity: 1.0  },
  graphPlain:             { source: "foreground",  opacity: 0.45 },
  graphImmutable:         { source: "magenta",     opacity: 0.8  },
  graphBookmark:          { source: "yellow",      opacity: 1.0  },

  // Tags
  bookmarkTagFill:        { source: "cyan",        opacity: 0.15 },
  bookmarkTagText:        { source: "cyan",        opacity: 1.0  },
  workspaceTagFill:       { source: "yellow",      opacity: 0.15 },
  workspaceTagText:       { source: "yellow",      opacity: 1.0  },
  conflictTagFill:        { source: "red",         opacity: 0.15 },
  conflictTagText:        { source: "red",         opacity: 1.0  },

  // Text hierarchy
  textPrimary:            { source: "foreground",  opacity: 0.93 },
  textSecondary:          { source: "foreground",  opacity: 0.70 },
  textTertiary:           { source: "foreground",  opacity: 0.48 },
  textQuaternary:         { source: "foreground",  opacity: 0.36 },

  // Accents
  revsetPrefix:           { source: "magenta",     opacity: 1.0  },
  fileFocusMarker:        { source: "blue",        opacity: 1.0  },
  fileStatusAccent:       { source: "yellow",      opacity: 1.0  },

  // Status
  statusInfo:             { source: "blue",        opacity: 1.0  },
  statusSuccess:          { source: "green",       opacity: 1.0  },
  statusWarning:          { source: "yellow",      opacity: 1.0  },
  statusError:            { source: "red",         opacity: 1.0  },
  statusInfoFill:         { source: "blue",        opacity: 0.12 },
  statusSuccessFill:      { source: "green",       opacity: 0.12 },
  statusWarningFill:      { source: "yellow",      opacity: 0.12 },
  statusErrorFill:        { source: "red",         opacity: 0.12 },
};

// ---------- Palette source → TerminalColors lookup ----------

const paletteIndexMap: Record<string, number> = {
  black: 0, red: 1, green: 2, yellow: 3,
  blue: 4, magenta: 5, cyan: 6, white: 7,
  brightBlack: 8, brightRed: 9, brightGreen: 10, brightYellow: 11,
  brightBlue: 12, brightMagenta: 13, brightCyan: 14, brightWhite: 15,
};

function lookupPaletteColor(source: PaletteSource, palette: TerminalColors): string | null {
  if (source === "foreground") return palette.defaultForeground;
  if (source === "background") return palette.defaultBackground;
  const index = paletteIndexMap[source];
  if (index !== undefined && index < palette.palette.length) {
    return palette.palette[index] ?? null;
  }
  return null;
}

// ---------- Color blending ----------

function parseHex(hex: string): [number, number, number] | null {
  const stripped = hex.startsWith("#") ? hex.slice(1) : hex;
  if (stripped.length === 3) {
    const r = Number.parseInt(stripped[0]! + stripped[0]!, 16);
    const g = Number.parseInt(stripped[1]! + stripped[1]!, 16);
    const b = Number.parseInt(stripped[2]! + stripped[2]!, 16);
    return [r, g, b];
  }
  if (stripped.length === 6) {
    const r = Number.parseInt(stripped.slice(0, 2), 16);
    const g = Number.parseInt(stripped.slice(2, 4), 16);
    const b = Number.parseInt(stripped.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

function blendColor(fgHex: string, bgHex: string, opacity: number): string {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  if (!fg || !bg) return fgHex;
  if (opacity >= 1.0) return fgHex;
  if (opacity <= 0.0) return bgHex;
  return toHex(
    fg[0] * opacity + bg[0] * (1 - opacity),
    fg[1] * opacity + bg[1] * (1 - opacity),
    fg[2] * opacity + bg[2] * (1 - opacity),
  );
}

// ---------- Resolution ----------

function resolveColorDef(
  def: PaletteColorDef,
  palette: TerminalColors,
): string | undefined {
  const color = lookupPaletteColor(def.source, palette);
  const bg = palette.defaultBackground;
  if (!color || !bg) return undefined;
  return blendColor(color, bg, def.opacity);
}

export function resolveSemanticColors(
  palette: TerminalColors,
  overrides?: Partial<Record<SemanticColorKey, SemanticColorOverride>>,
): SemanticColorScheme {
  const result: Record<string, string | undefined> = {};

  for (const key of Object.keys(defaultColorDefs) as SemanticColorKey[]) {
    const override = overrides?.[key];
    if (typeof override === "string") {
      result[key] = override;
    } else {
      const def = (override as PaletteColorDef | undefined) ?? defaultColorDefs[key];
      result[key] = resolveColorDef(def, palette);
    }
  }

  return result as SemanticColorScheme;
}

export const defaultAppConfig: AppConfig = {};

export function defineConfig(config: AppConfig): AppConfig {
  return config;
}

export function resolveAppConfig(
  config: AppConfig,
  options: Readonly<{
    palette?: TerminalColors | null;
  }> = {},
): ResolvedAppConfig {
  const palette = options.palette ?? null;
  const semanticColors = palette
    ? resolveSemanticColors(palette, config.colorScheme?.colors)
    : fallbackSemanticColors(config.colorScheme?.colors);

  return {
    colorScheme: {
      semanticColors,
    },
    terminalPalette: palette?.palette ?? FALLBACK_PALETTE_DARK.palette,
    log: {
      scrollMargin: config.log?.scrollMargin ?? 1,
      revisionIdAdditionalChars: config.log?.revisionIdAdditionalChars ?? 0,
    },
    commands: {
      shortFlags: config.commands?.shortFlags ?? true,
      layout: config.commands?.layout ?? "normal",
    },
    notifications: {
      historyLimit: Math.max(1, Math.floor(config.notifications?.historyLimit ?? 50)),
    },
  };
}

// Pre-palette fallback: resolve against the dark xterm fallback palette
function fallbackSemanticColors(
  overrides?: Partial<Record<SemanticColorKey, SemanticColorOverride>>,
): SemanticColorScheme {
  return resolveSemanticColors(FALLBACK_PALETTE_DARK, overrides);
}

// ---------- Fallback palettes ----------

export const FALLBACK_PALETTE_DARK: TerminalColors = {
  palette: [
    "#000000", "#cd0000", "#00cd00", "#cdcd00",
    "#0000ee", "#cd00cd", "#00cdcd", "#e5e5e5",
    "#7f7f7f", "#ff0000", "#00ff00", "#ffff00",
    "#5c5cff", "#ff00ff", "#00ffff", "#ffffff",
  ],
  defaultForeground: "#e5e5e5",
  defaultBackground: "#000000",
  cursorColor: null,
  mouseForeground: null,
  mouseBackground: null,
  tekForeground: null,
  tekBackground: null,
  highlightBackground: null,
  highlightForeground: null,
};

export const FALLBACK_PALETTE_LIGHT: TerminalColors = {
  palette: [
    "#000000", "#cd0000", "#00cd00", "#cdcd00",
    "#0000ee", "#cd00cd", "#00cdcd", "#e5e5e5",
    "#7f7f7f", "#ff0000", "#00ff00", "#ffff00",
    "#5c5cff", "#ff00ff", "#00ffff", "#ffffff",
  ],
  defaultForeground: "#000000",
  defaultBackground: "#ffffff",
  cursorColor: null,
  mouseForeground: null,
  mouseBackground: null,
  tekForeground: null,
  tekBackground: null,
  highlightBackground: null,
  highlightForeground: null,
};
