import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { TerminalColors } from "@opentui/core";
import {
  defaultAppConfig,
  resolveAppConfig,
  type AppConfig,
  type ResolvedAppConfig,
} from "./schema.ts";

export const CONFIG_CANDIDATES = [
  "config.ts",
  "config.js",
  "jif.config.ts",
  "jif.config.js",
] as const;

export async function loadAppConfig(options: Readonly<{
  configDir?: string;
  palette?: TerminalColors | null;
}> = {}): Promise<{ raw: AppConfig; resolved: ResolvedAppConfig }> {
  const configDir = options.configDir ?? resolveUserConfigDir();
  const palette = options.palette ?? null;

  for (const candidate of CONFIG_CANDIDATES) {
    const configPath = resolve(configDir, candidate);
    if (!(await fileExists(configPath))) {
      continue;
    }

    const module = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`);
    const raw = (module.default ?? module.config ?? defaultAppConfig) as AppConfig;
    return { raw, resolved: resolveAppConfig(raw, { palette }) };
  }

  return { raw: defaultAppConfig, resolved: resolveAppConfig(defaultAppConfig, { palette }) };
}

export function resolveUserConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome && xdgConfigHome.length > 0) {
    return join(xdgConfigHome, "jif");
  }

  return join(process.env.HOME || homedir(), ".config", "jif");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
