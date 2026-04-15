import { expect, test } from "bun:test";

test("condensed branch elbow rows keep gutter dividers aligned with focused and unfocused borders", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderRevisionStack.tsx"],
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

  const { unfocused, focused } = JSON.parse(stdout) as {
    unfocused: string;
    focused: string;
  };

  expect(unfocused).toContain("│ │ └");
  expect(unfocused).toContain("├─╯");
  expect(focused).toContain("│ │ ┌");
  expect(focused).toContain("│ │ └");
  expect(focused).toContain("├─╯");
}, 20000);
