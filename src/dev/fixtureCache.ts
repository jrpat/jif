import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";

export async function resolveFixtureCache(options: {
  fixturePath: string;
  cacheRoot: string;
}): Promise<{ cacheDir: string; isHit: boolean }> {
  const { fixturePath, cacheRoot } = options;
  const hash = await computeFixtureHash(fixturePath);
  const stem = basename(fixturePath, ".jsonl");
  const cacheDir = join(cacheRoot, `${stem}-${hash}`);

  const isHit = await dirExists(cacheDir);
  if (isHit) {
    await cleanStaleEntries(cacheRoot, stem, hash);
  }

  return { cacheDir, isHit };
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await Bun.$`cp -r ${src} ${dest}`.quiet();
}

export async function computeFixtureHash(fixturePath: string): Promise<string> {
  const content = await Bun.file(fixturePath).arrayBuffer();
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex").slice(0, 16);
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
