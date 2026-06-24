import { expect, test } from "bun:test";
import { materializeSampleRepo, materializeSampleRepoCached } from "../src/dev/sampleRepo.ts";
import { JjClient } from "../src/jj/client.ts";
import { runCommand } from "../src/jj/process.ts";
import { createTempDir } from "./helpers/tempRepo.ts";

test("sample repo materialization creates bookmarks and workspaces", async () => {
  const repo = await materializeSampleRepo({
    baseDir: await createTempDir("materialize-sample"),
  });

  const workspaceList = await runCommand(repo.repoPath, [
    "jj",
    "workspace",
    "list",
    "--color",
    "never",
  ]);
  const bookmarkList = await runCommand(repo.repoPath, [
    "jj",
    "bookmark",
    "list",
    "--color",
    "never",
  ]);

  expect(workspaceList.stdout).toContain("default:");
  expect(workspaceList.stdout).toContain("review:");
  expect(bookmarkList.stdout).toContain("main");
  expect(bookmarkList.stdout).toContain("feature/ui");
}, 20000);

test("sample repo includes a simple side branch after the integration fixture commit", async () => {
  const repo = await materializeSampleRepoCached({
    baseDir: await createTempDir("materialize-sample-branch"),
  });
  const client = new JjClient(repo.repoPath);

  const repository = await client.loadRepository(12);
  const simpleBranchSeed = repository.revisions.find((revision) =>
    revision.description === "docs(sample): seed compact branch fixture"
  );

  expect(repository.revisions.some((revision) =>
    revision.description === "docs(sample): keep a simple branch near the top"
  )).toBeTrue();
  expect(repository.revisions.some((revision) =>
    revision.bookmarks.includes("sample/compact-branch")
  )).toBeTrue();
  expect(simpleBranchSeed).toBeDefined();
  expect(simpleBranchSeed?.graphRows[0]?.trimEnd()).toBe("│ ○");
  expect(simpleBranchSeed?.graphRows[1]?.trimEnd()).toBe("├─╯");
}, 20000);
