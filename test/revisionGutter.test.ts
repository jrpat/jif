import { expect, test } from "bun:test";
import {
  buildRevisionGutterPlan,
  buildCondensedGraphLine,
  deriveGraphContinuationLine,
  measureBoxedGraphWidth,
  measureCoreGraphWidth,
  measureGutterPlanWidth,
  shouldCondenseGraphRows,
  splitGraphTitleSegments,
} from "../src/ui/revisionGutter.ts";

test("splitGraphTitleSegments splits node markers from structural characters", () => {
  expect(splitGraphTitleSegments("@  ")).toEqual([
    { text: "@", isMarker: true },
    { text: "  ", isMarker: false },
  ]);
  expect(splitGraphTitleSegments("│ ○  ")).toEqual([
    { text: "│ ", isMarker: false },
    { text: "○", isMarker: true },
    { text: "  ", isMarker: false },
  ]);
  expect(splitGraphTitleSegments("×  ")).toEqual([
    { text: "×", isMarker: true },
    { text: "  ", isMarker: false },
  ]);
  expect(splitGraphTitleSegments("")).toEqual([]);
});

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
    graphRows: ["│ ○  ", "├─╯"],
    baseGraphRowCount: 2,
    visibleGraphMode: "direct",
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
  expect(buildCondensedGraphLine(["@  "])).toBe("@");
  expect(buildCondensedGraphLine(["○ │"])).toBe("○ │");
});

test("shouldCondenseGraphRows allows folding only for pure continuation rows", () => {
  expect(shouldCondenseGraphRows(["@  ", "│"])).toBeTrue();
  expect(shouldCondenseGraphRows(["@  ", "|"])).toBeTrue();
  expect(shouldCondenseGraphRows(["○ │", "│ │"])).toBeTrue();
  expect(shouldCondenseGraphRows(["│ ○  ", "├─╯"])).toBeFalse();
  expect(shouldCondenseGraphRows(["○    ", "├─╮"])).toBeFalse();
});

test("buildRevisionGutterPlan folds only continuation rows in compact mode", () => {
  const plan = buildRevisionGutterPlan({
    graphRows: ["@  ", "│", "│"],
    baseGraphRowCount: 2,
    visibleGraphMode: "fold-first-two",
    detailRowCount: 0,
    ownsTop: false,
    ownsBottom: false,
    previousGraphBottom: null,
    hasNextRevision: true,
  });

  expect(plan.title).toBe("@");
  expect(plan.tail).toEqual(["│"]);
});

test("buildRevisionGutterPlan keeps only the elbow spacer row in compact branch mode", () => {
  const plan = buildRevisionGutterPlan({
    graphRows: ["│ ○  ", "├─╯", "│"],
    baseGraphRowCount: 2,
    visibleGraphMode: "keep-second-row",
    detailRowCount: 0,
    ownsTop: false,
    ownsBottom: false,
    previousGraphBottom: null,
    hasNextRevision: true,
  });

  expect(plan.title).toBe("│ ○");
  expect(plan.subtitle).toBe("│ │");
  expect(plan.tail).toEqual(["├─╯"]);
});

test("buildRevisionGutterPlan keeps inline dividers for compact branch spacer rows", () => {
  const plan = buildRevisionGutterPlan({
    graphRows: ["○  ", "├─╯"],
    baseGraphRowCount: 2,
    visibleGraphMode: "keep-second-row",
    detailRowCount: 0,
    ownsTop: true,
    ownsBottom: false,
    previousGraphBottom: "│",
    hasNextRevision: true,
  });

  expect(plan.topDivider).toBe("│");
  expect(plan.bottomDivider).toBeNull();
});

test("buildRevisionGutterPlan keeps boxed-row continuation for compact branch detail rows", () => {
  const plan = buildRevisionGutterPlan({
    graphRows: ["│ ○  ", "├─╯"],
    baseGraphRowCount: 2,
    visibleGraphMode: "keep-second-row",
    detailRowCount: 2,
    ownsTop: true,
    ownsBottom: true,
    previousGraphBottom: "│ │",
    hasNextRevision: true,
  });

  expect(plan.topDivider).toBe("│ │");
  expect(plan.detail).toEqual(["│ │", "│ │"]);
  expect(plan.bottomDivider).toBe("│ │");
});

test("buildRevisionGutterPlan keeps a vertical directly above a node on divider rows", () => {
  const previousRowPlan = buildRevisionGutterPlan({
    graphRows: ["│ ○  ", "├─╯"],
    baseGraphRowCount: 2,
    visibleGraphMode: "direct",
    detailRowCount: 0,
    ownsTop: true,
    ownsBottom: true,
    previousGraphBottom: "○  ",
    hasNextRevision: true,
  });
  const currentRowPlan = buildRevisionGutterPlan({
    graphRows: ["○  "],
    baseGraphRowCount: 2,
    visibleGraphMode: "direct",
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
    graphRows: ["@  "],
    baseGraphRowCount: 2,
    visibleGraphMode: "direct",
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
    graphRows: ["○─╯"],
    baseGraphRowCount: 2,
    visibleGraphMode: "direct",
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
    graphRows: ["○ │", "│ │"],
    baseGraphRowCount: 2,
    visibleGraphMode: "direct",
    detailRowCount: 0,
    ownsTop: false,
    ownsBottom: true,
    previousGraphBottom: null,
    hasNextRevision: true,
  });

  expect(plan.bottomDivider).toBe("│ │");
});

test("measureCoreGraphWidth returns the max width of graphRows", () => {
  expect(measureCoreGraphWidth(["@  "])).toBe(1);
  expect(measureCoreGraphWidth(["│ ○  ", "├─╯"])).toBe(3);
  expect(measureCoreGraphWidth(["○ │", "│ │"])).toBe(3);
  expect(measureCoreGraphWidth(["│ │ ○  ", "│ ├─╯"])).toBe(5);
  expect(measureCoreGraphWidth(["○  "])).toBe(1);
});

test("measureBoxedGraphWidth excludes the external elbow spacer row", () => {
  expect(measureBoxedGraphWidth({
    graphRows: ["○  ", "├─╯"],
    baseGraphRowCount: 2,
    visibleGraphMode: "keep-second-row",
  })).toBe(1);

  expect(measureBoxedGraphWidth({
    graphRows: ["│ ○  ", "├─╯"],
    baseGraphRowCount: 2,
    visibleGraphMode: "keep-second-row",
  })).toBe(3);
});

test("measureGutterPlanWidth includes divider widths from neighbors", () => {
  // Core graph is width 1, but topDivider from wider previous is width 3
  const plan = buildRevisionGutterPlan({
    graphRows: ["○  "],
    baseGraphRowCount: 2,
    visibleGraphMode: "direct",
    detailRowCount: 0,
    ownsTop: true,
    ownsBottom: true,
    previousGraphBottom: "│ │",
    hasNextRevision: true,
  });

  expect(measureCoreGraphWidth(["○  "])).toBe(1);
  expect(measureGutterPlanWidth(plan)).toBe(3);
});

test("measureGutterPlanWidth matches core width when no wider neighbors", () => {
  const plan = buildRevisionGutterPlan({
    graphRows: ["│ ○  ", "├─╯"],
    baseGraphRowCount: 2,
    visibleGraphMode: "direct",
    detailRowCount: 0,
    ownsTop: true,
    ownsBottom: true,
    previousGraphBottom: "○  ",
    hasNextRevision: true,
  });

  expect(measureCoreGraphWidth(["│ ○  ", "├─╯"])).toBe(3);
  expect(measureGutterPlanWidth(plan)).toBe(3);
});
