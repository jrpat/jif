export {
  defaultAppConfig,
  defineConfig,
  resolveAppConfig,
  resolveThemeMode,
  type AppConfig,
  type ResolvedThemeMode,
  type ResolvedAppConfig,
  type SemanticColorScheme,
  type SemanticColorValue,
  type ThemeMode,
} from "./schema.ts";
export { loadAppConfig } from "./loadConfig.ts";
export {
  detectTerminalThemeMode,
  detectThemeModeFromColorFgbg,
  inferThemeModeFromRgb,
  parseOsc11Response,
  queryTerminalBackground,
} from "./detectTerminalTheme.ts";
