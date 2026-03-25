import { expect, test } from "bun:test";
import { BorderChars } from "@opentui/core";
import {
  getRevisionBorderPolicy,
  type RevisionRowState,
} from "../src/ui/revisionBorders.ts";

function getPolicy(
  rowState: RevisionRowState,
  previousRowState: RevisionRowState | null,
  nextRowState: RevisionRowState | null,
  widths?: { current: number; previous?: number; next?: number },
) {
  return getRevisionBorderPolicy({
    rowState,
    previousRowState,
    nextRowState,
    currentGraphWidth: widths?.current ?? 1,
    previousGraphWidth: previousRowState !== null ? (widths?.previous ?? 1) : null,
    nextGraphWidth: nextRowState !== null ? (widths?.next ?? 1) : null,
  });
}

test("default middle revisions share a connected divider", () => {
  const row = getPolicy("default", "default", "default");

  expect(row.ownsTop).toBeFalse();
  expect(row.ownsBottom).toBeTrue();
  expect(row.borderSides).toEqual(["right", "bottom", "left"]);
  expect(row.borderChars?.bottomLeft).toBe(BorderChars.single.leftT);
  expect(row.borderChars?.bottomRight).toBe(BorderChars.single.rightT);
  expect(row.borderChars?.topLeft).toBe(BorderChars.single.topLeft);
  expect(row.borderChars?.topRight).toBe(BorderChars.single.topRight);
});

test("focused row owns both shared dividers and keeps them connected", () => {
  const previousRow = getPolicy("default", null, "focused");
  const focusedRow = getPolicy("focused", "default", "default");
  const nextRow = getPolicy("default", "focused", null);

  expect(previousRow.ownsBottom).toBeFalse();
  expect(previousRow.borderSides).toEqual(["top", "right", "left"]);

  expect(focusedRow.ownsTop).toBeTrue();
  expect(focusedRow.ownsBottom).toBeTrue();
  expect(focusedRow.borderSides).toEqual(["top", "right", "bottom", "left"]);
  expect(focusedRow.borderChars?.topLeft).toBe(BorderChars.single.leftT);
  expect(focusedRow.borderChars?.topRight).toBe(BorderChars.single.rightT);
  expect(focusedRow.borderChars?.bottomLeft).toBe(BorderChars.single.leftT);
  expect(focusedRow.borderChars?.bottomRight).toBe(BorderChars.single.rightT);

  expect(nextRow.ownsTop).toBeFalse();
  expect(nextRow.borderSides).toEqual(["right", "bottom", "left"]);
});

test("selected row owns both shared dividers with true corners", () => {
  const previousRow = getPolicy("default", null, "selected");
  const selectedRow = getPolicy("selected", "default", "default");
  const nextRow = getPolicy("default", "selected", null);

  expect(previousRow.ownsBottom).toBeFalse();
  expect(previousRow.borderSides).toEqual(["top", "right", "left"]);

  expect(selectedRow.ownsTop).toBeTrue();
  expect(selectedRow.ownsBottom).toBeTrue();
  expect(selectedRow.borderSides).toEqual(["top", "right", "bottom", "left"]);
  expect(selectedRow.borderChars?.topLeft).toBe(BorderChars.single.topLeft);
  expect(selectedRow.borderChars?.topRight).toBe(BorderChars.single.topRight);
  expect(selectedRow.borderChars?.bottomLeft).toBe(BorderChars.single.bottomLeft);
  expect(selectedRow.borderChars?.bottomRight).toBe(BorderChars.single.bottomRight);

  expect(nextRow.ownsTop).toBeFalse();
  expect(nextRow.borderSides).toEqual(["right", "bottom", "left"]);
});

test("selected row wins shared separator ownership over a focused neighbor", () => {
  const focusedAbove = getPolicy("focused", null, "selected");
  const selectedRow = getPolicy("selected", "focused", "default");

  expect(focusedAbove.ownsBottom).toBeFalse();
  expect(focusedAbove.borderSides).toEqual(["top", "right", "left"]);

  expect(selectedRow.ownsTop).toBeTrue();
  expect(selectedRow.borderChars?.topLeft).toBe(BorderChars.single.topLeft);
  expect(selectedRow.borderChars?.topRight).toBe(BorderChars.single.topRight);
});

test("left corners use T-junction when neighbor has same graph width", () => {
  const sameWidth = getPolicy("focused", "default", "default", {
    current: 3, previous: 3, next: 3,
  });
  expect(sameWidth.borderChars?.topLeft).toBe(BorderChars.single.leftT);
  expect(sameWidth.borderChars?.bottomLeft).toBe(BorderChars.single.leftT);
});

test("left corners use topT/bottomT when neighbor is wider (smaller graphWidth)", () => {
  // Wider neighbor: connector path arrives from the left
  const neighborWider = getPolicy("focused", "default", "default", {
    current: 3, previous: 1, next: 1,
  });
  expect(neighborWider.borderChars?.topLeft).toBe(BorderChars.single.topT);
  expect(neighborWider.borderChars?.bottomLeft).toBe(BorderChars.single.bottomT);
});

test("left corners use true corners when neighbor has larger graph width", () => {
  const neighborNarrower = getPolicy("focused", "default", "default", {
    current: 1, previous: 3, next: 3,
  });
  expect(neighborNarrower.borderChars?.topLeft).toBe(BorderChars.single.topLeft);
  expect(neighborNarrower.borderChars?.bottomLeft).toBe(BorderChars.single.bottomLeft);
});

test("left corners use true corners for mixed neighbor widths", () => {
  const mixedWidths = getPolicy("focused", "default", "default", {
    current: 3, previous: 1, next: 5,
  });
  // previous (width 1) < current (width 3): topT (connector from wider neighbor)
  expect(mixedWidths.borderChars?.topLeft).toBe(BorderChars.single.topT);
  // next (width 5) > current (width 3): true corner
  expect(mixedWidths.borderChars?.bottomLeft).toBe(BorderChars.single.bottomLeft);
});

test("selected row always uses true corners regardless of graph width", () => {
  const selectedSameWidth = getPolicy("selected", "default", "default", {
    current: 1, previous: 1, next: 1,
  });
  expect(selectedSameWidth.borderChars?.topLeft).toBe(BorderChars.single.topLeft);
  expect(selectedSameWidth.borderChars?.bottomLeft).toBe(BorderChars.single.bottomLeft);
});

test("wider default row wins border ownership over narrower default neighbor", () => {
  // vskromux (graphWidth 1) below uqukuxsv (graphWidth 3): wider row should own top
  const narrowerAbove = getPolicy("default", null, "default", {
    current: 3, next: 1,
  });
  const widerBelow = getPolicy("default", "default", "default", {
    current: 1, previous: 3, next: 1,
  });

  // Narrower row loses bottom ownership to wider neighbor below
  expect(narrowerAbove.ownsBottom).toBeFalse();
  expect(narrowerAbove.borderSides).toEqual(["top", "right", "left"]);

  // Wider row wins top ownership so it can draw T-junctions
  expect(widerBelow.ownsTop).toBeTrue();
  expect(widerBelow.ownsBottom).toBeTrue();
});
