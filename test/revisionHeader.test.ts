import { expect, test } from "bun:test";
import type { RevisionSummary } from "../src/domain/types.ts";
import {
  buildRevisionChangeIdSegments,
  formatRelativeAgo,
  getRevisionChangeIdDisplayLength,
  getRevisionCommandChipBgColor,
  getRevisionChangeIdColors,
  getRevisionSelectionMarker,
  getRevisionDescriptionColor,
  hasUserDescription,
} from "../src/ui/revisionHeader.ts";

function createRevision(overrides: Partial<RevisionSummary> = {}): RevisionSummary {
  const revisionId = overrides.revisionId ?? "abcdefgh";

  return {
    changeIdPrefixLength: 2,
    commitId: "12345678",
    description: "feat: tighten condensed layout packing",
    localTimestamp: "2026-03-30 07:22:39",
    bookmarks: [],
    workspaces: [],
    graphRows: ["@  "],
    isEmpty: false,
    hasConflict: false,
    marker: "working-copy",
    filesLoaded: false,
    files: [],
    ...overrides,
    rowId: overrides.rowId ?? revisionId,
    revisionId,
  };
}

test("buildRevisionChangeIdSegments renders only change-id segments", () => {
  const revision = createRevision();

  const text = buildRevisionChangeIdSegments(revision)
    .map((segment) => segment.text)
    .join("");

  expect(text).toBe("abcdefgh");
});

test("getRevisionChangeIdDisplayLength uses the longest unique prefix by default", () => {
  const revisions = [
    createRevision({ revisionId: "abcdefgh", changeIdPrefixLength: 2 }),
    createRevision({ revisionId: "ijklmnop", changeIdPrefixLength: 4 }),
    createRevision({ revisionId: "qrstuvwx", changeIdPrefixLength: 3 }),
  ];

  expect(getRevisionChangeIdDisplayLength(revisions)).toBe(4);
});

test("getRevisionChangeIdDisplayLength adds configured extra characters", () => {
  const revisions = [
    createRevision({ revisionId: "abcdefgh", changeIdPrefixLength: 2 }),
    createRevision({ revisionId: "ijklmnop", changeIdPrefixLength: 4 }),
    createRevision({ revisionId: "qrstuvwx", changeIdPrefixLength: 3 }),
  ];

  expect(getRevisionChangeIdDisplayLength(revisions, 2)).toBe(6);
});

test("getRevisionChangeIdDisplayLength never exceeds the available change id", () => {
  const revisions = [
    createRevision({ revisionId: "abcdefgh", changeIdPrefixLength: 8 }),
  ];

  expect(getRevisionChangeIdDisplayLength(revisions, 3)).toBe(8);
});

test("buildRevisionChangeIdSegments truncates the rendered change id to the shared display length", () => {
  const revision = createRevision({
    changeIdPrefixLength: 3,
    revisionId: "abcdefgh",
  });

  const segments = buildRevisionChangeIdSegments(revision, {
    displayLength: 4,
  });

  expect(segments).toEqual([
    { kind: "prefix", text: "abc" },
    { kind: "suffix", text: "d" },
  ]);
});

test("buildRevisionChangeIdSegments omits the suffix segment when the unique prefix fills the display length", () => {
  const revision = createRevision({
    changeIdPrefixLength: 4,
    revisionId: "abcdefgh",
  });

  const segments = buildRevisionChangeIdSegments(revision, {
    displayLength: 4,
  });

  expect(segments).toEqual([
    { kind: "prefix", text: "abcd" },
  ]);
});

test("buildRevisionChangeIdSegments styles divergent suffix like the prefix", () => {
  const revision = createRevision({
    changeIdPrefixLength: 3,
    revisionId: "abcdefgh/1",
  });

  const segments = buildRevisionChangeIdSegments(revision);

  expect(segments).toEqual([
    { kind: "prefix", text: "abc" },
    { kind: "suffix", text: "defgh" },
    { kind: "prefix", text: "/1" },
  ]);
});

test("buildRevisionChangeIdSegments does not add a divergent suffix for non-divergent revisions", () => {
  const revision = createRevision({
    changeIdPrefixLength: 2,
    revisionId: "abcdefgh",
  });

  const segments = buildRevisionChangeIdSegments(revision);

  expect(segments).toEqual([
    { kind: "prefix", text: "ab" },
    { kind: "suffix", text: "cdefgh" },
  ]);
});

const descriptionColors = {
  textPrimary: "primary",
  textTertiary: "tertiary",
  statusSuccess: "success",
  statusWarning: "warning",
};

test("getRevisionDescriptionColor uses primary text for normal revisions", () => {
  const color = getRevisionDescriptionColor(createRevision(), {
    rowState: "default",
    colors: descriptionColors,
  });

  expect(color).toBe("primary");
});

test("getRevisionDescriptionColor uses warning color for no-description placeholder", () => {
  const color = getRevisionDescriptionColor(createRevision({ description: "(no description)" }), {
    rowState: "focused",
    colors: descriptionColors,
  });

  expect(color).toBe("warning");
});

test("getRevisionDescriptionColor uses success color for empty+no-description placeholder", () => {
  const color = getRevisionDescriptionColor(createRevision({ description: "(empty) (no description)" }), {
    rowState: "default",
    colors: descriptionColors,
  });

  expect(color).toBe("success");
});

test("hasUserDescription treats generated placeholders as missing descriptions", () => {
  expect(hasUserDescription(createRevision({ description: "(no description)" }))).toBeFalse();
  expect(hasUserDescription(createRevision({ description: "(empty) (no description)" }))).toBeFalse();
});

test("hasUserDescription keeps literal user text that mentions no description", () => {
  expect(hasUserDescription(createRevision({ description: "docs: explain the (no description) marker" }))).toBeTrue();
});

