import { expect, test } from "bun:test";
import { parseCliOptions } from "../src/cliOptions.ts";

test("parseCliOptions recognizes startup flags", () => {
  expect(parseCliOptions(["--long-flags", "--repo", "../repo"])).toEqual({
    explicitRepoPath: "../repo",
    sampleName: undefined,
    useLongFlags: true,
  });

  expect(parseCliOptions(["--sample=fixture"])).toEqual({
    explicitRepoPath: undefined,
    sampleName: "fixture",
    useLongFlags: false,
  });
});