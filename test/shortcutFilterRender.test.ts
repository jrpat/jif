import { expect, test } from "bun:test";

test("shortcut filter replaces the header, removes nonmatches, and stays visible after apply", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderShortcutFilter.tsx"],
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
    initialFrame: string;
    filteredFrame: string;
    appliedFrame: string;
    matchingPresent: boolean;
    nonmatchingPresent: boolean;
    questionQuery: string;
    query: string;
    editing: boolean;
    inputFocused: boolean;
  };

  expect(result.initialFrame).toContain("Type to filter");
  expect(result.initialFrame).not.toContain("Shortcuts Revisions");
  expect(result.questionQuery).toBe("?");
  expect(result.filteredFrame).toContain("repo");
  expect(result.filteredFrame).toContain("Refresh Repository");
  expect(result.filteredFrame).not.toContain("Squash Revision");
  expect(result.matchingPresent).toBeTrue();
  expect(result.nonmatchingPresent).toBeFalse();

  expect(result.appliedFrame).toContain("repo");
  expect(result.query).toBe("repo");
  expect(result.editing).toBeFalse();
  expect(result.inputFocused).toBeFalse();
});
