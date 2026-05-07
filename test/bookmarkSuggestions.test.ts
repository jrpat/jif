import { describe, expect, test } from "bun:test";
import { buildBookmarkSuggestions } from "../src/state/bookmarkSuggestions.ts";

const bookmarks = [
  { name: "main", changeId: "ancestor1" },
  { name: "release", changeId: "ancestor3" },
  { name: "feature", changeId: "descendant1" },
  { name: "wip", changeId: "descendant2" },
  { name: "here", changeId: "focused" },
  { name: "stranger", changeId: "unknown" },
];

const ancestors = ["ancestor1", "ancestor2", "ancestor3"]; // closest first
const descendants = ["descendant1", "descendant2"];        // closest first

describe("buildBookmarkSuggestions", () => {
  test("Move-to ordering excludes current and prioritizes closest ancestor", () => {
    const result = buildBookmarkSuggestions(
      bookmarks,
      "focused",
      ancestors,
      descendants,
      { includeCurrent: false },
    );

    expect(result.map((s) => s.name)).toEqual([
      "main",      // closest ancestor (distance 1)
      "release",   // ancestor distance 3
      "feature",   // closest descendant (distance 1)
      "wip",       // descendant distance 2
      "stranger",  // unrelated, alphabetical
    ]);
    expect(result.find((s) => s.name === "here")).toBeUndefined();
  });

  test("Delete-style ordering includes current bookmarks at top priority", () => {
    const result = buildBookmarkSuggestions(
      bookmarks,
      "focused",
      ancestors,
      descendants,
      { includeCurrent: true },
    );

    expect(result.map((s) => s.name)).toEqual([
      "here",
      "main",
      "release",
      "feature",
      "wip",
      "stranger",
    ]);
  });

  test("multiple current-revision bookmarks are sorted alphabetically", () => {
    const result = buildBookmarkSuggestions(
      [
        { name: "zeta", changeId: "focused" },
        { name: "alpha", changeId: "focused" },
        { name: "main", changeId: "ancestor1" },
      ],
      "focused",
      ["ancestor1"],
      [],
      { includeCurrent: true },
    );

    expect(result.map((s) => s.name)).toEqual(["alpha", "zeta", "main"]);
  });

  test("ancestors and descendants share priority ranking by distance", () => {
    const result = buildBookmarkSuggestions(
      [
        { name: "far-ancestor", changeId: "a3" },
        { name: "near-ancestor", changeId: "a1" },
        { name: "near-descendant", changeId: "d1" },
      ],
      "focused",
      ["a1", "a2", "a3"],
      ["d1", "d2"],
      { includeCurrent: false },
    );

    expect(result.map((s) => s.name)).toEqual([
      "near-ancestor",
      "far-ancestor",
      "near-descendant",
    ]);
  });

  test("a bookmark target appearing in both ancestors and descendants is classified behind", () => {
    const result = buildBookmarkSuggestions(
      [{ name: "edge", changeId: "shared" }],
      "focused",
      ["shared"],
      ["shared"],
      { includeCurrent: false },
    );

    expect(result).toEqual([
      { name: "edge", targetChangeId: "shared", bucket: "behind", distance: 1 },
    ]);
  });

  test("returns an empty list when no bookmarks match", () => {
    expect(
      buildBookmarkSuggestions([], "focused", ancestors, descendants, { includeCurrent: false }),
    ).toEqual([]);
  });
});
