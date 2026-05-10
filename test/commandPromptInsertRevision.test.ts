import { expect, test } from "bun:test";

test("CommandPrompt inserts the focused revision's shortest unique prefix at the cursor on ctrl+'", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderCommandPromptInsertRev.tsx"],
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

  type Case = {
    afterFirstInsert: { plainText: string; cursorOffset: number };
    afterMidInsert: { plainText: string; cursorOffset: number };
    storeText: string;
  };
  const result = JSON.parse(stdout) as { jj: Case; shell: Case };

  const expected: Case = {
    afterFirstInsert: { plainText: "rebase -d bbbb", cursorOffset: 14 },
    afterMidInsert: { plainText: "rebase -d bbbbbbbb", cursorOffset: 14 },
    storeText: "rebase -d bbbbbbbb",
  };
  expect(result.jj).toEqual(expected);
  expect(result.shell).toEqual(expected);
}, 20000);
