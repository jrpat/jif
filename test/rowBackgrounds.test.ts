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
    commandRoleFill: undefined,
    affected: false,
    colors,
  })).toBe("focused");
});

test("getRevisionRowBackgroundColor falls back to selection before affected", () => {
  expect(getRevisionRowBackgroundColor({
    focused: false,
    selected: true,
    commandRoleFill: undefined,
    affected: true,
    colors,
  })).toBe("selected");
});

test("getRevisionRowBackgroundColor lets a command role fill win over every other state", () => {
  expect(getRevisionRowBackgroundColor({
    focused: true,
    selected: true,
    commandRoleFill: "role",
    affected: true,
    colors,
  })).toBe("role");
});

test("getRevisionRowBackgroundColor tints unfocused chip rows with their role fill", () => {
  expect(getRevisionRowBackgroundColor({
    focused: false,
    selected: false,
    commandRoleFill: "role",
    affected: true,
    colors,
  })).toBe("role");
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
