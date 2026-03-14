import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { detectTerminalThemeMode, loadAppConfig } from "./config/index.ts";
import { createJifApplication } from "./app.ts";
import { materializeSampleRepo } from "./dev/sampleRepo.ts";

export async function main(argv: readonly string[]) {
  const runSample = argv.includes("--sample");
  const detectedThemeMode = await detectTerminalThemeMode();
  const config = await loadAppConfig({ detectedThemeMode });

  const repoPath = runSample
    ? (await materializeSampleRepo({
        baseDir: await ensureRuntimeTempDir(),
      })).repoPath
    : process.cwd();

  const { app, refreshRepository } = await createJifApplication(repoPath, config);
  void refreshRepository();
  await app.run();
}

async function ensureRuntimeTempDir(): Promise<string> {
  const dir = resolve(".tmp/runtime");
  await mkdir(dir, { recursive: true });
  return join(dir, `sample-${Date.now()}`);
}
