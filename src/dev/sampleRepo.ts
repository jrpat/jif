import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { SampleRepoMaterialization } from "../domain/types.ts";
import { runCommand } from "../jj/process.ts";
import { copyDir, resolveFixtureCache } from "./fixtureCache.ts";

const DEFAULT_FIXTURE = resolve("test/fixtures/sample-repo.jsonl");
const DEFAULT_CACHE_ROOT = resolve(".tmp/cache");
const CACHE_WAIT_TIMEOUT_MS = 60_000;
const CACHE_WAIT_INTERVAL_MS = 50;

type JsonlOperation =
  | Readonly<{
      kind: "writeFile";
      workspace?: string;
      path: string;
      content: string;
    }>
  | Readonly<{
      kind: "appendFile";
      workspace?: string;
      path: string;
      content: string;
    }>
  | Readonly<{
      kind: "mkdir";
      workspace?: string;
      path: string;
    }>
  | Readonly<{
      kind: "jj";
      workspace?: string;
      args: readonly string[];
    }>
  | Readonly<{
      kind: "workspaceAdd";
      workspace?: string;
      name: string;
      destination: string;
      revision?: string;
      message?: string;
    }>;

export async function materializeSampleRepo(options?: {
  baseDir?: string;
  fixturePath?: string;
}): Promise<SampleRepoMaterialization> {
  const baseDir =
    options?.baseDir ?? (await mktempDir(join(process.cwd(), ".tmp"), "sample-repo-"));
  const fixturePath = options?.fixturePath ?? DEFAULT_FIXTURE;
  const repoPath = join(baseDir, "repo");

  await mkdir(baseDir, { recursive: true });
  await runCommand(baseDir, ["jj", "git", "init", "repo"]);

  const workspacePaths = new Map<string, string>([["default", repoPath]]);
  const operations = await loadOperations(fixturePath);

  for (const operation of operations) {
    const workspace = workspacePaths.get(operation.workspace ?? "default");
    if (!workspace) {
      throw new Error(`Unknown workspace: ${operation.workspace ?? "default"}`);
    }

    switch (operation.kind) {
      case "mkdir": {
        await mkdir(join(workspace, operation.path), { recursive: true });
        break;
      }
      case "writeFile": {
        const targetPath = join(workspace, operation.path);
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, operation.content, "utf8");
        break;
      }
      case "appendFile": {
        const targetPath = join(workspace, operation.path);
        await mkdir(dirname(targetPath), { recursive: true });
        let current = "";
        try {
          current = await readFile(targetPath, "utf8");
        } catch {
          current = "";
        }
        await writeFile(targetPath, `${current}${operation.content}`, "utf8");
        break;
      }
      case "jj": {
        await runCommand(workspace, ["jj", ...operation.args]);
        break;
      }
      case "workspaceAdd": {
        const destinationPath = join(baseDir, operation.destination);
        const args = [
          "jj",
          "workspace",
          "add",
          destinationPath,
          "--name",
          operation.name,
        ];
        if (operation.revision) {
          args.push("--revision", operation.revision);
        }
        if (operation.message) {
          args.push("--message", operation.message);
        }
        await runCommand(workspace, args);
        workspacePaths.set(operation.name, destinationPath);
        break;
      }
    }
  }

  return {
    repoPath,
    workspacePaths: Object.freeze(Object.fromEntries(workspacePaths)),
  };
}

export async function materializeSampleRepoCached(options?: {
  baseDir?: string;
  fixturePath?: string;
  cacheRoot?: string;
}): Promise<SampleRepoMaterialization> {
  const fixturePath = options?.fixturePath ?? DEFAULT_FIXTURE;
  const cacheRoot = options?.cacheRoot ?? DEFAULT_CACHE_ROOT;
  const baseDir =
    options?.baseDir ?? (await mktempDir(join(process.cwd(), ".tmp"), "sample-repo-"));

  const { cacheDir, isHit } = await resolveFixtureCache({ fixturePath, cacheRoot });

  if (!isHit) {
    await ensureSampleRepoCache({ cacheDir, cacheRoot, fixturePath });
  }
  await copyDir(cacheDir, baseDir);

  const workspacePaths: Record<string, string> = { default: join(baseDir, "repo") };
  try {
    const entries = await readdir(baseDir);
    for (const entry of entries) {
      if (entry !== "repo") {
        workspacePaths[entry.replace(/-workspace$/, "")] = join(baseDir, entry);
      }
    }
  } catch {
    // Only the default workspace
  }

  return {
    repoPath: join(baseDir, "repo"),
    workspacePaths: Object.freeze(workspacePaths),
  };
}

async function ensureSampleRepoCache(options: {
  cacheDir: string;
  cacheRoot: string;
  fixturePath: string;
}): Promise<void> {
  const { cacheDir, cacheRoot, fixturePath } = options;
  await mkdir(cacheRoot, { recursive: true });

  const cacheName = basename(cacheDir);
  const lockDir = join(cacheRoot, `.${cacheName}.lock`);
  const deadline = Date.now() + CACHE_WAIT_TIMEOUT_MS;

  while (true) {
    if (await dirExists(cacheDir)) {
      return;
    }

    if (await tryCreateLockDir(lockDir)) {
      break;
    }

    await waitForCacheOrUnlocked(cacheDir, lockDir, deadline);
  }

  const buildDir = await mktempDir(cacheRoot, `.${cacheName}.building-`);
  try {
    await materializeSampleRepo({ baseDir: buildDir, fixturePath });
    try {
      await rename(buildDir, cacheDir);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
    }
  } finally {
    await rm(lockDir, { recursive: true, force: true });
    await rm(buildDir, { recursive: true, force: true });
  }
}

async function loadOperations(path: string): Promise<readonly JsonlOperation[]> {
  const content = await readFile(path, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as JsonlOperation);
}

async function mktempDir(parentDir: string, prefix: string): Promise<string> {
  await mkdir(parentDir, { recursive: true });
  return await Bun.$`mktemp -d ${join(parentDir, `${prefix}XXXXXX`)}`.text().then((value) => value.trim());
}

async function tryCreateLockDir(lockDir: string): Promise<boolean> {
  try {
    await mkdir(lockDir);
    return true;
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return false;
    }
    throw error;
  }
}

async function waitForCacheOrUnlocked(
  cacheDir: string,
  lockDir: string,
  deadline: number,
): Promise<void> {
  while (Date.now() < deadline) {
    if (await dirExists(cacheDir)) {
      return;
    }
    if (!(await dirExists(lockDir))) {
      return;
    }
    await sleep(CACHE_WAIT_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for sample repo cache: ${cacheDir}`);
}

async function dirExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}
