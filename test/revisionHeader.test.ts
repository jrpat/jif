import { expect, test } from "bun:test";
import type { RevisionSummary } from "../src/domain/types.ts";
import {
  buildRevisionChangeIdSegments,
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

test("buildRevisionChangeIdSegments appends timestamps only in expanded layout", () => {
  const revision = createRevision();

  const expandedText = buildRevisionChangeIdSegments(revision, { showTimestamp: true })
    .map((segment) => segment.text)
    .join("");
  const condensedText = buildRevisionChangeIdSegments(revision, { showTimestamp: false })
    .map((segment) => segment.text)
    .join("");

  expect(expandedText).toBe("abcdefgh · 2026-03-30 07:22:39");
  expect(condensedText).toBe("abcdefgh");
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
    showTimestamp: false,
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
    showTimestamp: false,
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

  const segments = buildRevisionChangeIdSegments(revision, { showTimestamp: false });

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

  const segments = buildRevisionChangeIdSegments(revision, { showTimestamp: false });

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

test("getRevisionSelectionMarker shows a light check for selected rows", () => {
  expect(getRevisionSelectionMarker("selected")).toBe("✓ ");
  expect(getRevisionSelectionMarker("focused")).toBe("");
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
