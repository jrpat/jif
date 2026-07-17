import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { formatUsageText, parseCommand, type InitConfigOptions, type RunOptions } from "./cliOptions.ts";
import { initProjectConfig, initUserConfig, refreshUserConfigTypes } from "./config/initConfig.ts";
import { loadAppConfig } from "./config/loadConfig.ts";
import { logShortcutDebug } from "./debug.ts";
import { materializeSampleRepoCachedViaCli } from "./dev/sampleRepoLauncher.ts";
import { CommandExecutionError } from "./jj/process.ts";
import { configureOpenTUIPaletteIdleTimeout } from "./opentuiPaletteIdleTimeout.ts";
import { configureOpenTUITreeSitterWorker } from "./opentuiTreeSitterWorker.ts";
import { jifVersion } from "./version.ts";

export async function main(argv: readonly string[]) {
  const command = parseCommand(argv);

  if (command.kind === "help") {
    console.log(formatUsageText());
    return;
  }

  if (command.kind === "version") {
    console.log(`jif ${jifVersion()}`);
    return;
  }

  if (command.kind === "init-config") {
    await runInitConfig(command.options);
    return;
  }

  await runApp(argv, command.options);
}

async function runInitConfig(options: InitConfigOptions): Promise<void> {
  if (options.project) {
    const startDir = options.projectStartDir ?? process.cwd();
    const result = await initProjectConfig({ startDir });
    console.log(`Initialized project config in ${result.configDir}`);
    console.log(`Workspace root: ${result.workspaceRoot}`);
    console.log(`${result.createdConfig ? "Created" : "Kept"} ${result.configPath}`);
    console.log(
      `${result.createdTypes ? "Created" : result.updatedTypes ? "Updated" : "Kept"} ${result.typesPath}`,
    );
    return;
  }

  const result = await initUserConfig();
  console.log(`Initialized user config in ${result.configDir}`);
  console.log(`${result.createdConfig ? "Created" : "Kept"} ${result.configPath}`);
  console.log(
    `${result.createdTypes ? "Created" : result.updatedTypes ? "Updated" : "Kept"} ${result.typesPath}`,
  );
}

async function runApp(argv: readonly string[], options: RunOptions): Promise<void> {
  const fixturePath = options.sampleName !== undefined
    ? resolve(`test/fixtures/${options.sampleName || "sample-repo"}.jsonl`)
    : undefined;

  const repoPath = options.explicitRepoPath
    ? resolve(options.explicitRepoPath)
    : fixturePath !== undefined
    ? (await materializeSampleRepoCachedViaCli({
        baseDir: await ensureRuntimeTempDir(),
        fixturePath,
      })).repoPath
    : process.cwd();

  configureOpenTUITreeSitterWorker();
  configureOpenTUIPaletteIdleTimeout();

  await refreshUserConfigTypes(
    options.configReplacement === undefined ? {} : { configPath: options.configReplacement },
  );

  const loadRuntimeConfig = async (projectStartDir = repoPath) => {
    const { raw, resolved: loadedConfig } = await loadAppConfig({
      replaceUserConfigPath: options.configReplacement,
      baseLayerPaths: options.configBaseLayers,
      overrideLayerPaths: options.configOverrideLayers,
      projectStartDir,
    });
    const resolved = options.useLongFlags
      ? { ...loadedConfig, commands: { ...loadedConfig.commands, shortFlags: false } }
      : loadedConfig;
    return { raw, resolved };
  };
  const { raw: rawConfig, resolved: config } = await loadRuntimeConfig();

  logShortcutDebug("startup", {
    argv: [...argv],
    repoPath,
    sample: fixturePath ?? null,
  });

  const { runJifApplication } = await import("./app.ts");
  await runJifApplication(repoPath, config, rawConfig, {
    reloadConfig: loadRuntimeConfig,
    refreshConfigTypes: () => refreshUserConfigTypes(
      options.configReplacement === undefined ? {} : { configPath: options.configReplacement },
    ),
    onStartupError: (error) => {
      console.error(formatStartupError(error, repoPath));
      process.exitCode = 1;
    },
  });
}

function formatStartupError(error: unknown, repoPath: string): string {
  if (
    error instanceof CommandExecutionError &&
    error.command.includes("log") &&
    error.stderr.includes("There is no jj repo")
  ) {
    return `jif: ${repoPath} is not a Jujutsu repository`;
  }
  return error instanceof Error ? error.message : String(error);
}

async function ensureRuntimeTempDir(): Promise<string> {
  const dir = resolve(".tmp/runtime");
  await mkdir(dir, { recursive: true });
  return join(dir, `sample-${Date.now()}`);
}
