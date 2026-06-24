import { describe, expect, test } from "bun:test";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTempDir } from "./helpers/tempRepo.ts";
import {
  resolveFixtureCache,
  copyDir,
  computeFixtureHash,
  resolveCopyDirCommands,
} from "../src/dev/fixtureCache.ts";
import { materializeSampleRepoCached } from "../src/dev/sampleRepo.ts";
import { runCommand } from "../src/jj/process.ts";

describe("computeFixtureHash", () => {
  test("returns a 16-character hex string", async () => {
    const dir = await createTempDir("hash-test");
    const fixturePath = join(dir, "fixture.jsonl");
    await writeFile(fixturePath, '{"kind":"mkdir","path":"src"}\n', "utf8");

    const hash = await computeFixtureHash(fixturePath);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  test("same content produces same hash", async () => {
    const dir = await createTempDir("hash-stable");
    const a = join(dir, "a.jsonl");
    const b = join(dir, "b.jsonl");
    const content = '{"kind":"mkdir","path":"src"}\n';
    await writeFile(a, content, "utf8");
    await writeFile(b, content, "utf8");

    expect(await computeFixtureHash(a)).toBe(await computeFixtureHash(b));
  });

  test("different content produces different hash", async () => {
    const dir = await createTempDir("hash-diff");
    const a = join(dir, "a.jsonl");
    const b = join(dir, "b.jsonl");
    await writeFile(a, '{"kind":"mkdir","path":"src"}\n', "utf8");
    await writeFile(b, '{"kind":"mkdir","path":"test"}\n', "utf8");

    expect(await computeFixtureHash(a)).not.toBe(await computeFixtureHash(b));
  });

  test("cache key parts contribute to the hash", async () => {
    const dir = await createTempDir("hash-key-parts");
    const fixturePath = join(dir, "fixture.jsonl");
    await writeFile(fixturePath, '{"kind":"mkdir","path":"src"}\n', "utf8");

    expect(await computeFixtureHash(fixturePath, ["jj 0.1.0"])).not.toBe(
      await computeFixtureHash(fixturePath, ["jj 0.2.0"]),
    );
  });
});

describe("resolveFixtureCache", () => {
  test("reports cache miss when no cache exists", async () => {
    const dir = await createTempDir("cache-miss");
    const fixturePath = join(dir, "fixture.jsonl");
    await writeFile(fixturePath, '{"kind":"mkdir","path":"src"}\n', "utf8");

    const result = await resolveFixtureCache({
      fixturePath,
      cacheRoot: join(dir, "cache"),
      jjVersion: "jj 0.1.0",
    });

    expect(result.isHit).toBe(false);
    expect(result.cacheDir).toContain("fixture-");
  });

  test("reports cache hit when cache dir exists", async () => {
    const dir = await createTempDir("cache-hit");
    const fixturePath = join(dir, "fixture.jsonl");
    await writeFile(fixturePath, '{"kind":"mkdir","path":"src"}\n', "utf8");

    const cacheRoot = join(dir, "cache");
    const first = await resolveFixtureCache({ fixturePath, cacheRoot, jjVersion: "jj 0.1.0" });
    await mkdir(first.cacheDir, { recursive: true });

    const second = await resolveFixtureCache({ fixturePath, cacheRoot, jjVersion: "jj 0.1.0" });
    expect(second.isHit).toBe(true);
    expect(second.cacheDir).toBe(first.cacheDir);
  });

  test("includes jj version in the cache directory", async () => {
    const dir = await createTempDir("cache-jj-version");
    const fixturePath = join(dir, "fixture.jsonl");
    const cacheRoot = join(dir, "cache");
    await writeFile(fixturePath, '{"kind":"mkdir","path":"src"}\n', "utf8");

    const first = await resolveFixtureCache({ fixturePath, cacheRoot, jjVersion: "jj 0.1.0" });
    const second = await resolveFixtureCache({ fixturePath, cacheRoot, jjVersion: "jj 0.2.0" });

    expect(first.cacheDir).not.toBe(second.cacheDir);
    expect(first.cacheDir).toMatch(/fixture-[0-9a-f]{16}$/);
  });

  test("cleans stale entries on cache hit", async () => {
    const dir = await createTempDir("cache-stale");
    const fixturePath = join(dir, "fixture.jsonl");
    const cacheRoot = join(dir, "cache");

    await writeFile(fixturePath, '{"kind":"mkdir","path":"src"}\n', "utf8");
    const old = await resolveFixtureCache({ fixturePath, cacheRoot, jjVersion: "jj 0.1.0" });
    await mkdir(old.cacheDir, { recursive: true });

    // Create a stale entry with the same stem but different hash
    const staleDir = join(cacheRoot, "fixture-0000000000000000");
    await mkdir(staleDir, { recursive: true });

    // Update fixture so the hash changes
    await writeFile(fixturePath, '{"kind":"mkdir","path":"test"}\n', "utf8");
    const fresh = await resolveFixtureCache({ fixturePath, cacheRoot, jjVersion: "jj 0.1.0" });
    await mkdir(fresh.cacheDir, { recursive: true });

    // Trigger cleanup by hitting the new cache
    await resolveFixtureCache({ fixturePath, cacheRoot, jjVersion: "jj 0.1.0" });

    const entries = await readdir(cacheRoot);
    const staleEntries = entries.filter(
      (e) => e.startsWith("fixture-") && e !== fresh.cacheDir.split("/").pop(),
    );
    expect(staleEntries).toHaveLength(0);
  });
});

describe("copyDir", () => {
  test("prefers copy-on-write clone commands when the platform supports them", () => {
    expect(resolveCopyDirCommands("darwin")[0]).toEqual(["cp", "-cR"]);
    expect(resolveCopyDirCommands("linux")[0]).toEqual(["cp", "-a", "--reflink=auto"]);
  });

  test("copies directory contents to new location", async () => {
    const dir = await createTempDir("copy-test");
    const src = join(dir, "src");
    const dest = join(dir, "dest");
    await mkdir(join(src, "sub"), { recursive: true });
    await writeFile(join(src, "sub", "file.txt"), "hello", "utf8");

    await copyDir(src, dest);

    const content = await Bun.file(join(dest, "sub", "file.txt")).text();
    expect(content).toBe("hello");
  });
});

describe("materializeSampleRepoCached", () => {
  test("materializes and caches on first call, copies on second", async () => {
    const dir = await createTempDir("cached-e2e");
    const fixturePath = join(dir, "tiny-sample.jsonl");
    const cacheRoot = join(dir, "cache");
    const baseDir1 = join(dir, "run1");
    const baseDir2 = join(dir, "run2");
    await writeTinySampleFixture(fixturePath);

    const t0 = performance.now();
    const first = await materializeSampleRepoCached({
      baseDir: baseDir1,
      fixturePath,
      cacheRoot,
    });
    const firstDuration = performance.now() - t0;

    expect(first.repoPath).toBe(join(baseDir1, "repo"));

    // Cache dir should exist now
    const cacheEntries = await readdir(cacheRoot);
    expect(cacheEntries.length).toBe(1);
    expect(cacheEntries[0]).toMatch(/^tiny-sample-[0-9a-f]{16}$/);

    const t1 = performance.now();
    const second = await materializeSampleRepoCached({
      baseDir: baseDir2,
      fixturePath,
      cacheRoot,
    });
    const secondDuration = performance.now() - t1;

    expect(second.repoPath).toBe(join(baseDir2, "repo"));

    // Cached run should be significantly faster
    expect(secondDuration).toBeLessThan(firstDuration * 0.5);

    // Both should produce the same valid jj repo contents.
    const [firstLog, secondLog] = await Promise.all([
      runCommand(first.repoPath, ["jj", "log", "--no-pager", "--limit", "10"]),
      runCommand(second.repoPath, ["jj", "log", "--no-pager", "--limit", "10"]),
    ]);
    expect(secondLog.stdout.trim().length).toBeGreaterThan(0);
    expect(secondLog.stdout).toBe(firstLog.stdout);
  }, 30_000);

  test("serializes concurrent cold cache population", async () => {
    const dir = await createTempDir("cached-concurrent");
    const fixturePath = join(dir, "tiny-sample.jsonl");
    const cacheRoot = join(dir, "cache");
    await writeTinySampleFixture(fixturePath);

    const [first, second] = await Promise.all([
      materializeSampleRepoCached({
        baseDir: join(dir, "run1"),
        fixturePath,
        cacheRoot,
      }),
      materializeSampleRepoCached({
        baseDir: join(dir, "run2"),
        fixturePath,
        cacheRoot,
      }),
    ]);

    const cacheEntries = (await readdir(cacheRoot)).filter((entry) => !entry.startsWith("."));
    expect(cacheEntries).toHaveLength(1);
    expect((await readdir(join(cacheRoot, cacheEntries[0]!))).sort()).toEqual(["repo"]);

    const [firstLog, secondLog] = await Promise.all([
      runCommand(first.repoPath, ["jj", "log", "--no-pager", "--limit", "10"]),
      runCommand(second.repoPath, ["jj", "log", "--no-pager", "--limit", "10"]),
    ]);
    expect(secondLog.stdout).toBe(firstLog.stdout);
  }, 30_000);
});

async function writeTinySampleFixture(fixturePath: string): Promise<void> {
  await writeFile(
    fixturePath,
    [
      JSON.stringify({
        kind: "writeFile",
        path: "README.md",
        content: "# Tiny Fixture\n",
      }),
      JSON.stringify({
        kind: "jj",
        args: ["describe", "-m", "init: tiny fixture"],
      }),
      JSON.stringify({
        kind: "jj",
        args: ["bookmark", "create", "main"],
      }),
      "",
    ].join("\n"),
    "utf8",
  );
}
