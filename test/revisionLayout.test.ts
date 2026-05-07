import { expect, test } from "bun:test";
import type { RevisionSummary } from "../src/domain/types.ts";
import {
  buildRevisionLayoutSpec,
  getMaxRevisionBaseGraphRowCount,
} from "../src/ui/revisionLayout.ts";

function createRevision(overrides: Partial<RevisionSummary> = {}): RevisionSummary {
  const revisionId = overrides.revisionId ?? "abcdefgh";

  return {
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
    rowId: overrides.rowId ?? revisionId,
    revisionId,
  };
}

test("expanded layout uses direct two-row graph geometry", () => {
  const layout = buildRevisionLayoutSpec(createRevision(), {
    mode: "expanded",
    commandChipText: "onto",
  });

  expect(getMaxRevisionBaseGraphRowCount()).toBe(2);
  expect(layout.mode).toBe("expanded");
  expect(layout.headerRowCount).toBe(2);
  expect(layout.baseGraphRowCount).toBe(2);
  expect(layout.visibleGraphMode).toBe("direct");
  expect(layout.commandChip?.placement).toBe("inline");
  expect(layout.sideChips).toEqual([
    { kind: "workspace", text: "review@" },
    { kind: "bookmark", text: "main" },
  ]);
});

test("condensed layout folds the first two graph rows and overlays the target chip", () => {
  const revision = createRevision({ graphRows: ["@  ", "│"] });
  const layout = buildRevisionLayoutSpec(revision, {
    mode: "condensed",
    commandChipText: "onto",
  });

  expect(layout.mode).toBe("condensed");
  expect(layout.headerRowCount).toBe(1);
  expect(layout.baseGraphRowCount).toBe(2);
  expect(layout.visibleGraphMode).toBe("fold-first-two");
  expect(layout.commandChip).toEqual({
    placement: "overlay",
    text: "onto",
  });
});

test("command chips do not change condensed layout for divergent revision ids", () => {
  const revision = createRevision({
    revisionId: "abcdefgh/1",
    graphRows: ["@  ", "│"],
  });

  const layout = buildRevisionLayoutSpec(revision, {
    mode: "condensed",
    commandChipText: "onto",
  });

  expect(layout.commandChip).toEqual({
    placement: "overlay",
    text: "onto",
  });
});

test("condensed layout preserves a second graph row when it carries branch topology", () => {
  const layout = buildRevisionLayoutSpec(
    createRevision({ graphRows: ["│ ○  ", "├─╯"] }),
    {
      mode: "condensed",
      commandChipText: null,
    },
  );

  expect(layout.headerRowCount).toBe(1);
  expect(layout.visibleGraphMode).toBe("keep-second-row");
});

test("super-condensed layout overlays the command chip so it isn't clipped by long descriptions", () => {
  const layout = buildRevisionLayoutSpec(
    createRevision({ bookmarks: [], workspaces: [] }),
    {
      mode: "super-condensed",
      commandChipText: "onto",
    },
  );

  expect(layout.mode).toBe("super-condensed");
  expect(layout.headerRowCount).toBe(1);
  expect(layout.baseGraphRowCount).toBe(2);
  expect(layout.visibleGraphMode).toBe("fold-first-two");
  expect(layout.sideChips).toEqual([]);
  expect(layout.commandChip).toEqual({
    placement: "overlay",
    text: "onto",
  });
});

test("expanded layout inlines any command chip text, including source chips", () => {
  const layout = buildRevisionLayoutSpec(createRevision(), {
    mode: "expanded",
    commandChipText: "move",
  });

  expect(layout.commandChip).toEqual({
    placement: "inline",
    text: "move",
  });
});
