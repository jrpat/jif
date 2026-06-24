import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { runCommand } from "../jj/process.ts";

let jjVersionPromise: Promise<string> | undefined;

export async function resolveFixtureCache(options: {
  fixturePath: string;
  cacheRoot: string;
  jjVersion?: string;
}): Promise<{ cacheDir: string; isHit: boolean }> {
  const { fixturePath, cacheRoot } = options;
  const jjVersion = options.jjVersion ?? await loadJjVersion();
  const hash = await computeFixtureHash(fixturePath, [`jj:${jjVersion}`]);
  const stem = basename(fixturePath, ".jsonl");
  const cacheDir = join(cacheRoot, `${stem}-${hash}`);

  const isHit = await dirExists(cacheDir);
  if (isHit) {
    await cleanStaleEntries(cacheRoot, stem, hash);
  }

  return { cacheDir, isHit };
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const copySource = src.endsWith("/") ? `${src}.` : `${src}/.`;
  let lastError: unknown;
  for (const command of resolveCopyDirCommands()) {
    try {
      await runCopyCommand(command, copySource, dest);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function resolveCopyDirCommands(
  platform: NodeJS.Platform = process.platform,
): readonly (readonly string[])[] {
  if (platform === "darwin") {
    return [
      ["cp", "-cR"],
      ["cp", "-R"],
    ];
  }

  if (platform === "linux") {
    return [
      ["cp", "-a", "--reflink=auto"],
      ["cp", "-a"],
      ["cp", "-R"],
    ];
  }

  return [["cp", "-R"]];
}

export async function computeFixtureHash(
  fixturePath: string,
  cacheKeyParts: readonly string[] = [],
): Promise<string> {
  const content = await Bun.file(fixturePath).arrayBuffer();
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  for (const part of cacheKeyParts) {
    hasher.update("\0");
    hasher.update(part);
  }
  return hasher.digest("hex").slice(0, 16);
}

async function loadJjVersion(): Promise<string> {
  jjVersionPromise ??= readJjVersion();
  return await jjVersionPromise;
}

async function readJjVersion(): Promise<string> {
  const result = await runCommand(process.cwd(), ["jj", "--version"]);
  return result.stdout.trim() || result.stderr.trim();
}

async function runCopyCommand(
  command: readonly string[],
  src: string,
  dest: string,
): Promise<void> {
  const proc = Bun.spawn({
    cmd: [...command, src, dest],
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (exitCode !== 0) {
    const attemptedCommand = [...command, src, dest].join(" ");
    throw new Error(
      `Copy failed (${exitCode}): ${attemptedCommand}\n${stderr || stdout}`.trim(),
    );
  }
}

async function cleanStaleEntries(
  cacheRoot: string,
  stem: string,
  currentHash: string,
): Promise<void> {
  const prefix = `${stem}-`;
  const currentName = `${stem}-${currentHash}`;

  let entries: string[];
  try {
    entries = await readdir(cacheRoot);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.startsWith(prefix) && entry !== currentName) {
      await rm(join(cacheRoot, entry), { recursive: true, force: true });
    }
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
