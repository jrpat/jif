import { expect, test } from "bun:test";
import {
  buildRevisionGutterPlan,
  deriveGraphContinuationLine,
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
