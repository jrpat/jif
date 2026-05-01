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
  createUserAppState,
  resolveConfiguredKeymap,
  type ResolvedConfiguredKeymap,
  type UserAppState,
  type UserKeyBinding,
  type UserKeybindingCommand,
  type UserKeyMap,
} from "./keymap.ts";
export type { UserAppState as AppState } from "./keymap.ts";
export type {
  UserCommandController,
  InteractiveJjCommandOptions,
  JjCommandOptions,
} from "../commands/definitions.ts";
export {
  detectTerminalThemeMode,
  detectThemeModeFromColorFgbg,
  inferThemeModeFromRgb,
  parseOsc11Response,
  queryTerminalBackground,
} from "./detectTerminalTheme.ts";
