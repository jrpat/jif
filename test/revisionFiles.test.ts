import { expect, test } from "bun:test";
import {
  buildChangedFileNameSegments,
  getChangedFileRowState,
  getChangedFilesPlaceholderText,
  showsChangedFilesFilter,
} from "../src/ui/revisionFiles.ts";

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

test("showsChangedFilesFilter follows the filter mode and any committed query", () => {
  expect(showsChangedFilesFilter({ focusMode: "files", fileFilterQuery: "" })).toBe(false);
  expect(showsChangedFilesFilter({ focusMode: "file-filter", fileFilterQuery: "" })).toBe(true);
  expect(showsChangedFilesFilter({ focusMode: "files", fileFilterQuery: "src" })).toBe(true);
});

test("buildChangedFileNameSegments returns one plain segment without a filter", () => {
  expect(buildChangedFileNameSegments({ path: "src/app.ts" }, "")).toEqual([
    { text: "src/app.ts", matched: false },
  ]);
});

test("buildChangedFileNameSegments splits each match out of the displayed path", () => {
  expect(buildChangedFileNameSegments({ path: "src/render/render.tsx" }, "REnder")).toEqual([
    { text: "src/", matched: false },
    { text: "render", matched: true },
    { text: "/", matched: false },
    { text: "render", matched: true },
    { text: ".tsx", matched: false },
  ]);
});

test("buildChangedFileNameSegments highlights inside a rename's displayed form", () => {
  expect(
    buildChangedFileNameSegments({ path: "src/new.ts", displayPath: "src/{old => new}.ts" }, "old"),
  ).toEqual([
    { text: "src/{", matched: false },
    { text: "old", matched: true },
    { text: " => new}.ts", matched: false },
  ]);
});

test("getChangedFileRowState marks the focused file while the filter input has focus", () => {
  expect(
    getChangedFileRowState(
      {
        focusMode: "file-filter",
        expandedRowId: "rev-1",
        focusedFileIndex: 0,
        selectedFilePaths: [],
      },
      "rev-1",
      0,
      "src/app.ts",
    ).focused,
  ).toBe(true);
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
