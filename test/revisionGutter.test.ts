import { expect, test } from "bun:test";
import {
  buildRevisionGutterPlan,
  buildCondensedGraphLine,
  deriveGraphContinuationLine,
  measureCoreGraphWidth,
  measureGutterPlanWidth,
} from "../src/ui/revisionGutter.ts";

test("deriveGraphContinuationLine turns node markers into continuations", () => {
  expect(deriveGraphContinuationLine("@  ")).toBe("│");
  expect(deriveGraphContinuationLine("| ○")).toBe("│ │");
  expect(deriveGraphContinuationLine("│ ◆")).toBe("│ │");
  expect(deriveGraphContinuationLine("  *")).toBe("  │");
  expect(deriveGraphContinuationLine("×  ")).toBe("│");
  expect(deriveGraphContinuationLine("├─╯")).toBe("│");
  expect(deriveGraphContinuationLine("╭─╮")).toBe("│ │");
});

test("buildRevisionGutterPlan promotes the first crossover row into the subtitle line", () => {
  const plan = buildRevisionGutterPlan({
    graphHead: "│ ○  ",
    graphTail: ["├─╯"],
    detailRowCount: 2,
    ownsTop: true,
    ownsBottom: true,
    previousGraphBottom: "○  ",
    hasNextRevision: true,
  });

  expect(plan.topDivider).toBe("│");
  expect(plan.title).toBe("│ ○");
  expect(plan.subtitle).toBe("├─╯");
  expect(plan.tail).toEqual([]);
  expect(plan.detail).toEqual(["│", "│"]);
  expect(plan.bottomDivider).toBe("│");
});

test("buildCondensedGraphLine keeps single-line graphs unchanged", () => {
  expect(buildCondensedGraphLine("@  ", [])).toBe("@");
  expect(buildCondensedGraphLine("○ │", [])).toBe("○ │");
});

test("buildCondensedGraphLine folds the default jj branch row into the node row", () => {
  expect(buildCondensedGraphLine("│ ○  ", ["├─╯"])).toBe("├─○");
});

test("buildCondensedGraphLine folds narrow branch-off rows into the title row", () => {
  expect(buildCondensedGraphLine("○    ", ["├─╮"])).toBe("○─╮");
});

test("buildCondensedGraphLine folds wide branch-off rows into the title row", () => {
  expect(buildCondensedGraphLine("○ │    ", ["├───╮"])).toBe("○───╮");
});

test("buildCondensedGraphLine folds merge rows into the title row", () => {
  expect(buildCondensedGraphLine("○ │ │  ", ["├─╯ │"])).toBe("○─╯ │");
  expect(buildCondensedGraphLine("○   │  ", ["├───╯"])).toBe("○───╯");
});

test("buildRevisionGutterPlan keeps a vertical directly above a node on divider rows", () => {
  const previousRowPlan = buildRevisionGutterPlan({
    graphHead: "│ ○  ",
    graphTail: ["├─╯"],
    detailRowCount: 0,
    ownsTop: true,
    ownsBottom: true,
    previousGraphBottom: "○  ",
    hasNextRevision: true,
  });
  const currentRowPlan = buildRevisionGutterPlan({
    graphHead: "○  ",
    graphTail: [],
    detailRowCount: 0,
    ownsTop: false,
    ownsBottom: false,
    previousGraphBottom: "├─╯",
    hasNextRevision: true,
  });

  expect(previousRowPlan.bottomDivider).toBe("│");
  expect(currentRowPlan.topDivider).toBeNull();
  expect(currentRowPlan.title).toBe("○");
  expect(currentRowPlan.subtitle).toBe("│");
});

test("buildRevisionGutterPlan leaves edge dividers blank at the list boundaries", () => {
  const plan = buildRevisionGutterPlan({
    graphHead: "@  ",
    graphTail: [],
    detailRowCount: 0,
    ownsTop: true,
    ownsBottom: true,
    previousGraphBottom: null,
    hasNextRevision: false,
  });

  expect(plan.topDivider).toBe("");
  expect(plan.title).toBe("@");
  expect(plan.subtitle).toBe("│");
  expect(plan.bottomDivider).toBe("");
});

test("topDivider uses previous revision graph topology, not current graphHead", () => {
  // When the current revision merges a branch (graphHead = "○─╯"),
  // the topDivider should still show both branches from the previous revision
  const plan = buildRevisionGutterPlan({
    graphHead: "○─╯",
    graphTail: [],
    detailRowCount: 0,
    ownsTop: true,
    ownsBottom: true,
    previousGraphBottom: "│ │",
    hasNextRevision: true,
  });

  expect(plan.topDivider).toBe("│ │");
  expect(plan.bottomDivider).toBe("│");
});

test("bottomDivider uses current tail continuation, not next graphHead", () => {
  // When the next revision merges a branch, the bottomDivider should still
  // show the branch as it exists at the current revision's level
  const plan = buildRevisionGutterPlan({
    graphHead: "○ │",
    graphTail: ["│ │"],
    detailRowCount: 0,
    ownsTop: false,
    ownsBottom: true,
    previousGraphBottom: null,
    hasNextRevision: true,
  });

  expect(plan.bottomDivider).toBe("│ │");
});

test("measureCoreGraphWidth returns the max width of graphHead and graphTail", () => {
  expect(measureCoreGraphWidth("@  ", [])).toBe(1);
  expect(measureCoreGraphWidth("│ ○  ", ["├─╯"])).toBe(3);
  expect(measureCoreGraphWidth("○ │", ["│ │"])).toBe(3);
  expect(measureCoreGraphWidth("│ │ ○  ", ["│ ├─╯"])).toBe(5);
  expect(measureCoreGraphWidth("○  ", [])).toBe(1);
});

test("measureGutterPlanWidth includes divider widths from neighbors", () => {
  // Core graph is width 1, but topDivider from wider previous is width 3
  const plan = buildRevisionGutterPlan({
    graphHead: "○  ",
    graphTail: [],
    detailRowCount: 0,
    ownsTop: true,
    ownsBottom: true,
    previousGraphBottom: "│ │",
    hasNextRevision: true,
  });

  expect(measureCoreGraphWidth("○  ", [])).toBe(1);
  expect(measureGutterPlanWidth(plan)).toBe(3);
});

test("measureGutterPlanWidth matches core width when no wider neighbors", () => {
  const plan = buildRevisionGutterPlan({
    graphHead: "│ ○  ",
    graphTail: ["├─╯"],
    detailRowCount: 0,
    ownsTop: true,
    ownsBottom: true,
    previousGraphBottom: "○  ",
    hasNextRevision: true,
  });

  expect(measureCoreGraphWidth("│ ○  ", ["├─╯"])).toBe(3);
  expect(measureGutterPlanWidth(plan)).toBe(3);
});
