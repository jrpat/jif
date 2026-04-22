import { access } from "node:fs/promises";
import { resolve } from "node:path";
import type { SampleRepoMaterialization } from "../domain/types.ts";

export function buildSampleRepoCliCommand(options: Readonly<{
  baseDir: string;
  fixturePath: string;
  bunPath: string;
  scriptPath: string;
}>): readonly string[] {
  return [
    options.bunPath,
    "run",
    options.scriptPath,
    "--base-dir",
    options.baseDir,
    "--fixture-path",
    options.fixturePath,
  ];
}

export function parseSampleRepoCliOutput(stdout: string): SampleRepoMaterialization {
  const parsed = JSON.parse(stdout) as Partial<SampleRepoMaterialization>;
  if (!parsed.repoPath || typeof parsed.repoPath !== "string") {
    throw new Error("Sample repo helper did not return a repoPath");
  }

  return {
    repoPath: parsed.repoPath,
    workspacePaths: Object.freeze({ ...(parsed.workspacePaths ?? {}) }),
  };
}

export async function materializeSampleRepoCachedViaCli(options: Readonly<{
  baseDir: string;
  fixturePath: string;
}>): Promise<SampleRepoMaterialization> {
  const scriptPath = resolve(import.meta.dir, "../../scripts/materializeSampleRepoCli.ts");
  await ensureFileExists(scriptPath);

  const bunPath = Bun.which("bun");
  if (!bunPath) {
    throw new Error("--sample requires `bun` on PATH to materialize the sample repository");
  }

  const command = buildSampleRepoCliCommand({
    baseDir: options.baseDir,
    fixturePath: options.fixturePath,
    bunPath,
    scriptPath,
  });
  const proc = Bun.spawn({
    cmd: [...command],
    cwd: resolve(import.meta.dir, "../.."),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `Sample repo helper failed with exit code ${exitCode}`);
  }

  return parseSampleRepoCliOutput(stdout);
}

async function ensureFileExists(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new Error(`Sample repo helper script not found: ${path}`);
  }
}