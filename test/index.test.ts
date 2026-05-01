import { expect, test } from "bun:test";
import { parseCliOptions } from "../src/cliOptions.ts";

test("parseCliOptions recognizes startup flags", () => {
  expect(parseCliOptions(["--long-flags", "--repo", "../repo"])).toEqual({
    command: "run",
    explicitRepoPath: "../repo",
    sampleName: undefined,
    useLongFlags: true,
  });

  expect(parseCliOptions(["--sample=fixture"])).toEqual({
    command: "run",
    explicitRepoPath: undefined,
    sampleName: "fixture",
    useLongFlags: false,
  });

  expect(parseCliOptions(["init-config"])).toEqual({
    command: "init-config",
    explicitRepoPath: undefined,
    sampleName: undefined,
    useLongFlags: false,
  });
});