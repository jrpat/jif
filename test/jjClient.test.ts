import { expect, test } from "bun:test";
import { join } from "node:path";
import { materializeSampleRepo } from "../src/dev/sampleRepo.ts";
import { JjClient, parseLogOutput, tokenizeCommandText } from "../src/jj/client.ts";
import { runCommand } from "../src/jj/process.ts";
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

test("parseLogOutput preserves hybrid graph rows in emission order", () => {
  const output = [
    "@  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001ffirst\u001fmain\u001fabc\u001ffalse\u001f2026-03-30 07:22:39\u001ffalse",
    "│\u001fbody\u001fabcdefgh",
    "|",
    "○  bcdefghi\u001fheader\u001fbcdefghi\u001f22222222\u001fsecond\u001f\u001fbcd\u001ffalse\u001f2026-03-29 03:05:01\u001ffalse",
    "│\u001fbody\u001fbcdefghi",
  ].join("\n");

  const revisions = parseLogOutput(output, new Map());
  expect(revisions).toHaveLength(2);
  expect(revisions[0]?.graphRows).toEqual(["@  ", "│", "|"]);
  expect(revisions[0]?.bookmarks).toEqual(["main"]);
  expect(revisions[0]?.changeIdPrefixLength).toBe(3);
  expect(revisions[0]?.isEmpty).toBeFalse();
  expect(revisions[0]?.hasConflict).toBeFalse();
  expect(revisions[0]?.filesLoaded).toBeFalse();
  expect(revisions[0]?.localTimestamp).toBe("2026-03-30 07:22:39");
  expect(revisions[1]?.graphRows).toEqual(["○  ", "│"]);
  expect(revisions[1]?.changeIdPrefixLength).toBe(3);
  expect(revisions[1]?.hasConflict).toBeFalse();
});

test("parseLogOutput uses both empty and no description markers for blank empty revisions", () => {
  const output = [
    "@  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001f\u001f\u001fabc\u001ftrue\u001f2026-03-30 07:22:39\u001ffalse",
    "│\u001fbody\u001fabcdefgh",
  ].join("\n");

  const revisions = parseLogOutput(output, new Map());

  expect(revisions).toHaveLength(1);
  expect(revisions[0]?.description).toBe("(empty) (no description)");
  expect(revisions[0]?.isEmpty).toBeTrue();
  expect(revisions[0]?.filesLoaded).toBeTrue();
  expect(revisions[0]?.graphRows).toEqual(["@  ", "│"]);
});

test("parseLogOutput keeps (no description) for blank descriptions on non-empty revisions", () => {
  const output = [
    "@  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001f\u001f\u001fabc\u001ffalse\u001f2026-03-30 07:22:39\u001ffalse",
    "│\u001fbody\u001fabcdefgh",
  ].join("\n");

  const revisions = parseLogOutput(output, new Map());

  expect(revisions).toHaveLength(1);
  expect(revisions[0]?.description).toBe("(no description)");
  expect(revisions[0]?.isEmpty).toBeFalse();
  expect(revisions[0]?.filesLoaded).toBeFalse();
});

test("parseLogOutput tolerates missing timestamp fields", () => {
  const output = [
    "@  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001ffirst\u001f\u001fabc\u001ffalse\u001f\u001ffalse",
    "│\u001fbody\u001fabcdefgh",
  ].join("\n");

  const revisions = parseLogOutput(output, new Map());

  expect(revisions).toHaveLength(1);
  expect(revisions[0]?.localTimestamp).toBe("");
});

test("parseLogOutput creates a synthetic elided revision", () => {
  const output = [
    "◆  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001fsome commit\u001f\u001fab\u001ffalse\u001f2026-03-30 07:22:39\u001ffalse",
    "│\u001fbody\u001fabcdefgh",
    "~  (elided revisions)",
  ].join("\n");

  const revisions = parseLogOutput(output, new Map());
  expect(revisions).toHaveLength(2);
  expect(revisions[0]?.graphRows).toEqual(["◆  ", "│"]);
  expect(revisions[1]?.marker).toBe("elided");
  expect(revisions[1]?.description).toBe("(elided revisions)");
  expect(revisions[1]?.graphRows).toEqual(["~  "]);
  expect(revisions[1]?.changeId).toBe("__elided_1");
  expect(revisions[1]?.filesLoaded).toBeTrue();
  expect(revisions[1]?.localTimestamp).toBe("");
});

test("parseLogOutput sets hasConflict for conflicted revisions", () => {
  const output = [
    "×  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001fmerge feature\u001f\u001fabc\u001ffalse\u001f2026-03-30 07:22:39\u001ftrue",
    "│\u001fbody\u001fabcdefgh",
    "○  bcdefghi\u001fheader\u001fbcdefghi\u001f22222222\u001fclean commit\u001f\u001fbcd\u001ffalse\u001f2026-03-29 03:05:01\u001ffalse",
    "│\u001fbody\u001fbcdefghi",
  ].join("\n");

  const revisions = parseLogOutput(output, new Map());
  expect(revisions).toHaveLength(2);
  expect(revisions[0]?.hasConflict).toBeTrue();
  expect(revisions[0]?.marker).toBe("working-copy");
  expect(revisions[1]?.hasConflict).toBeFalse();
});

test("parseLogOutput defaults hasConflict to false when field is missing", () => {
  const output = [
    "@  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001ffirst\u001f\u001fabc\u001ffalse\u001f2026-03-30 07:22:39",
    "│\u001fbody\u001fabcdefgh",
  ].join("\n");

  const revisions = parseLogOutput(output, new Map());
  expect(revisions[0]?.hasConflict).toBeFalse();
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

test("JjClient marks a real empty revision without loading changed files", async () => {
  const repo = await materializeSampleRepo({
    baseDir: await createTempDir("client-empty-revision"),
  });
  await runCommand(repo.repoPath, ["jj", "new", "-m", ""]);

  const client = new JjClient(repo.repoPath);
  const repository = await client.loadRepository(10);
  const workingCopy = repository.revisions[0];

  expect(workingCopy?.isEmpty).toBeTrue();
  expect(workingCopy?.description).toBe("(empty) (no description)");
  expect(workingCopy?.files).toEqual([]);
  expect(workingCopy?.filesLoaded).toBeTrue();
}, 20000);

test("JjClient resolves the actual workspace root from nested paths", async () => {
  const repo = await materializeSampleRepo({
    baseDir: await createTempDir("client-workspace-root"),
  });
  const client = new JjClient(join(repo.repoPath, "src"));

  expect(await client.loadWorkspaceRoot()).toBe(repo.repoPath);
}, 20000);
