import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseCommand, type InitConfigOptions, type RunOptions } from "./cliOptions.ts";
import { initProjectConfig, initUserConfig } from "./config/initConfig.ts";
import { loadAppConfig } from "./config/loadConfig.ts";
import { logShortcutDebug } from "./debug.ts";
import { materializeSampleRepoCachedViaCli } from "./dev/sampleRepoLauncher.ts";
import { runJifApplication } from "./app.ts";

export async function main(argv: readonly string[]) {
  const command = parseCommand(argv);

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

  const { raw: rawConfig, resolved: loadedConfig } = await loadAppConfig({
    replaceUserConfigPath: options.configReplacement,
    baseLayerPaths: options.configBaseLayers,
    overrideLayerPaths: options.configOverrideLayers,
    projectStartDir: repoPath,
  });
  const config = options.useLongFlags
    ? { ...loadedConfig, commands: { ...loadedConfig.commands, shortFlags: false } }
    : loadedConfig;

  logShortcutDebug("startup", {
    argv: [...argv],
    repoPath,
    sample: fixturePath ?? null,
  });

  await runJifApplication(repoPath, config, rawConfig);
}

async function ensureRuntimeTempDir(): Promise<string> {
  const dir = resolve(".tmp/runtime");
  await mkdir(dir, { recursive: true });
  return join(dir, `sample-${Date.now()}`);
}