test("getRevisionChangeIdColors matches focused row chrome", () => {
  const colors = getRevisionChangeIdColors({
    rowState: "focused",
    colors: {
      rowSelectedAccent: "selected",
      chromeBorderFocus: "focus",
      revsetPrefix: "prefix",
      textTertiary: "suffix",
    },
  });

  expect(colors).toEqual({
    prefix: "focus",
    suffix: "focus",
  });
});

test("getRevisionChangeIdColors matches selected row accent", () => {
  const colors = getRevisionChangeIdColors({
    rowState: "selected",
    colors: {
      rowSelectedAccent: "selected",
      chromeBorderFocus: "focus",
      revsetPrefix: "prefix",
      textTertiary: "suffix",
    },
  });

  expect(colors).toEqual({
    prefix: "selected",
    suffix: "selected",
  });
});

test("getRevisionChangeIdColors keeps default suffix dimmed", () => {
  const colors = getRevisionChangeIdColors({
    rowState: "default",
    colors: {
      rowSelectedAccent: "selected",
      chromeBorderFocus: "focus",
      revsetPrefix: "prefix",
      textTertiary: "suffix",
    },
  });

  expect(colors).toEqual({
    prefix: "prefix",
    suffix: "suffix",
  });
});

test("formatRelativeAgo returns empty string for blank or malformed timestamps", () => {
  const now = new Date(2026, 4, 15, 12, 0, 0);

  expect(formatRelativeAgo("", now)).toBe("");
  expect(formatRelativeAgo("   ", now)).toBe("");
  expect(formatRelativeAgo("not a date", now)).toBe("");
});

test("formatRelativeAgo formats sub-minute deltas as seconds", () => {
  const now = new Date(2026, 4, 15, 12, 0, 0);

  expect(formatRelativeAgo("2026-05-15 12:00:00", now)).toBe("0s");
  expect(formatRelativeAgo("2026-05-15 11:59:59", now)).toBe("1s");
  expect(formatRelativeAgo("2026-05-15 11:59:30", now)).toBe("30s");
});

test("formatRelativeAgo switches to minutes once rounded seconds reach 60", () => {
  const now = new Date(2026, 4, 15, 12, 0, 0);

  expect(formatRelativeAgo("2026-05-15 11:59:00", now)).toBe("1m");
  expect(formatRelativeAgo("2026-05-15 11:30:00", now)).toBe("30m");
  expect(formatRelativeAgo("2026-05-15 11:01:00", now)).toBe("59m");
});

test("formatRelativeAgo switches to hours once rounded minutes reach 60", () => {
  const now = new Date(2026, 4, 15, 12, 0, 0);

  expect(formatRelativeAgo("2026-05-15 11:00:00", now)).toBe("1h");
  expect(formatRelativeAgo("2026-05-15 03:00:00", now)).toBe("9h");
  expect(formatRelativeAgo("2026-05-14 13:00:00", now)).toBe("23h");
});

test("formatRelativeAgo formats sub-week deltas as days with natural rounding", () => {
  const now = new Date(2026, 4, 15, 12, 0, 0);

  expect(formatRelativeAgo("2026-05-14 12:00:00", now)).toBe("1d");
  expect(formatRelativeAgo("2026-05-12 12:00:00", now)).toBe("3d");
  expect(formatRelativeAgo("2026-05-09 12:00:00", now)).toBe("6d");
});

test("formatRelativeAgo switches to weeks once rounded days reach 7", () => {
  const now = new Date(2026, 4, 15, 12, 0, 0);

  expect(formatRelativeAgo("2026-05-08 12:00:00", now)).toBe("1w");
  expect(formatRelativeAgo("2026-04-17 12:00:00", now)).toBe("4w");
  expect(formatRelativeAgo("2026-03-27 12:00:00", now)).toBe("7w");
});

test("formatRelativeAgo switches to months once rounded weeks reach 8", () => {
  const now = new Date(2026, 4, 15, 12, 0, 0);

  expect(formatRelativeAgo("2026-03-15 12:00:00", now)).toBe("2mo");
  expect(formatRelativeAgo("2025-11-15 12:00:00", now)).toBe("6mo");
  expect(formatRelativeAgo("2025-08-15 12:00:00", now)).toBe("9mo");
});

test("formatRelativeAgo switches to years past 12 months", () => {
  const now = new Date(2026, 4, 15, 12, 0, 0);

  expect(formatRelativeAgo("2024-05-15 12:00:00", now)).toBe("2y");
  expect(formatRelativeAgo("2016-05-15 12:00:00", now)).toBe("10y");
});

test("formatRelativeAgo clamps future timestamps to zero seconds", () => {
  const now = new Date(2026, 4, 15, 12, 0, 0);

  expect(formatRelativeAgo("2026-06-01 12:00:00", now)).toBe("0s");
});

test("getRevisionSelectionMarker fills the one-character slot after the change id without shifting layout", () => {
  expect(getRevisionSelectionMarker("selected")).toBe("✓");
  expect(getRevisionSelectionMarker("focused")).toBe(" ");
  expect(getRevisionSelectionMarker("default")).toBe(" ");
});

test("getRevisionCommandChipBgColor matches selected row accent", () => {
  const color = getRevisionCommandChipBgColor({
    rowState: "selected",
    colors: {
      rowSelectedAccent: "selected",
      chromeBorderFocus: "focus",
    },
  });

  expect(color).toBe("selected");
});

test("getRevisionCommandChipBgColor keeps focused rows on focus chrome", () => {
  const color = getRevisionCommandChipBgColor({
    rowState: "focused",
    colors: {
      rowSelectedAccent: "selected",
      chromeBorderFocus: "focus",
    },
  });

  expect(color).toBe("focus");
});
