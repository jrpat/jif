import { expect, test } from "bun:test";
import { getChangedFileRowBackgroundColor, getRevisionRowBackgroundColor } from "../src/ui/rowBackgrounds.ts";

const colors = {
  rowFocusedFill: "focused",
  rowSelectedFill: "selected",
  rowPinnedTargetFill: "pinned",
  rowAffectedFill: "affected",
};

test("getRevisionRowBackgroundColor lets focus override selection", () => {
  expect(getRevisionRowBackgroundColor({
    focused: true,
    selected: true,
    pinnedTarget: false,
    affected: false,
    colors,
  })).toBe("focused");
});

test("getRevisionRowBackgroundColor falls back to selection before affected", () => {
  expect(getRevisionRowBackgroundColor({
    focused: false,
    selected: true,
    pinnedTarget: false,
    affected: true,
    colors,
  })).toBe("selected");
});

test("getRevisionRowBackgroundColor fills pinned targets ahead of affected rows", () => {
  expect(getRevisionRowBackgroundColor({
    focused: false,
    selected: false,
    pinnedTarget: true,
    affected: true,
    colors,
  })).toBe("pinned");
});

test("getRevisionRowBackgroundColor keeps the focus fill on a focused pinned target", () => {
  expect(getRevisionRowBackgroundColor({
    focused: true,
    selected: false,
    pinnedTarget: true,
    affected: false,
    colors,
  })).toBe("focused");
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