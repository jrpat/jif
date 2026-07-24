import { expect, test } from "bun:test";
import type { RevisionSummary } from "../src/domain/types.ts";
import {
  buildRevisionSideChips,
  getRevisionLayoutPlan,
  getMaxRevisionBaseGraphRowCount,
  resolveRevisionGraphMode,
} from "../src/ui/revisionLayout.ts";

function createRevision(overrides: Partial<RevisionSummary> = {}): RevisionSummary {
  const revisionId = overrides.revisionId ?? "abcdefgh";

  return {
    changeIdPrefixLength: 2,
    commitId: "12345678",
    description: "feat: tighten layout packing",
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

test("loose layout uses direct two-row graph geometry", () => {
  const layout = getRevisionLayoutPlan("loose");

  expect(getMaxRevisionBaseGraphRowCount()).toBe(2);
  expect(layout.mode).toBe("loose");
  expect(layout.header).toEqual({
    rowCount: 2,
    slots: {
      identity: { row: 0, placement: "flow", grow: false },
      metadata: { row: 1, placement: "positioned", grow: true },
      date: { row: 0, placement: "flow", grow: false },
      command: { row: 0, placement: "flow", grow: false },
    },
  });
  expect(layout.contentFrame).toBe("bordered");
  expect(layout.graph).toEqual({
    baseRowCount: 2,
    condensableMode: "direct",
  });
  expect(resolveRevisionGraphMode(layout, createRevision().graphRows)).toBe("direct");
  expect(buildRevisionSideChips(createRevision())).toEqual([
    { kind: "workspace", text: "review@" },
    { kind: "bookmark", text: "main" },
  ]);
});

test("normal layout folds the first two graph rows and overlays the target chip", () => {
  const revision = createRevision({ graphRows: ["@  ", "│"] });
  const layout = getRevisionLayoutPlan("normal");

  expect(layout.mode).toBe("normal");
  expect(layout.header).toEqual({
    rowCount: 1,
    slots: {
      identity: { row: 0, placement: "flow", grow: false },
      metadata: { row: 0, placement: "flow", grow: true },
      date: { row: 0, placement: "flow", grow: false },
      command: { row: 0, placement: "positioned", grow: false },
    },
  });
  expect(layout.contentFrame).toBe("bordered");
  expect(layout.graph.baseRowCount).toBe(2);
  expect(resolveRevisionGraphMode(layout, revision.graphRows)).toBe("fold-first-two");
});

test("layout plans are stable and independent of per-revision content", () => {
  expect(getRevisionLayoutPlan("normal")).toBe(getRevisionLayoutPlan("normal"));
});

test("normal layout preserves a second graph row when it carries branch topology", () => {
  const layout = getRevisionLayoutPlan("normal");

  expect(layout.header.rowCount).toBe(1);
  expect(
    resolveRevisionGraphMode(layout, createRevision({ graphRows: ["│ ○  ", "├─╯"] }).graphRows),
  ).toBe("keep-second-row");
});

test("tight layout overlays the command chip so it isn't clipped by long descriptions", () => {
  const layout = getRevisionLayoutPlan("tight");

  expect(layout.mode).toBe("tight");
  expect(layout.header.rowCount).toBe(1);
  expect(layout.header.slots.metadata).toEqual({
    row: 0,
    placement: "flow",
    grow: true,
  });
  expect(layout.header.slots.command.placement).toBe("positioned");
  expect(layout.contentFrame).toBe("unboxed");
  expect(layout.graph.baseRowCount).toBe(2);
  expect(resolveRevisionGraphMode(layout, createRevision().graphRows)).toBe("fold-first-two");
});

test("loose layout leaves the command slot in flow", () => {
  const layout = getRevisionLayoutPlan("loose");

  expect(layout.header.slots.command.placement).toBe("flow");
});
