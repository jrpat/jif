import { expect, test } from "bun:test";

test("CommandPrompt preserves cursor position when editing mid-text after history navigation", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderCommandPromptCursor.tsx"],
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
    afterUp: { plainText: string; cursorOffset: number };
    afterLeft: { plainText: string; cursorOffset: number };
    afterBackspace: { plainText: string; cursorOffset: number };
    afterType: { plainText: string; cursorOffset: number };
  };

  expect(result.afterUp).toEqual({ plainText: "zzalpha", cursorOffset: 7 });
  expect(result.afterLeft).toEqual({ plainText: "zzalpha", cursorOffset: 5 });
  expect(result.afterBackspace).toEqual({ plainText: "zzalha", cursorOffset: 4 });
  expect(result.afterType).toEqual({ plainText: "zzalXha", cursorOffset: 5 });
}, 20000);
