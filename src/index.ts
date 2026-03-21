import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { detectTerminalThemeMode, loadAppConfig } from "./config/index.ts";
import { runJifApplication } from "./app.ts";
import { materializeSampleRepo } from "./dev/sampleRepo.ts";

export async function main(argv: readonly string[]) {
  const runSample = argv.includes("--sample");
  const explicitRepoPath = readFlagValue(argv, "--repo");
  const detectedThemeMode = await detectTerminalThemeMode();
  const config = await loadAppConfig({ detectedThemeMode });

  const repoPath = explicitRepoPath
    ? resolve(explicitRepoPath)
    : runSample
    ? (await materializeSampleRepo({
        baseDir: await ensureRuntimeTempDir(),
      })).repoPath
    : process.cwd();

  await runJifApplication(repoPath, config);
}

async function ensureRuntimeTempDir(): Promise<string> {
  const dir = resolve(".tmp/runtime");
  await mkdir(dir, { recursive: true });
  return join(dir, `sample-${Date.now()}`);
}

function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const exactIndex = args.indexOf(flag);
  if (exactIndex >= 0) {
    return args[exactIndex + 1];
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}
