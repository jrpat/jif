export const DEFAULT_PALETTE_IDLE_TIMEOUT_MS = 50;

type PaletteTimeoutEnvironment = {
  OTUI_PALETTE_IDLE_TIMEOUT_MS?: string | undefined;
};

// OpenTUI's palette detector only finishes early when every color query is
// answered, but it also asks for special colors (mouse, Tektronix, highlight)
// that almost no terminal implements, so in practice detection ends via the
// idle timeout. Its 300ms default adds that much latency to every startup;
// real terminals deliver the answers they will ever send within a few
// milliseconds, so a 50ms idle window is plenty. Explicit values always win.
export function configureOpenTUIPaletteIdleTimeout(options: {
  env?: PaletteTimeoutEnvironment;
} = {}): boolean {
  const env = options.env ?? process.env;
  if (env.OTUI_PALETTE_IDLE_TIMEOUT_MS?.trim()) {
    return false;
  }

  env.OTUI_PALETTE_IDLE_TIMEOUT_MS = String(DEFAULT_PALETTE_IDLE_TIMEOUT_MS);
  return true;
}
