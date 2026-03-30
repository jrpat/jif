import { expect, test } from "bun:test";
import { getChangedFilesPlaceholderText } from "../src/ui/revisionFiles.ts";

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
