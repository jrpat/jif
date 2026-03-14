import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

export async function loadAppConfig(projectRoot = resolve(import.meta.dir, "../..")): Promise<ResolvedAppConfig> {
  for (const candidate of CONFIG_CANDIDATES) {
    const configPath = resolve(projectRoot, candidate);
    if (!(await fileExists(configPath))) {
      continue;
    }

    const module = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`);
    const config = (module.default ?? module.config ?? defaultAppConfig) as AppConfig;
    return resolveAppConfig(config);
  }

  return resolveAppConfig(defaultAppConfig);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
