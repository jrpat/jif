import { expect, test } from "bun:test";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveOpHeadsPath } from "../src/jj/opHeads.ts";
import { runCommand } from "../src/jj/process.ts";
import { createTempDir } from "./helpers/tempRepo.ts";

async function createFakeWorkspace(options: Readonly<{
  repoMarker: "directory" | { pointerContents: string };
  createHeadsDir?: boolean;
}>): Promise<{ workspaceRoot: string; repoDir: string }> {
  const workspaceRoot = await createTempDir("op-heads");
  const jjDir = join(workspaceRoot, ".jj");
  let repoDir: string;
  if (options.repoMarker === "directory") {
    repoDir = join(jjDir, "repo");
    await mkdir(repoDir, { recursive: true });
  } else {
    repoDir = join(workspaceRoot, "main-repo");
    await mkdir(jjDir, { recursive: true });
    await mkdir(repoDir, { recursive: true });
    await writeFile(join(jjDir, "repo"), options.repoMarker.pointerContents);
  }
  if (options.createHeadsDir !== false) {
    await mkdir(join(repoDir, "op_heads", "heads"), { recursive: true });
  }
  return { workspaceRoot, repoDir };
}

test("resolveOpHeadsPath finds the heads directory in a primary workspace", async () => {
  const { workspaceRoot, repoDir } = await createFakeWorkspace({ repoMarker: "directory" });

  expect(await resolveOpHeadsPath(workspaceRoot)).toBe(join(repoDir, "op_heads", "heads"));
});

test("resolveOpHeadsPath follows an absolute repo pointer file", async () => {
  const first = await createFakeWorkspace({ repoMarker: "directory" });
  const pointerWorkspace = await createFakeWorkspace({
    repoMarker: { pointerContents: `${join(first.workspaceRoot, ".jj", "repo")}\n` },
    createHeadsDir: false,
  });

  expect(await resolveOpHeadsPath(pointerWorkspace.workspaceRoot)).toBe(
    join(first.repoDir, "op_heads", "heads"),
  );
});

test("resolveOpHeadsPath resolves a relative repo pointer against the .jj directory", async () => {
  const { workspaceRoot, repoDir } = await createFakeWorkspace({
    repoMarker: { pointerContents: "../main-repo" },
  });

  expect(await resolveOpHeadsPath(workspaceRoot)).toBe(join(repoDir, "op_heads", "heads"));
});

test("resolveOpHeadsPath returns null when the workspace is not a jj repo", async () => {
  const dir = await createTempDir("op-heads-plain");

  expect(await resolveOpHeadsPath(dir)).toBeNull();
});

test("resolveOpHeadsPath returns null when the heads directory is missing", async () => {
  const { workspaceRoot } = await createFakeWorkspace({
    repoMarker: "directory",
    createHeadsDir: false,
  });

  expect(await resolveOpHeadsPath(workspaceRoot)).toBeNull();
});

test("op head files change when a jj operation runs in a real repo", async () => {
  const repoPath = await createTempDir("op-heads-real");
  await runCommand(repoPath, ["jj", "git", "init"]);

  const opHeadsPath = await resolveOpHeadsPath(repoPath);
  expect(opHeadsPath).not.toBeNull();

  const headsBefore = await readdir(opHeadsPath!);
  expect(headsBefore.length).toBeGreaterThan(0);

  await runCommand(repoPath, ["jj", "new", "-m", "op heads watch probe"]);

  const headsAfter = await readdir(opHeadsPath!);
  expect(headsAfter).not.toEqual(headsBefore);
});
