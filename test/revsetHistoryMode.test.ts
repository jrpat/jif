import { expect, test } from "bun:test";

// ctrl+l toggles the revset prompt between revset-function completions and the
// repo's revset history. The double border is reserved for complete-at-point
// (the completions view); history uses the default single border. The active
// revset is hidden from the list, the most recent entry (bottom) is pre-focused,
// and selecting an entry replaces the whole input.
test("ctrl+l shows the revset history with a single border, the current revset hidden, and the bottom entry focused", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderRevsetHistoryMode.tsx"],
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
    toggles: {
      beforeToggleList: string;
      beforeTogglePrompt: string;
      beforeToggleDoubleBorder: boolean;
      afterToggleList: string;
      afterTogglePrompt: string;
      afterToggleDoubleBorder: boolean;
      secondPrompt: string;
      afterUntoggleList: string;
      afterUntogglePrompt: string;
      afterUntoggleDoubleBorder: boolean;
    };
    noopWhenEmpty: {
      before: { list: string; doubleBorder: boolean };
      after: { list: string; doubleBorder: boolean };
    };
  };

  const t = result.toggles;

  // Pre-filled "main" shows revset completions (the matching bookmark), not
  // history. Completion is complete-at-point, so it carries the double border.
  expect(t.beforeTogglePrompt).toContain("main");
  expect(t.beforeToggleList).toContain("mainline");
  expect(t.beforeToggleList).not.toContain("alpha()");
  expect(t.beforeToggleDoubleBorder).toBeTrue();

  // ctrl+l switches to history (single border); the active revset "main" is omitted.
  expect(t.afterToggleDoubleBorder).toBeFalse();
  expect(t.afterToggleList).toContain("alpha()");
  expect(t.afterToggleList).toContain("beta()");
  expect(t.afterToggleList).not.toContain("mainline");

  // The most recent entry (bottom = "alpha()") is pre-focused, replacing the input.
  expect(t.afterTogglePrompt).toContain("alpha()");

  // Moving up advances to the next entry.
  expect(t.secondPrompt).toContain("beta()");
  expect(t.secondPrompt).not.toContain("alpha()");

  // ctrl+l again returns to completions (double border) and restores the text.
  expect(t.afterUntoggleDoubleBorder).toBeTrue();
  expect(t.afterUntoggleList).toContain("mainline");
  expect(t.afterUntogglePrompt).toContain("main");

  // With no history entries, ctrl+l is a silent no-op: still completions, still
  // the double border.
  expect(result.noopWhenEmpty.before.doubleBorder).toBeTrue();
  expect(result.noopWhenEmpty.after.doubleBorder).toBeTrue();
  expect(result.noopWhenEmpty.after.list).toContain("mainline");
}, 20000);
