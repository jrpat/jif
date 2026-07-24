import { expect, test } from "bun:test";
import { ansi256IndexToRgb } from "@opentui/core";

test("PreviewPane renders split per-file diffs through the built-in diff component", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderPreviewPane.tsx"],
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

  type Scenario = {
    registered: boolean;
    lines: string[];
    coloredSpans: { text: string; fg: [number, number, number]; bg: [number, number, number] }[];
    scrollWidth: number | null;
    scrollHeight: number | null;
    viewportWidth: number | null;
    afterScrollLeft: number | null;
    linesAfterScrollDown: string[] | null;
    scrollTopAfter: number | null;
  };
  type RGB = [number, number, number];
  const result = JSON.parse(stdout) as {
    withHeader: Scenario;
    singleFile: Scenario;
    headerSingle: Scenario;
    scrollingHeader: Scenario;
    wide: Scenario;
    wideWrapped: Scenario;
    multiHunk: Scenario;
    wideMultiHunk: Scenario;
    scrollingSingleFile: Scenario;
    themeColors: {
      darkAdded: RGB | null;
      darkRemoved: RGB | null;
      lightAdded: RGB | null;
      lightRemoved: RGB | null;
      darkSyntaxKeyword: RGB | null;
      lightSyntaxKeyword: RGB | null;
      darkSyntaxString: RGB | null;
      lightSyntaxString: RGB | null;
      darkSyntaxComment: RGB | null;
      lightSyntaxComment: RGB | null;
      darkSyntaxAddedBg: RGB | null;
      lightSyntaxAddedBg: RGB | null;
      darkPaneBackground: RGB | null;
      lightPaneBackground: RGB | null;
      configDarkPaneFill: string;
      configLightPaneFill: string;
      configDarkAdded: string;
      configLightAdded: string;
      configLightRemoved: string;
    };
  };
  const withHeaderText = result.withHeader.lines.join("\n");
  const singleText = result.singleFile.lines.join("\n");

  // A separator rule (blank line + divider) sits above the file at `needle`.
  const hasDividerAbove = (lines: string[], needle: string) => {
    const fileIndex = lines.findIndex((line) => line.includes(needle));
    if (fileIndex < 0) return false;
    return lines.slice(0, fileIndex).some((line) => line.includes("─"));
  };
  const brightness = ([r, g, b]: RGB) => (r * 299 + g * 587 + b * 114) / 1000;
  const contrast = (fg: RGB, bg: RGB) => Math.abs(brightness(fg) - brightness(bg));

  // Multi-file with a header: word-wrapped header, a rule above each filename,
  // and both files' diffs rendered by the built-in component.
  expect(result.withHeader.registered).toBe(true);
  const firstContentIndex = result.withHeader.lines.findIndex((line) => line.trim().length > 0);
  const changeIdIndex = result.withHeader.lines.findIndex((line) => line.includes("Change ID:"));
  const commitIdIndex = result.withHeader.lines.findIndex((line) => line.includes("Commit ID:"));
  const authorIndex = result.withHeader.lines.findIndex((line) => line.includes("Author   :"));
  const committerIndex = result.withHeader.lines.findIndex((line) => line.includes("Committer:"));
  const firstDividerIndex = result.withHeader.lines.findIndex((line) => line.includes("─"));
  const descriptionIndex = result.withHeader.lines.findIndex((line) => line.includes("Add a preview pane"));
  expect(changeIdIndex).toBe(firstContentIndex);
  expect(commitIdIndex).toBe(changeIdIndex + 1);
  expect(committerIndex).toBe(commitIdIndex + 1);
  expect(authorIndex).toBe(committerIndex + 1);
  expect(firstDividerIndex).toBe(authorIndex + 1);
  expect(result.withHeader.lines[firstDividerIndex + 1]?.trim()).toBe("");
  expect(descriptionIndex).toBe(firstDividerIndex + 2);
  expect(withHeaderText).toContain("preview");
  expect(withHeaderText).toContain("description");
  expect(withHeaderText).toContain("─");
  expect(withHeaderText).toContain("one.txt");
  expect(withHeaderText).toContain("two.txt");
  expect(withHeaderText).toContain("new");
  expect(withHeaderText).toContain("after");
  // The header preview shows a divider above the FIRST file too, separating the
  // header from the diff.
  expect(hasDividerAbove(result.withHeader.lines, "one.txt")).toBe(true);

  // Single file with no header: the filename shows at the top with no separator
  // rule above it.
  expect(singleText).toContain("solo.txt");
  expect(singleText).not.toContain("─");
  const firstNonEmpty = result.singleFile.lines.find((line) => line.trim().length > 0);
  expect(firstNonEmpty).toContain("solo.txt");

  // Single file WITH a header (revision preview of a one-file change): the
  // divider is restored above the first file because there is a header to
  // separate from.
  const headerSingleText = result.headerSingle.lines.join("\n");
  expect(headerSingleText).toContain("solo.txt");
  expect(headerSingleText).toContain("─");
  expect(hasDividerAbove(result.headerSingle.lines, "solo.txt")).toBe(true);

  // A diff wider than the viewport can be scrolled horizontally.
  expect(result.wide.scrollWidth ?? 0).toBeGreaterThan(result.wide.viewportWidth ?? 0);
  expect(result.wide.afterScrollLeft ?? 0).toBeGreaterThan(0);

  // Word-wrapped preview diffs stay constrained to the viewport and expose the
  // tail of a long line without horizontal scrolling.
  expect(result.wideWrapped.scrollWidth ?? 0).toBeLessThanOrEqual(result.wideWrapped.viewportWidth ?? 0);
  expect(result.wideWrapped.afterScrollLeft ?? 0).toBeLessThanOrEqual(0);
  expect(result.wideWrapped.lines.join("\n")).toContain("forSure");

  // Compressed multi-hunk diffs show the omitted unchanged span explicitly
  // instead of visually joining non-contiguous source regions.
  const multiHunkText = result.multiHunk.lines.join("\n");
  expect(multiHunkText).toContain("multi.txt");
  expect(multiHunkText).toContain("old");
  expect(multiHunkText).toContain("new");
  expect(multiHunkText).toContain("before");
  expect(multiHunkText).toContain("37 more lines");
  const separatorRule = result.multiHunk.coloredSpans.find((span) => span.text.includes("⋮"));
  const separatorLabel = result.multiHunk.coloredSpans.find((span) => span.text.includes("37 more lines"));
  expect(separatorRule).toBeDefined();
  expect(separatorLabel).toBeDefined();
  expect(Math.abs(contrast(separatorRule!.fg, separatorRule!.bg) * 2 - contrast(separatorLabel!.fg, separatorLabel!.bg))).toBeLessThanOrEqual(1);

  // The separator is centered in the visible pane, not in the full horizontal
  // scroll width. Otherwise wide diffs show only the rule in the viewport.
  const wideMultiHunkText = result.wideMultiHunk.lines.join("\n");
  expect(wideMultiHunkText).toContain("38 more lines");

  // The header is part of the scrolled content, not pinned: it is visible at the
  // top, then scrolls out of view as the diff scrolls down.
  const scrolling = result.scrollingHeader;
  expect(scrolling.lines.join("\n")).toContain("ZZHEADERZZ");
  expect(scrolling.scrollTopAfter ?? 0).toBeGreaterThan(0);
  expect((scrolling.linesAfterScrollDown ?? []).join("\n")).not.toContain("ZZHEADERZZ");

  // A no-header single-file preview (Files mode) uses the same scrollbox and
  // visible vertical scrollbar as revision previews when its contents overflow.
  const singleScrolling = result.scrollingSingleFile;
  expect(singleScrolling.lines.join("\n")).toContain("tall.txt");
  expect(singleScrolling.lines.join("\n")).toContain("▀");
  expect(singleScrolling.scrollTopAfter ?? 0).toBeGreaterThan(0);
  expect((singleScrolling.linesAfterScrollDown ?? []).join("\n")).toContain("▀");

  // The diff body adapts to the terminal theme rather than using OpenTUI's
  // hardcoded dark-background line fills (#1a4d1a added / #4d1a1a removed).
  const { darkAdded, darkRemoved, lightAdded, lightRemoved } = result.themeColors;
  const hexToRgb = (hex: string): RGB => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  };

  // We must have located both themed line backgrounds.
  expect(darkAdded).not.toBeNull();
  expect(lightAdded).not.toBeNull();
  expect(darkRemoved).not.toBeNull();
  expect(lightRemoved).not.toBeNull();

  // On a light terminal the fills are light; on a dark terminal they are dark.
  expect(brightness(lightAdded!)).toBeGreaterThan(128);
  expect(brightness(lightRemoved!)).toBeGreaterThan(128);
  expect(brightness(darkAdded!)).toBeLessThan(128);
  expect(brightness(darkRemoved!)).toBeLessThan(128);

  // The rendered light fills match the palette-derived semantic colors, proving
  // the pane feeds adaptive colors into the diff component (and is not the
  // dark default [26,77,26]).
  expect(lightAdded).toEqual(hexToRgb(result.themeColors.configLightAdded));
  expect(lightRemoved).toEqual(hexToRgb(result.themeColors.configLightRemoved));
  expect(lightAdded).not.toEqual([26, 77, 26]);

  // Syntax highlighting uses indexed ANSI foregrounds without replacing the
  // diff line backgrounds.
  const ansiRgb = (index: number): RGB => {
    const [r, g, b] = ansi256IndexToRgb(index);
    return [r, g, b];
  };
  expect(result.themeColors.darkSyntaxKeyword).not.toBeNull();
  expect(result.themeColors.lightSyntaxKeyword).not.toBeNull();
  expect(result.themeColors.darkSyntaxString).not.toBeNull();
  expect(result.themeColors.lightSyntaxString).not.toBeNull();
  expect(result.themeColors.darkSyntaxComment).not.toBeNull();
  expect(result.themeColors.lightSyntaxComment).not.toBeNull();

  expect(result.themeColors.darkSyntaxKeyword).toEqual(ansiRgb(1));
  expect(result.themeColors.lightSyntaxKeyword).toEqual(ansiRgb(1));
  expect(result.themeColors.darkSyntaxString).toEqual(ansiRgb(2));
  expect(result.themeColors.lightSyntaxString).toEqual(ansiRgb(2));
  expect(result.themeColors.darkSyntaxComment).toEqual(ansiRgb(8));
  expect(result.themeColors.lightSyntaxComment).toEqual(ansiRgb(8));

  expect(result.themeColors.darkSyntaxAddedBg).toEqual(hexToRgb(result.themeColors.configDarkAdded));
  expect(result.themeColors.lightSyntaxAddedBg).toEqual(hexToRgb(result.themeColors.configLightAdded));

  expect(result.themeColors.darkPaneBackground).toEqual(hexToRgb(result.themeColors.configDarkPaneFill));
  expect(result.themeColors.lightPaneBackground).toEqual(hexToRgb(result.themeColors.configLightPaneFill));
});
