import { expect, test } from "bun:test";
import { getChangedFileRowState, getChangedFilesPlaceholderText } from "../src/ui/revisionFiles.ts";

test("getChangedFilesPlaceholderText returns No changes for empty revisions", () => {
  expect(getChangedFilesPlaceholderText({ isEmpty: true, filesLoaded: true, files: [] })).toBe("No changes");
});

test("getChangedFilesPlaceholderText returns a loading message for unopened non-empty revisions", () => {
  expect(getChangedFilesPlaceholderText({ isEmpty: false, filesLoaded: false, files: [] })).toBe(
    "Loading changed files...",
  );
});

test("getChangedFilesPlaceholderText returns null once non-empty file details are loaded", () => {
  expect(
    getChangedFilesPlaceholderText({
      isEmpty: false,
      filesLoaded: true,
      files: [{ status: "M", path: "src/app.ts" }],
    }),
  ).toBeNull();
});

test("getChangedFileRowState marks the focused file with a triangular marker", () => {
  expect(
    getChangedFileRowState(
      {
        focusMode: "files",
        expandedRowId: "rev-1",
        focusedFileIndex: 1,
        selectedFilePaths: [],
      },
      "rev-1",
      1,
      "src/app.ts",
    ),
  ).toEqual({
    focused: true,
    selected: false,
    marker: "⏵",
  });
});

test("getChangedFileRowState keeps the focus marker when a selected file is focused", () => {
  expect(
    getChangedFileRowState(
      {
        focusMode: "files",
        expandedRowId: "rev-1",
        focusedFileIndex: 1,
        selectedFilePaths: ["src/app.ts"],
      },
      "rev-1",
      1,
      "src/app.ts",
    ),
  ).toEqual({
    focused: true,
    selected: true,
    marker: "⏵",
  });
});
