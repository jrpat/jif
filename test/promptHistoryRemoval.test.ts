import { expect, test } from "bun:test";

test("ctrl+x removes the highlighted persistent suggestion but leaves immutable sources alone", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderPromptHistoryRemoval.tsx"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  expect(exitCode).toBe(0);
  expect(stderr).toBe("");

  type Case = { beforeRemove: string; afterRemove: string; removed: string[] };
  const result = JSON.parse(stdout) as {
    command: Case & { promptAfterRemove: string };
    bookmark: Case;
    revsetHistory: Case;
    revsetCompletion: Case;
  };

  expect(result.command.beforeRemove).toContain("zzgamma");
  expect(result.command.afterRemove).not.toContain("zzgamma");
  expect(result.command.afterRemove).toContain("zzalpha");
  expect(result.command.afterRemove).toContain("zzbeta");
  expect(result.command.removed).toEqual(["zzgamma"]);
  expect(result.command.promptAfterRemove).not.toContain("zzgamma");

  expect(result.bookmark.beforeRemove).toContain("feature-b");
  expect(result.bookmark.afterRemove).toContain("feature-b");
  expect(result.bookmark.removed).toEqual([]);

  expect(result.revsetHistory.beforeRemove).toContain("ccc()");
  expect(result.revsetHistory.afterRemove).not.toContain("ccc()");
  expect(result.revsetHistory.afterRemove).toContain("aaa()");
  expect(result.revsetHistory.afterRemove).toContain("bbb()");
  expect(result.revsetHistory.removed).toEqual(["ccc()"]);

  expect(result.revsetCompletion.beforeRemove).toContain("zzbookmark");
  expect(result.revsetCompletion.afterRemove).toContain("zzbookmark");
  expect(result.revsetCompletion.removed).toEqual([]);
}, 30000);
