import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadAppConfig } from "./config/index.ts";
import { logShortcutDebug } from "./debug.ts";
import { runJifApplication } from "./app.ts";
import { materializeSampleRepoCached } from "./dev/sampleRepo.ts";

export async function main(argv: readonly string[]) {
  const sampleName = readOptionalFlag(argv, "--sample");
  const useLongFlags = argv.includes("--long-flags");
  const explicitRepoPath = readFlagValue(argv, "--repo");
  const { raw: rawConfig, resolved: loadedConfig } = await loadAppConfig();
  const config = useLongFlags
    ? { ...loadedConfig, commands: { ...loadedConfig.commands, shortFlags: false } }
    : loadedConfig;

  const fixturePath = sampleName !== undefined
    ? resolve(`test/fixtures/${sampleName || "sample-repo"}.jsonl`)
    : undefined;

  const repoPath = explicitRepoPath
    ? resolve(explicitRepoPath)
    : fixturePath !== undefined
    ? (await materializeSampleRepoCached({
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

function readOptionalFlag(args: readonly string[], flag: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) {
    return inline.slice(flag.length + 1);
  }

  const exactIndex = args.indexOf(flag);
  if (exactIndex < 0) {
    return undefined;
  }

  const next = args[exactIndex + 1];
  if (next === undefined || next.startsWith("--")) {
    return "";
  }

  return next;
}

function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const exactIndex = args.indexOf(flag);
  if (exactIndex >= 0) {
    return args[exactIndex + 1];
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}
