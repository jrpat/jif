import { expect, test } from "bun:test";
import { getChangedFileRowBackgroundColor, getRevisionRowBackgroundColor } from "../src/ui/rowBackgrounds.ts";

const colors = {
  rowFocusedFill: "focused",
  rowSelectedFill: "selected",
  rowAffectedFill: "affected",
};

test("getRevisionRowBackgroundColor lets focus override selection", () => {
  expect(getRevisionRowBackgroundColor({
    focused: true,
    selected: true,
    affected: false,
    colors,
  })).toBe("focused");
});

test("getRevisionRowBackgroundColor falls back to selection before affected", () => {
  expect(getRevisionRowBackgroundColor({
    focused: false,
    selected: true,
    affected: true,
    colors,
  })).toBe("selected");
});

test("getChangedFileRowBackgroundColor lets focus override selection", () => {
  expect(getChangedFileRowBackgroundColor({
    focused: true,
    selected: true,
    colors,
  })).toBe("focused");
});

test("getChangedFileRowBackgroundColor uses selection when unfocused", () => {
  expect(getChangedFileRowBackgroundColor({
    focused: false,
    selected: true,
    colors,
  })).toBe("selected");
});