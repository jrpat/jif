import { expect, test } from "bun:test";

// Regression test: the full-screen search highlight layer is a sibling of the
// log scrollbox, so it sits above it in the mouse hit grid. Without forwarding,
// it swallows wheel events and the log can no longer be scrolled with the mouse
// while search results are displayed.
test("mouse wheel scrolls the log while search highlights are visible", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "--preload", "@opentui/solid/preload", "test/helpers/renderSearchScroll.tsx"],
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
    hasHighlights: boolean;
    maxScroll: number;
    before: number;
    after: number;
  };

  // Preconditions: the overlay is actually mounted and there is room to scroll.
  expect(result.hasHighlights).toBeTrue();
  expect(result.maxScroll).toBeGreaterThan(0);

  // The wheel must move the viewport.
  expect(result.before).toBe(0);
  expect(result.after).toBeGreaterThan(0);
});
