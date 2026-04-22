import { expect, test } from "bun:test";
import type { RevisionSummary } from "../src/domain/types.ts";
import {
  buildRevisionChangeIdSegments,
  getRevisionChangeIdColors,
  getRevisionDescriptionColor,
} from "../src/ui/revisionHeader.ts";

function createRevision(overrides: Partial<RevisionSummary> = {}): RevisionSummary {
  return {
    revisionId: "abcdefgh",
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
