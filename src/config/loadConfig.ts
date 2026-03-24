import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { TerminalColors } from "@opentui/core";
import {
  defaultAppConfig,
  resolveAppConfig,
  type AppConfig,
  type ResolvedAppConfig,
} from "./schema.ts";

const CONFIG_CANDIDATES = [
  "config.ts",
  "config.js",
  "jif.config.ts",
  "jif.config.js",
] as const;

export async function loadAppConfig(options: Readonly<{
  projectRoot?: string;
  palette?: TerminalColors | null;
}> = {}): Promise<{ raw: AppConfig; resolved: ResolvedAppConfig }> {
  const projectRoot = options.projectRoot ?? resolve(import.meta.dir, "../..");
  const palette = options.palette ?? null;

  for (const candidate of CONFIG_CANDIDATES) {
    const configPath = resolve(projectRoot, candidate);
    if (!(await fileExists(configPath))) {
      continue;
    }

    const module = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`);
    const raw = (module.default ?? module.config ?? defaultAppConfig) as AppConfig;
    return { raw, resolved: resolveAppConfig(raw, { palette }) };
  }

  return { raw: defaultAppConfig, resolved: resolveAppConfig(defaultAppConfig, { palette }) };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
