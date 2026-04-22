import { expect, test } from "bun:test";
import { getChangeIdFromRevisionId, getRevisionArg, isDivergentRevisionId } from "../src/domain/revisionIds.ts";

test("getChangeIdFromRevisionId returns the base id for non-divergent revisions", () => {
  expect(getChangeIdFromRevisionId("abcdefgh")).toBe("abcdefgh");
});

test("getChangeIdFromRevisionId strips the divergent suffix", () => {
  expect(getChangeIdFromRevisionId("abcdefgh/1")).toBe("abcdefgh");
});

test("isDivergentRevisionId detects change offsets", () => {
  expect(isDivergentRevisionId("abcdefgh")).toBeFalse();
  expect(isDivergentRevisionId("abcdefgh/0")).toBeTrue();
});

test("getRevisionArg returns the shortest unique prefix for non-divergent revisions", () => {
  expect(getRevisionArg("abcdefgh", 3)).toBe("abc");
});

test("getRevisionArg keeps the full revision id for divergent revisions", () => {
  expect(getRevisionArg("abcdefgh/1", 3)).toBe("abcdefgh/1");
});