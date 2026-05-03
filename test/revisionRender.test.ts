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
    resizedLongSuperCondensed,
    divergentFocused,
    expandedChipsInline,
    expandedBookmarkChipRefresh,
    rebaseCommandChips,
    rebaseCommandChipsCondensed,
    rebaseCommandChipsSuperCondensed,
    rebaseCommandChipsWithDescendants,
    squashCommandChips,
  } = JSON.parse(stdout) as {
    condensedUnfocused: string;
    condensedFocused: string;
    superCondensed: string;
    superCondensedExpanded: string;
    cycledToSuperCondensed: string;
    longSuperCondensed: string;
    resizedLongSuperCondensed: {
      initialFrame: string;
      resizedFrame: string;
    };
    divergentFocused: string;
    expandedChipsInline: string;
    expandedBookmarkChipRefresh: {
      initialFrame: string;
      refreshedFrame: string;
    };
    rebaseCommandChips: string;
    rebaseCommandChipsCondensed: string;
    rebaseCommandChipsSuperCondensed: string;
    rebaseCommandChipsWithDescendants: string;
    squashCommandChips: string;
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
  expect(longSuperCondensedLines[0]).toContain("this is a ve... sec");
  expect(longSuperCondensedLines[0]).not.toContain("…");
  expect(longSuperCondensedLines[1]?.trim() ?? "").toBe("");

  const resizedLongInitialLines = resizedLongSuperCondensed.initialFrame.trimEnd().split("\n");
  expect(resizedLongInitialLines[0]).toContain("this is a ve... sec");

  const resizedLongSuperCondensedLines = resizedLongSuperCondensed.resizedFrame.trimEnd().split("\n");
  expect(resizedLongSuperCondensedLines[0]).toContain("this is a very lon");
  expect(resizedLongSuperCondensedLines[0]).not.toContain("...");
  expect(resizedLongSuperCondensedLines[1]?.trim() ?? "").toBe("");

  expect(divergentFocused).toContain("sh/0 older divergent");
  expect(divergentFocused).toContain("sh/1 focused divergent");
  expect(divergentFocused).toContain("│ │ ┌──────────────────────────┐");
  expect(divergentFocused.split("│ │ ┌──────────────────────────┐").length - 1).toBe(1);

  const expandedChipLine = expandedChipsInline
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("main") && line.includes("review") && line.includes("branch"));

  expect(expandedChipLine).toBeDefined();
  expect(expandedChipLine!.indexOf("review")).toBeLessThan(expandedChipLine!.indexOf("main"));
  expect(expandedChipLine!.indexOf("main")).toBeLessThan(expandedChipLine!.indexOf("branch"));

  const initialBookmarkLine = expandedBookmarkChipRefresh.initialFrame
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("source revision") && line.includes("main"));
  expect(initialBookmarkLine).toBeDefined();
  expect(initialBookmarkLine!.indexOf("main")).toBeLessThan(initialBookmarkLine!.indexOf("source revision"));

  const refreshedBookmarkLine = expandedBookmarkChipRefresh.refreshedFrame
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("destination revision") && line.includes("main"));
  expect(refreshedBookmarkLine).toBeDefined();
  expect(refreshedBookmarkLine!.indexOf("main")).toBeLessThan(refreshedBookmarkLine!.indexOf("destination revision"));
  expect(expandedBookmarkChipRefresh.refreshedFrame).not.toContain("source revision                              main");

  expect(rebaseCommandChips).toContain("move");
  expect(rebaseCommandChips).toContain("onto");
  expect(rebaseCommandChips).not.toContain("✓");
  expect(rebaseCommandChips.indexOf("move")).toBeLessThan(rebaseCommandChips.indexOf("onto"));

  const expandedSourceChipLine = rebaseCommandChips
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("sr") && line.includes("move"));
  expect(expandedSourceChipLine).toBeDefined();
  expect(expandedSourceChipLine!).toMatch(/move\s*│$/);

  const condensedSourceChipLine = rebaseCommandChipsCondensed
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("sr") && line.includes("move"));
  expect(condensedSourceChipLine).toBeDefined();
  expect(condensedSourceChipLine!).toMatch(/move\s*│$/);
  expect(condensedSourceChipLine!.indexOf("move")).toBeGreaterThan(condensedSourceChipLine!.indexOf("revision"));

  const condensedTargetChipLine = rebaseCommandChipsCondensed
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("ds") && line.includes("onto"));
  expect(condensedTargetChipLine).toBeDefined();
  expect(condensedTargetChipLine!).toMatch(/onto\s*│$/);
  expect(condensedTargetChipLine!.indexOf("onto")).toBeGreaterThan(condensedTargetChipLine!.indexOf("ation"));

  const superCondensedSourceChipLine = rebaseCommandChipsSuperCondensed
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("source revision") && line.includes("move"));
  expect(superCondensedSourceChipLine).toBeDefined();
  expect(superCondensedSourceChipLine!).toMatch(/move\s*$/);
  expect(superCondensedSourceChipLine!.indexOf("move")).toBeGreaterThan(superCondensedSourceChipLine!.indexOf("source revision"));

  expect(rebaseCommandChipsWithDescendants).toContain("move");
  expect(rebaseCommandChipsWithDescendants).toContain("onto");
  expect(rebaseCommandChipsWithDescendants).not.toContain("descendant move");

  expect(squashCommandChips).toContain("from");
  expect(squashCommandChips).toContain("into");
  expect(squashCommandChips).not.toContain("✓");
}, 20000);
