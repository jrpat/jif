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

  const {
    condensedUnfocused,
    condensedFocused,
    superCondensed,
    superCondensedExpanded,
    cycledToSuperCondensed,
    longSuperCondensed,
  } = JSON.parse(stdout) as {
    condensedUnfocused: string;
    condensedFocused: string;
    superCondensed: string;
    superCondensedExpanded: string;
    cycledToSuperCondensed: string;
    longSuperCondensed: string;
  };

  expect(condensedUnfocused).toContain("│ │ └");
  expect(condensedUnfocused).toContain("├─╯");
  expect(condensedFocused).toContain("│ │ ┌");
  expect(condensedFocused).toContain("│ │ └");
  expect(condensedFocused).toContain("├─╯");

  expect(superCondensed).toContain("├─╯");
  expect(superCondensed).not.toContain("┌");
  expect(superCondensed).not.toContain("┐");
  expect(superCondensed).not.toContain("└");
  expect(superCondensed).not.toContain("┘");
  expect(superCondensed).not.toContain("─┤");

  expect(superCondensedExpanded).toContain("src/layout.ts");
  expect(superCondensedExpanded).not.toContain("┌");
  expect(superCondensedExpanded).not.toContain("┐");
  expect(cycledToSuperCondensed).toContain("├─╯");
  expect(cycledToSuperCondensed).not.toContain("┌");
  expect(cycledToSuperCondensed).not.toContain("┐");
  const longSuperCondensedLines = longSuperCondensed.trimEnd().split("\n");
  expect(longSuperCondensedLines[0]).toContain("this is a ver...");
  expect(longSuperCondensedLines[1]?.trim() ?? "").toBe("");
}, 20000);
