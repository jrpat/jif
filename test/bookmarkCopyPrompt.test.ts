import { expect, test } from "bun:test";

test("the bookmark copy prompt opens the shell bar with the name slot focused", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderBookmarkCopyPrompt.tsx"],
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
    initial: { plainText: string; cursorOffset: number };
    listsBothBookmarks: boolean;
    listsHistory: boolean;
    filtered: { showsRelease: boolean; showsMain: boolean };
    accepted: { plainText: string; cursorOffset: number };
  };

  expect(result.initial).toEqual({
    plainText: "printf %s  | pbcopy",
    cursorOffset: "printf %s ".length,
  });
  expect(result.listsBothBookmarks).toBeTrue();
  expect(result.listsHistory).toBeFalse();
  expect(result.filtered).toEqual({ showsRelease: true, showsMain: false });
  expect(result.accepted).toEqual({
    plainText: "printf %s release | pbcopy",
    cursorOffset: "printf %s release".length,
  });
}, 20000);
