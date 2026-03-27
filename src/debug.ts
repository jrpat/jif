const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function shortcutDebugEnabled(): boolean {
  return ENABLED_VALUES.has((process.env.JIF_SHORTCUT_DEBUG ?? "").toLowerCase());
}

export function logShortcutDebug(
  message: string,
  details?: Record<string, unknown>,
): void {
  if (!shortcutDebugEnabled()) {
    return;
  }

  let line = `[jif-shortcut-debug] ${message}`;
  if (details) {
    line += ` ${safeJson(details)}`;
  }

  process.stderr.write(`${line}\n`);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "\"<unserializable>\"";
  }
}
