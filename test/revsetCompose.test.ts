import { expect, test } from "bun:test";
import { unionRevsetWithCommits } from "../src/revset/compose.ts";

test("unionRevsetWithCommits wraps each commit in present() and parenthesizes the base", () => {
  expect(unionRevsetWithCommits("mine()", ["1111", "2222"])).toBe(
    "(mine()) | present(1111) | present(2222)",
  );
});

test("unionRevsetWithCommits returns the base untouched for no commits", () => {
  expect(unionRevsetWithCommits("mine()", [])).toBe("mine()");
});
