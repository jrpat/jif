import { expect, test } from "bun:test";

test("search overlay highlights only matching visible substrings", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "--preload", "@opentui/solid/preload", "test/helpers/renderSearchHighlightOverlay.tsx"],
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

  const result = JSON.parse(stdout) as {
    description: { frame: string; highlightTexts: string[] };
    bookmark: { frame: string; highlightTexts: string[] };
    visibleRevisionId: { frame: string; highlightTexts: string[] };
    updatedQuery: { frame: string; highlightTexts: string[] };
    inactiveEmoji: string;
    operationLog: { frame: string; highlightTexts: string[] };
  };

  expect(result.description.frame).toContain("branch revision");
  expect(result.description.highlightTexts).toContain("anch");
  expect(result.description.highlightTexts).not.toContain("branch revision");

  expect(result.bookmark.frame).toContain("main");
  expect(result.bookmark.highlightTexts).toContain("ai");
  expect(result.bookmark.highlightTexts).not.toContain("main");

  expect(result.visibleRevisionId.frame).toContain("curr");
  expect(result.visibleRevisionId.highlightTexts).toContain("rr");

  expect(result.updatedQuery.highlightTexts).toContain("vision");
  expect(result.updatedQuery.highlightTexts).not.toContain("anch");

  expect(result.inactiveEmoji).toContain("🔒 StopStream cross-hatch");

  expect(result.operationLog.frame).toContain("args:");
  expect(result.operationLog.highlightTexts).toContain("args");
});
