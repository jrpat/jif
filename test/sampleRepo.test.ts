import { expect, test } from "bun:test";
import { materializeSampleRepo } from "../src/dev/sampleRepo.ts";
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
