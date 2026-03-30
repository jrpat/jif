import { expect, test } from "bun:test";
import type { RevisionSummary } from "../src/domain/types.ts";
import { buildRevisionHeaderLayout } from "../src/ui/revisionLayout.ts";

function createRevision(overrides: Partial<RevisionSummary> = {}): RevisionSummary {
  return {
    changeId: "abcdefgh",
    changeIdPrefixLength: 2,
    commitId: "12345678",
    description: "feat: tighten condensed layout packing",
    bookmarks: ["main"],
    workspaces: ["review"],
    graphHead: "@  ",
    graphTail: [],
    isEmpty: false,
    marker: "working-copy",
    filesLoaded: false,
    files: [],
    ...overrides,
  };
}

test("expanded header keeps chips on the top row and description on a second row", () => {
  const layout = buildRevisionHeaderLayout(createRevision(), {
    condensed: false,
    isCommandTarget: true,
    badgeText: "onto",
  });

  expect(layout.headerRowCount).toBe(2);
  expect(layout.contentHeight).toBe(2);
  expect(layout.clipOverflow).toBeFalse();
  expect(layout.descriptionPlacement).toBe("separate-row");
  expect(layout.commandTarget?.placement).toBe("inline");
  expect(layout.sideChips).toEqual([
    { kind: "bookmark", text: "main" },
    { kind: "workspace", text: "review" },
  ]);
});

test("condensed header overlays the command target chip and keeps right chips trailing", () => {
  const revision = createRevision();
  const layout = buildRevisionHeaderLayout(revision, {
    condensed: true,
    isCommandTarget: true,
    badgeText: "onto",
  });

  expect(layout.headerRowCount).toBe(1);
  expect(layout.contentHeight).toBe(1);
  expect(layout.clipOverflow).toBeTrue();
  expect(layout.descriptionPlacement).toBe("between-id-and-side-chips");
  expect(layout.commandTarget).toEqual({
    placement: "overlay",
    leftOffset: revision.changeId.length + 1,
    text: "onto",
  });
});

test("condensed header uses the full trailing width when there are no side chips", () => {
  const layout = buildRevisionHeaderLayout(
    createRevision({ bookmarks: [], workspaces: [] }),
    {
      condensed: true,
      isCommandTarget: false,
      badgeText: "onto",
    },
  );

  expect(layout.sideChips).toEqual([]);
  expect(layout.contentHeight).toBe(1);
  expect(layout.clipOverflow).toBeTrue();
  expect(layout.descriptionPlacement).toBe("full-row-after-id");
  expect(layout.commandTarget).toBeNull();
});
