import { access, copyFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
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

let configImportCounter = 0;

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
    ? await loadConfigFile(resolveConfigFilePath(options.replaceUserConfigPath))
    : await discoverUserConfig(options.configDir);

  const projectLayer = options.projectStartDir !== undefined
    ? await discoverProjectLocalConfig(options.projectStartDir)
    : {};

  const baseLayers: AppConfig[] = [];
  for (const path of baseLayerPaths) {
    baseLayers.push(await loadConfigFile(resolveConfigFilePath(path)));
  }

  const overrideLayers: AppConfig[] = [];
  for (const path of overrideLayerPaths) {
    overrideLayers.push(await loadConfigFile(resolveConfigFilePath(path)));
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

export function projectConfigDir(workspaceRoot: string): string {
  return join(workspaceRoot, ".jj", "jif");
}

async function discoverProjectLocalConfig(startDir: string): Promise<AppConfig> {
  const workspaceRoot = await resolveWorkspaceRoot(startDir);
  if (workspaceRoot === null) return {};

  const configDir = projectConfigDir(workspaceRoot);
  for (const candidate of CONFIG_CANDIDATES) {
    const configPath = join(configDir, candidate);
    if (await fileExists(configPath)) {
      return loadConfigFile(configPath);
    }
  }

  return {};
}

export async function resolveWorkspaceRoot(startDir: string): Promise<string | null> {
  try {
    const result = await runCommand(resolve(startDir), ["jj", "--ignore-working-copy", "workspace", "root"]);
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

  const importPath = await getConfigImportPath(absolutePath);
  try {
    const specifier = importPath === absolutePath
      ? `${pathToFileURL(absolutePath).href}?t=${Date.now()}.${configImportCounter += 1}`
      : pathToFileURL(importPath).href;
    const module = await import(specifier);
    return (module.default ?? module.config ?? {}) as AppConfig;
  } finally {
    if (importPath !== absolutePath) {
      await removeImportCopy(importPath);
    }
  }
}

export function resolveConfigFilePath(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return resolve(homedir(), input.slice(2));
  return resolve(input);
}

async function getConfigImportPath(absolutePath: string): Promise<string> {
  try {
    return await copyConfigForFreshImport(absolutePath);
  } catch (error) {
    if (isPermissionError(error)) {
      return absolutePath;
    }

    throw error;
  }
}

async function copyConfigForFreshImport(absolutePath: string): Promise<string> {
  const extension = extname(absolutePath);
  const stem = basename(absolutePath, extension);
  const importPath = join(
    dirname(absolutePath),
    `.${stem}.${process.pid}.${Date.now()}.${configImportCounter += 1}${extension}`,
  );

  await copyFile(absolutePath, importPath);
  return importPath;
}

async function removeImportCopy(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Best-effort cleanup; stale temp copies should not mask config load errors.
  }
}

function isPermissionError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }

  return error.code === "EACCES" || error.code === "EPERM" || error.code === "EROFS";
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
