import { expect, test } from "bun:test";
import { join } from "node:path";
import { materializeSampleRepo } from "../src/dev/sampleRepo.ts";
import { JjClient, parseLogOutput, tokenizeCommandText } from "../src/jj/client.ts";
import { createTempDir } from "./helpers/tempRepo.ts";

test("tokenizeCommandText keeps quoted segments together", () => {
  expect(tokenizeCommandText('rebase -r abc123 -o "bookmark main"')).toEqual([
    "rebase",
    "-r",
    "abc123",
    "-o",
    "bookmark main",
  ]);
});

test("parseLogOutput groups graph continuation lines", () => {
  const output = [
    "@  abcdefgh\u001f11111111\u001ffirst\u001fmain\u001fabc\u001f",
    "|",
    "○  bcdefghi\u001f22222222\u001fsecond\u001f\u001fbcd\u001f",
  ].join("\n");

  const revisions = parseLogOutput(output, new Map());
  expect(revisions).toHaveLength(2);
  expect(revisions[0]?.graphTail).toEqual(["|"]);
  expect(revisions[0]?.bookmarks).toEqual(["main"]);
  expect(revisions[0]?.changeIdPrefixLength).toBe(3);
  expect(revisions[1]?.changeIdPrefixLength).toBe(3);
});

test("parseLogOutput creates a synthetic elided revision", () => {
  const output = [
    "◆  abcdefgh\u001f11111111\u001fsome commit\u001f\u001fab\u001f",
    "~  (elided revisions)",
  ].join("\n");

  const revisions = parseLogOutput(output, new Map());
  expect(revisions).toHaveLength(2);
  expect(revisions[0]?.graphTail).toEqual([]);
  expect(revisions[1]?.marker).toBe("elided");
  expect(revisions[1]?.description).toBe("(elided revisions)");
  expect(revisions[1]?.graphHead).toBe("~  ");
  expect(revisions[1]?.changeId).toBe("__elided_1");
});

test("JjClient loads a real sample repository", async () => {
  const repo = await materializeSampleRepo({
    baseDir: await createTempDir("client-sample"),
  });
  const client = new JjClient(repo.repoPath);

  const repository = await client.loadRepository(80);

  expect(repository.revisions.length).toBeGreaterThan(30);
  expect(repository.revisions.some((revision) => revision.bookmarks.length > 0)).toBeTrue();
  expect(repository.revisions.some((revision) => revision.workspaces.length > 0)).toBeTrue();

  const firstFiles = await client.loadChangedFiles(repository.revisions[0]!.changeId);
  expect(firstFiles.length).toBeGreaterThan(0);
}, 20000);

test("JjClient resolves the actual workspace root from nested paths", async () => {
  const repo = await materializeSampleRepo({
    baseDir: await createTempDir("client-workspace-root"),
  });
  const client = new JjClient(join(repo.repoPath, "src"));

  expect(await client.loadWorkspaceRoot()).toBe(repo.repoPath);
}, 20000);
