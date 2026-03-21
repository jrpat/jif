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
  expect(deriveGraphContinuationLine("├─╯")).toBe("│");
  expect(deriveGraphContinuationLine("╭─╮")).toBe("│ │");
});

test("buildRevisionGutterPlan keeps subtitle, details, and shared dividers continuous", () => {
  const plan = buildRevisionGutterPlan({
    graphHead: "│ ○  ",
    graphTail: ["├─╯"],
    detailRowCount: 2,
    ownsTop: true,
    ownsBottom: true,
    previousGraphHead: "○  ",
    nextGraphHead: "○  ",
  });

  expect(plan.topDivider).toBe("│ │");
  expect(plan.title).toBe("│ ○");
  expect(plan.subtitle).toBe("│ │");
  expect(plan.tail).toEqual(["├─╯"]);
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
    previousGraphHead: "○  ",
    nextGraphHead: "○  ",
  });
  const currentRowPlan = buildRevisionGutterPlan({
    graphHead: "○  ",
    graphTail: [],
    detailRowCount: 0,
    ownsTop: false,
    ownsBottom: false,
    previousGraphHead: "│ ○  ",
    nextGraphHead: "○  ",
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
    previousGraphHead: null,
    nextGraphHead: null,
  });

  expect(plan.topDivider).toBe("");
  expect(plan.title).toBe("@");
  expect(plan.subtitle).toBe("│");
  expect(plan.bottomDivider).toBe("");
});
