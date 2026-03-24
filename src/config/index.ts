export {
  defaultAppConfig,
  defineConfig,
  resolveAppConfig,
  resolveSemanticColors,
  FALLBACK_PALETTE_DARK,
  FALLBACK_PALETTE_LIGHT,
  type AppConfig,
  type PaletteColorDef,
  type PaletteSource,
  type ResolvedAppConfig,
  type SemanticColorScheme,
  type SemanticColorValue,
} from "./schema.ts";
export { loadAppConfig } from "./loadConfig.ts";
export {
  detectTerminalThemeMode,
  detectThemeModeFromColorFgbg,
  inferThemeModeFromRgb,
  parseOsc11Response,
  queryTerminalBackground,
} from "./detectTerminalTheme.ts";
