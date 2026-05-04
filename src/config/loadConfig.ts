import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { TerminalColors } from "@opentui/core";
import { runCommand } from "../jj/process.ts";
import { mergeConfigLayers } from "./deepMerge.ts";
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

export const PROJECT_CONFIG_CANDIDATES = [
  "jif.config.ts",
  "jif.config.js",
] as const;

export async function loadAppConfig(options: Readonly<{
  configDir?: string;
  palette?: TerminalColors | null;
  replaceUserConfigPath?: string;
  baseLayerPaths?: readonly string[];
  overrideLayerPaths?: readonly string[];
  projectStartDir?: string;
}> = {}): Promise<{ raw: AppConfig; resolved: ResolvedAppConfig }> {
  const palette = options.palette ?? null;
  const baseLayerPaths = options.baseLayerPaths ?? [];
  const overrideLayerPaths = options.overrideLayerPaths ?? [];

  const userLayer = options.replaceUserConfigPath !== undefined
    ? await loadConfigFile(resolveLayerPath(options.replaceUserConfigPath))
    : await discoverUserConfig(options.configDir);

  const projectLayer = options.projectStartDir !== undefined
    ? await discoverProjectLocalConfig(options.projectStartDir)
    : {};

  const baseLayers: AppConfig[] = [];
  for (const path of baseLayerPaths) {
    baseLayers.push(await loadConfigFile(resolveLayerPath(path)));
  }

  const overrideLayers: AppConfig[] = [];
  for (const path of overrideLayerPaths) {
    overrideLayers.push(await loadConfigFile(resolveLayerPath(path)));
  }

  const raw = mergeConfigLayers([
    defaultAppConfig,
    ...baseLayers,
    userLayer,
    projectLayer,
    ...overrideLayers,
  ]);

  return { raw, resolved: resolveAppConfig(raw, { palette }) };
}

export function resolveUserConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome && xdgConfigHome.length > 0) {
    return join(xdgConfigHome, "jif");
  }

  return join(process.env.HOME || homedir(), ".config", "jif");
}

async function discoverProjectLocalConfig(startDir: string): Promise<AppConfig> {
  const workspaceRoot = await resolveWorkspaceRoot(startDir);
  if (workspaceRoot === null) return {};

  const jjDir = join(workspaceRoot, ".jj");
  for (const candidate of PROJECT_CONFIG_CANDIDATES) {
    const configPath = join(jjDir, candidate);
    if (await fileExists(configPath)) {
      return loadConfigFile(configPath);
    }
  }

  return {};
}

export async function resolveWorkspaceRoot(startDir: string): Promise<string | null> {
  try {
    const result = await runCommand(resolve(startDir), ["jj", "workspace", "root"]);
    const root = result.stdout.trim();
    return root.length > 0 ? root : null;
  } catch {
    return null;
  }
}

async function discoverUserConfig(configDir?: string): Promise<AppConfig> {
  const dir = configDir ?? resolveUserConfigDir();

  for (const candidate of CONFIG_CANDIDATES) {
    const configPath = resolve(dir, candidate);
    if (await fileExists(configPath)) {
      return loadConfigFile(configPath);
    }
  }

  return {};
}

async function loadConfigFile(absolutePath: string): Promise<AppConfig> {
  if (!(await fileExists(absolutePath))) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const module = await import(`${pathToFileURL(absolutePath).href}?t=${Date.now()}`);
  return (module.default ?? module.config ?? {}) as AppConfig;
}

function resolveLayerPath(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return resolve(homedir(), input.slice(2));
  return resolve(input);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
