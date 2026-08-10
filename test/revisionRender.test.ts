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
    focusedFileBackgrounds,
    selectedFocusedFileBackgrounds,
    cycledToTight,
    longTight,
    resizedLongTight,
    divergentFocused,
    looseChipsInline,
    oversizedBookmarkChipNormal,
    oversizedBookmarkChipTight,
    oversizedWorkspaceChipNormal,
    oversizedWorkspaceChipTight,
    sharedLabelLimitsLoose,
    sharedLabelLimitsTight,
    perLayoutLabelLimitsNormal,
    nullLabelLimitsNormal,
    looseBookmarkChipRefresh,
    rebaseCommandChips,
    rebaseCommandChipsNormal,
    rebaseCommandChipsTight,
    rebaseCommandChipsWithDescendants,
    squashCommandChips,
    dateChipLongDescriptionLoose,
    dateChipLongDescriptionNormal,
    dateChipLongDescriptionTight,
    dateChipWideChipsLoose,
    dateChipWideChipsNormal,
    dateChipWideChipsTight,
    retainedRevisionSlots,
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
    focusedFileBackgrounds: {
      groupBg: [number, number, number, number];
      fileBg: [number, number, number, number];
    };
    selectedFocusedFileBackgrounds: {
      groupBg: [number, number, number, number];
      fileBg: [number, number, number, number];
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
    sharedLabelLimitsLoose: string;
    sharedLabelLimitsTight: string;
    perLayoutLabelLimitsNormal: string;
    nullLabelLimitsNormal: string;
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
    dateChipWideChipsLoose: string;
    dateChipWideChipsNormal: string;
    dateChipWideChipsTight: string;
    retainedRevisionSlots: {
      slotIds: string[];
      snapshots: Record<string, Record<string, number | null>>;
    };
  };

  const focusedBgByLayout = resolveAppConfig({}).colorScheme.rowFocusedFillByLayout;
  const expectedNormalFocusedBg = hexToRgb(focusedBgByLayout.normal!);
  const expectedTightFocusedBg = hexToRgb(focusedBgByLayout.tight!);

  const dateChipPattern = /\d+(s|m|h|d|w|mo|y)/;
  for (const [layout, frame] of [
    ["loose", dateChipLongDescriptionLoose],
    ["normal", dateChipLongDescriptionNormal],
    ["tight", dateChipLongDescriptionTight],
  ] as const) {
    expect(frame, `date chip should be visible in ${layout} layout with a long description`).toMatch(dateChipPattern);
  }

  for (const [layout, frame] of [
    ["loose", dateChipWideChipsLoose],
    ["normal", dateChipWideChipsNormal],
    ["tight", dateChipWideChipsTight],
  ] as const) {
    expect(frame, `date chip should survive oversized chips in ${layout} layout`).toMatch(dateChipPattern);
    expect(frame, `oversized chips should be clipped in ${layout} layout`).not.toContain("feature/very-long-bookmark");
  }

  expect(normalUnfocused).toContain("│ │ └");
  expect(normalUnfocused).toContain("├─╯");
  expect(normalFocused).toContain("│ │ ┌");
  expect(normalFocused).toContain("│ │ └");
  expect(normalFocused).toContain("├─╯");
  expect(normalFocusedBackgrounds.graphBg.slice(0, 3)).toEqual(expectedNormalFocusedBg);
  expect(normalFocusedBackgrounds.contentBg.slice(0, 3)).toEqual(expectedNormalFocusedBg);

  expect(tight).toContain("├─╯");
  expect(tight).not.toContain("┌");
  expect(tight).not.toContain("┐");
  expect(tight).not.toContain("└");
  expect(tight).not.toContain("┘");
  expect(tight).not.toContain("─┤");
  expect(tightFocusedBackgrounds.graphBg.slice(0, 3)).toEqual(expectedTightFocusedBg);
  expect(tightFocusedBackgrounds.contentBg.slice(0, 3)).toEqual(expectedTightFocusedBg);
  expect(focusedFileBackgrounds.groupBg.slice(0, 3)).toEqual([17, 17, 17]);
  expect(focusedFileBackgrounds.fileBg.slice(0, 3)).toEqual([34, 34, 34]);
  expect(selectedFocusedFileBackgrounds.groupBg.slice(0, 3)).toEqual([17, 17, 17]);
  expect(selectedFocusedFileBackgrounds.fileBg.slice(0, 3)).toEqual([51, 51, 51]);

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

  // Loose layout rides the chips on the revision id row and gives the
  // description a row of its own.
  const looseChipLines = looseChipsInline.trimEnd().split("\n");
  const looseChipLine = looseChipLines.find((line) => line.includes("cu"));
  const looseDescriptionLine = looseChipLines.find((line) => line.includes("branch"));

  expect(looseChipLine).toBeDefined();
  expect(looseChipLine!.indexOf("cu")).toBeLessThan(looseChipLine!.indexOf("review"));
  expect(looseChipLine!.indexOf("review")).toBeLessThan(looseChipLine!.indexOf("main"));
  expect(looseChipLine).not.toContain("branch");
  expect(looseDescriptionLine).toBeDefined();
  expect(looseDescriptionLine).not.toContain("review");
  expect(looseDescriptionLine).not.toContain("main");

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

  for (const [layout, frame] of [
    ["loose", sharedLabelLimitsLoose],
    ["tight", sharedLabelLimitsTight],
  ] as const) {
    expect(frame, `shared bookmark limit should apply in ${layout}`).toContain("fe...ark");
    expect(frame, `shared workspace limit should apply in ${layout}`).toContain("wor...ame@");
    expect(frame).not.toContain("feature/very-long-bookmark");
    expect(frame).not.toContain("workspace-with-a-long-name@");
  }

  expect(perLayoutLabelLimitsNormal).toContain("feat...kmark");
  expect(perLayoutLabelLimitsNormal).toContain("works...-name@");
  expect(perLayoutLabelLimitsNormal).not.toContain("feature/very-long-bookmark");
  expect(perLayoutLabelLimitsNormal).not.toContain("workspace-with-a-long-name@");

  expect(nullLabelLimitsNormal).toContain("feature/very-long-bookmark");
  expect(nullLabelLimitsNormal).toContain("workspace-with-a-long-name@");

  // The bookmark chip rides its revision's id row, so a refresh that moves the
  // bookmark has to move the chip with it instead of leaving a stale copy.
  const initialBookmarkLine = looseBookmarkChipRefresh.initialFrame
    .trimEnd()
    .split("\n")
    .find((line) => line.includes("main"));
  expect(initialBookmarkLine).toBeDefined();
  expect(initialBookmarkLine).toContain("sr");
  expect(initialBookmarkLine).not.toContain("source revision");

  const refreshedBookmarkLines = looseBookmarkChipRefresh.refreshedFrame
    .trimEnd()
    .split("\n")
    .filter((line) => line.includes("main"));
  expect(refreshedBookmarkLines).toHaveLength(1);
  expect(refreshedBookmarkLines[0]).toContain("ds");
  expect(refreshedBookmarkLines[0]).not.toContain("destination revision");

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

  const initialRevisionSlots = retainedRevisionSlots.snapshots.loose!;
  for (const slotId of retainedRevisionSlots.slotIds) {
    expect(
      initialRevisionSlots[slotId],
      `${slotId} should identify an explicit revision slot renderable`,
    ).not.toBeNull();
  }
  for (const [state, revisionSlots] of Object.entries(retainedRevisionSlots.snapshots)) {
    expect(
      revisionSlots,
      `revision slot renderables should retain identity in ${state}`,
    ).toEqual(initialRevisionSlots);
  }
}, 20000);
