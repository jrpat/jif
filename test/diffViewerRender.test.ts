import { expect, test } from "bun:test";

test("DiffViewer renders lines correctly", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderDiffViewer.tsx"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    console.error(stderr);
  }

  expect(exitCode).toBe(0);
  expect(stderr).toBe("");

  const result = JSON.parse(stdout) as {
    lineCount: number;
    lines: string[];
    initialScrollLeft: number | null;
    afterHorizontalScrollLeft: number | null;
    horizontalScrollWidth: number | null;
    viewportWidth: number | null;
  };

  expect(result.lines[0]).toContain("line 1");
  expect(result.lines[1]).toContain("line 2");
  expect(result.lines[2]).toContain("line 3");
});

test("DiffViewer horizontally scrolls long lines", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderDiffViewer.tsx"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    console.error(stderr);
  }

  expect(exitCode).toBe(0);
  expect(stderr).toBe("");

  const result = JSON.parse(stdout) as {
    initialScrollLeft: number | null;
    afterHorizontalScrollLeft: number | null;
    horizontalScrollWidth: number | null;
    viewportWidth: number | null;
  };

  expect(result.initialScrollLeft).toBe(0);
  expect(result.horizontalScrollWidth).toBeGreaterThan(result.viewportWidth ?? 0);
  expect(result.afterHorizontalScrollLeft).toBeGreaterThan(0);
});
