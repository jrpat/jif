import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseCliOptions } from "./cliOptions.ts";
import { initUserConfig } from "./config/initConfig.ts";
import { loadAppConfig } from "./config/loadConfig.ts";
import { logShortcutDebug } from "./debug.ts";
import { materializeSampleRepoCachedViaCli } from "./dev/sampleRepoLauncher.ts";
import { runJifApplication } from "./app.ts";

export async function main(argv: readonly string[]) {
  const options = parseCliOptions(argv);

  if (options.command === "init-config") {
    const result = await initUserConfig();
    console.log(`Initialized user config in ${result.configDir}`);
    console.log(`${result.createdConfig ? "Created" : "Kept"} ${result.configPath}`);
    console.log(`${result.createdTypes ? "Created" : result.updatedTypes ? "Updated" : "Kept"} ${result.typesPath}`);
    return;
  }

  const { raw: rawConfig, resolved: loadedConfig } = await loadAppConfig();
  const config = options.useLongFlags
    ? { ...loadedConfig, commands: { ...loadedConfig.commands, shortFlags: false } }
    : loadedConfig;

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
