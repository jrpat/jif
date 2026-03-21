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
) {
  return getRevisionBorderPolicy({
    rowState,
    previousRowState,
    nextRowState,
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
