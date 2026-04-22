import { expect, test } from "bun:test";
import type { RevisionSummary } from "../src/domain/types.ts";
import {
  buildRevisionLayoutSpec,
  getMaxRevisionBaseGraphRowCount,
} from "../src/ui/revisionLayout.ts";

function createRevision(overrides: Partial<RevisionSummary> = {}): RevisionSummary {
  return {
    revisionId: "abcdefgh",
    changeIdPrefixLength: 2,
    commitId: "12345678",
    description: "feat: tighten condensed layout packing",
    localTimestamp: "2026-03-30 07:22:39",
    bookmarks: ["main"],
    workspaces: ["review"],
    graphRows: ["@  "],
    isEmpty: false,
    hasConflict: false,
    marker: "working-copy",
    filesLoaded: false,
    files: [],
    ...overrides,
  };
}

test("expanded layout uses direct two-row graph geometry", () => {
  const layout = buildRevisionLayoutSpec(createRevision(), {
    mode: "expanded",
    isCommandTarget: true,
    badgeText: "onto",
  });

  expect(getMaxRevisionBaseGraphRowCount()).toBe(2);
  expect(layout.mode).toBe("expanded");
  expect(layout.headerRowCount).toBe(2);
  expect(layout.baseGraphRowCount).toBe(2);
  expect(layout.visibleGraphMode).toBe("direct");
  expect(layout.commandTarget?.placement).toBe("inline");
  expect(layout.sideChips).toEqual([
    { kind: "bookmark", text: "main" },
    { kind: "workspace", text: "review" },
  ]);
});

test("condensed layout folds the first two graph rows and overlays the target chip", () => {
  const revision = createRevision({ graphRows: ["@  ", "│"] });
  const layout = buildRevisionLayoutSpec(revision, {
    mode: "condensed",
    isCommandTarget: true,
    badgeText: "onto",
  });

  expect(layout.mode).toBe("condensed");
  expect(layout.headerRowCount).toBe(1);
  expect(layout.baseGraphRowCount).toBe(2);
  expect(layout.visibleGraphMode).toBe("fold-first-two");
  expect(layout.commandTarget).toEqual({
    placement: "overlay",
    leftOffset: revision.revisionId.length + 1,
    text: "onto",
  });
});

test("command target offset accounts for the divergent revision suffix width", () => {
  const revision = createRevision({
    revisionId: "abcdefgh/1",
    graphRows: ["@  ", "│"],
  });

  const layout = buildRevisionLayoutSpec(revision, {
    mode: "condensed",
    isCommandTarget: true,
    badgeText: "onto",
  });

  expect(layout.commandTarget?.leftOffset).toBe(revision.revisionId.length + 1);
});

test("condensed layout preserves a second graph row when it carries branch topology", () => {
  const layout = buildRevisionLayoutSpec(
    createRevision({ graphRows: ["│ ○  ", "├─╯"] }),
    {
      mode: "condensed",
      isCommandTarget: false,
      badgeText: "onto",
    },
  );

  expect(layout.headerRowCount).toBe(1);
  expect(layout.visibleGraphMode).toBe("keep-second-row");
});

test("super-condensed layout keeps the single-row header and inlined command target", () => {
  const layout = buildRevisionLayoutSpec(
    createRevision({ bookmarks: [], workspaces: [] }),
    {
      mode: "super-condensed",
      isCommandTarget: true,
      badgeText: "onto",
    },
  );

  expect(layout.mode).toBe("super-condensed");
  expect(layout.headerRowCount).toBe(1);
  expect(layout.baseGraphRowCount).toBe(2);
  expect(layout.visibleGraphMode).toBe("fold-first-two");
  expect(layout.sideChips).toEqual([]);
  expect(layout.commandTarget).toEqual({
    placement: "inline",
    leftOffset: "abcdefgh".length + 1,
    text: "onto",
  });
});
