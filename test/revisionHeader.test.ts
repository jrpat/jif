import { expect, test } from "bun:test";
import type { RevisionSummary } from "../src/domain/types.ts";
import {
  buildRevisionChangeIdSegments,
  getRevisionChangeIdColors,
  getRevisionDescriptionColor,
} from "../src/ui/revisionHeader.ts";

function createRevision(overrides: Partial<RevisionSummary> = {}): RevisionSummary {
  return {
    changeId: "abcdefgh",
    changeIdPrefixLength: 2,
    commitId: "12345678",
    description: "feat: tighten condensed layout packing",
    localTimestamp: "2026-03-30 07:22:39",
    bookmarks: [],
    workspaces: [],
    graphHead: "@  ",
    graphTail: [],
    isEmpty: false,
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

test("getRevisionDescriptionColor uses primary text for normal revisions", () => {
  const color = getRevisionDescriptionColor(createRevision(), {
    rowState: "default",
    colors: {
      textPrimary: "primary",
      textTertiary: "tertiary",
    },
  });

  expect(color).toBe("primary");
});

test("getRevisionDescriptionColor keeps empty revisions dimmed", () => {
  const color = getRevisionDescriptionColor(createRevision({ isEmpty: true }), {
    rowState: "focused",
    colors: {
      textPrimary: "primary",
      textTertiary: "tertiary",
    },
  });

  expect(color).toBe("tertiary");
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
