import { expect, test } from "bun:test";
import { resolveAppConfig } from "../src/config/index.ts";

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

test("normal-layout branch elbow rows keep gutter dividers aligned with focused and unfocused borders", async () => {
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
    normalUnfocused,
    normalFocused,
    tight,
    tightExpanded,
    normalFocusedBackgrounds,
    tightFocusedBackgrounds,
    cycledToTight,
    longTight,
    resizedLongTight,
    divergentFocused,
    looseChipsInline,
    oversizedBookmarkChipNormal,
    oversizedBookmarkChipTight,
    oversizedWorkspaceChipNormal,
    oversizedWorkspaceChipTight,
    looseBookmarkChipRefresh,
    rebaseCommandChips,
    rebaseCommandChipsNormal,
    rebaseCommandChipsTight,
    rebaseCommandChipsWithDescendants,
    squashCommandChips,
    dateChipLongDescriptionLoose,
    dateChipLongDescriptionNormal,
    dateChipLongDescriptionTight,
    retainedLayoutBranches,
  } = JSON.parse(stdout) as {
    normalUnfocused: string;
    normalFocused: string;
    tight: string;
    tightExpanded: string;
    normalFocusedBackgrounds: {
      graphBg: [number, number, number, number];
      contentBg: [number, number, number, number];
    };
    tightFocusedBackgrounds: {
      graphBg: [number, number, number, number];
      contentBg: [number, number, number, number];
    };
    cycledToTight: string;
    longTight: string;
    resizedLongTight: {
      initialFrame: string;
      resizedFrame: string;
    };
    divergentFocused: string;
    looseChipsInline: string;
    oversizedBookmarkChipNormal: string;
    oversizedBookmarkChipTight: string;
    oversizedWorkspaceChipNormal: string;
    oversizedWorkspaceChipTight: string;
    looseBookmarkChipRefresh: {
      initialFrame: string;
      refreshedFrame: string;
    };
    rebaseCommandChips: string;
    rebaseCommandChipsNormal: string;
    rebaseCommandChipsTight: string;
    rebaseCommandChipsWithDescendants: string;
    squashCommandChips: string;
    dateChipLongDescriptionLoose: string;
    dateChipLongDescriptionNormal: string;
    dateChipLongDescriptionTight: string;
    retainedLayoutBranches: {
      before: (number | null)[];
      after: (number | null)[];
    };
  };

  const expectedFocusedBg = hexToRgb(resolveAppConfig({}).colorScheme.semanticColors.rowFocusedFill!);

  const dateChipPattern = /\d+(s|m|h|d|w|mo|y)/;
  for (const [layout, frame] of [
    ["loose", dateChipLongDescriptionLoose],
    ["normal", dateChipLongDescriptionNormal],
    ["tight", dateChipLongDescriptionTight],
  ] as const) {
    expect(frame, `date chip should be visible in ${layout} layout with a long description`).toMatch(dateChipPattern);
  }

  expect(normalUnfocused).toContain("│ │ └");
  expect(normalUnfocused).toContain("├─╯");
  expect(normalFocused).toContain("│ │ ┌");
  expect(normalFocused).toContain("│ │ └");
  expect(normalFocused).toContain("├─╯");
  expect(normalFocusedBackgrounds.graphBg.slice(0, 3)).toEqual(expectedFocusedBg);
  expect(normalFocusedBackgrounds.contentBg.slice(0, 3)).toEqual(expectedFocusedBg);

  expect(tight).toContain("├─╯");
  expect(tight).not.toContain("┌");
  expect(tight).not.toContain("┐");
  expect(tight).not.toContain("└");
  expect(tight).not.toContain("┘");
  expect(tight).not.toContain("─┤");
  expect(tightFocusedBackgrounds.graphBg.slice(0, 3)).toEqual(expectedFocusedBg);
  expect(tightFocusedBackgrounds.contentBg.slice(0, 3)).toEqual(expectedFocusedBg);

  expect(tightExpanded).toContain("src/layout.ts");
  expect(tightExpanded).not.toContain("┌");
  expect(tightExpanded).not.toContain("┐");
  expect(cycledToTight).toContain("├─╯");
  expect(cycledToTight).not.toContain("┌");
  expect(cycledToTight).not.toContain("┐");
  const longTightLines = longTight.trimEnd().split("\n");
  expect(longTightLines[0]).toContain("this is");
  expect(longTightLines[0]).toContain("...");
  expect(longTightLines[0]).toContain("line");
  expect(longTightLines[0]).not.toContain("…");
  expect(longTightLines[0]!.length).toBeLessThanOrEqual(24);
  expect(longTightLines[1]?.trim() ?? "").toBe("");

  const resizedLongInitialLines = resizedLongTight.initialFrame.trimEnd().split("\n");
  expect(resizedLongInitialLines[0]).toContain("this is");
  expect(resizedLongInitialLines[0]).toContain("...");
  expect(resizedLongInitialLines[0]).toContain("line");
  expect(resizedLongInitialLines[0]!.length).toBeLessThanOrEqual(24);

  const resizedLongTightLines = resizedLongTight.resizedFrame.trimEnd().split("\n");
  expect(resizedLongTightLines[0]).toContain("this is a very");
  expect(resizedLongTightLines[0]!.length).toBeLessThanOrEqual(40);
  expect(resizedLongTightLines[1]?.trim() ?? "").toBe("");

  expect(divergentFocused).toContain("sh/0 older divergent");
  expect(divergentFocused).toContain("sh/1 focused divergent");
  expect(divergentFocused).toContain("│ │ ┌──────────────────────────┐");
  expect(divergentFocused.split("│ │ ┌──────────────────────────┐").length - 1).toBe(1);

  const looseChipLine = looseChipsInline
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("main") && line.includes("review") && line.includes("branch"));

  expect(looseChipLine).toBeDefined();
  expect(looseChipLine!.indexOf("review")).toBeLessThan(looseChipLine!.indexOf("main"));
  expect(looseChipLine!.indexOf("main")).toBeLessThan(looseChipLine!.indexOf("branch"));

  for (const [layout, kind, frame] of [
    ["normal", "bookmark", oversizedBookmarkChipNormal],
    ["tight", "bookmark", oversizedBookmarkChipTight],
    ["normal", "workspace", oversizedWorkspaceChipNormal],
    ["tight", "workspace", oversizedWorkspaceChipTight],
  ] as const) {
    expect(
      frame,
      `${kind} chip should keep a separator after the revision id in ${layout} layout`,
    ).toMatch(/cu  very/);
  }

  const initialBookmarkLine = looseBookmarkChipRefresh.initialFrame
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("source revision") && line.includes("main"));
  expect(initialBookmarkLine).toBeDefined();
  expect(initialBookmarkLine!.indexOf("main")).toBeLessThan(initialBookmarkLine!.indexOf("source revision"));

  const refreshedBookmarkLine = looseBookmarkChipRefresh.refreshedFrame
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("destination revision") && line.includes("main"));
  expect(refreshedBookmarkLine).toBeDefined();
  expect(refreshedBookmarkLine!.indexOf("main")).toBeLessThan(refreshedBookmarkLine!.indexOf("destination revision"));
  expect(looseBookmarkChipRefresh.refreshedFrame).not.toContain("source revision                              main");

  expect(rebaseCommandChips).toContain("move");
  expect(rebaseCommandChips).toContain("onto");
  expect(rebaseCommandChips).not.toContain("✓");
  expect(rebaseCommandChips.indexOf("move")).toBeLessThan(rebaseCommandChips.indexOf("onto"));

  const looseSourceChipLine = rebaseCommandChips
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("sr") && line.includes("move"));
  expect(looseSourceChipLine).toBeDefined();
  expect(looseSourceChipLine!).toMatch(/move\s*│$/);

  const normalSourceChipLine = rebaseCommandChipsNormal
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("sr") && line.includes("move"));
  expect(normalSourceChipLine).toBeDefined();
  expect(normalSourceChipLine!).toMatch(/move\s*│$/);
  expect(normalSourceChipLine!.indexOf("move")).toBeGreaterThan(normalSourceChipLine!.indexOf("revision"));

  const normalTargetChipLine = rebaseCommandChipsNormal
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("ds") && line.includes("onto"));
  expect(normalTargetChipLine).toBeDefined();
  expect(normalTargetChipLine!).toMatch(/onto\s*│$/);
  expect(normalTargetChipLine!.indexOf("onto")).toBeGreaterThan(normalTargetChipLine!.indexOf("ation"));

  const tightSourceChipLine = rebaseCommandChipsTight
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("source revision") && line.includes("move"));
  expect(tightSourceChipLine).toBeDefined();
  expect(tightSourceChipLine!).toMatch(/move\s*$/);
  expect(tightSourceChipLine!.indexOf("move")).toBeGreaterThan(tightSourceChipLine!.indexOf("source revision"));

  expect(rebaseCommandChipsWithDescendants).toContain("move");
  expect(rebaseCommandChipsWithDescendants).toContain("onto");
  expect(rebaseCommandChipsWithDescendants).not.toContain("descendant move");

  expect(squashCommandChips).toContain("from");
  expect(squashCommandChips).toContain("into");
  expect(squashCommandChips).not.toContain("✓");

  expect(retainedLayoutBranches.before).not.toContain(null);
  expect(retainedLayoutBranches.after).toEqual(retainedLayoutBranches.before);
}, 20000);
