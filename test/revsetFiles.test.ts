import { expect, test } from "bun:test";
import { formatFilesRevset, isFilesOnlyRevset, matchFileSearchPaths } from "../src/revset/files.ts";

test("formatFilesRevset quotes picked paths as revset string literals", () => {
  expect(formatFilesRevset("src/app.ts")).toBe('files("src/app.ts")');
  expect(formatFilesRevset("Foo Bar/(draft).ts")).toBe('files("Foo Bar/(draft).ts")');
  expect(formatFilesRevset('src/"quoted".ts')).toBe('files("src/\\"quoted\\".ts")');
});

test("isFilesOnlyRevset detects a standalone files revset", () => {
  expect(isFilesOnlyRevset('files("src/app.ts")')).toBeTrue();
  expect(isFilesOnlyRevset(' files("src/a)b.ts") ')).toBeTrue();
  expect(isFilesOnlyRevset('files("src/app.ts") & mine()')).toBeFalse();
  expect(isFilesOnlyRevset('mine() | files("src/app.ts")')).toBeFalse();
  expect(isFilesOnlyRevset('files("src/app.ts"')).toBeFalse();
});

test("matchFileSearchPaths returns fuzzy matches with best matches first", () => {
  expect(matchFileSearchPaths("rev", [
    "README.md",
    "src/app.ts",
    "src/revset/completions.ts",
    "test/revisionRender.test.ts",
  ])).toEqual([
    "src/revset/completions.ts",
    "test/revisionRender.test.ts",
  ]);
});
