import { expect, test } from "bun:test";
import {
  buildSampleRepoCliCommand,
  parseSampleRepoCliOutput,
} from "../src/dev/sampleRepoLauncher.ts";

test("buildSampleRepoCliCommand includes bun, script, and sample arguments", () => {
  expect(buildSampleRepoCliCommand({
    bunPath: "/usr/local/bin/bun",
    scriptPath: "/repo/scripts/materializeSampleRepoCli.ts",
    baseDir: "/tmp/sample",
    fixturePath: "/repo/test/fixtures/sample-repo.jsonl",
  })).toEqual([
    "/usr/local/bin/bun",
    "run",
    "/repo/scripts/materializeSampleRepoCli.ts",
    "--base-dir",
    "/tmp/sample",
    "--fixture-path",
    "/repo/test/fixtures/sample-repo.jsonl",
  ]);
});

test("parseSampleRepoCliOutput returns sample repo paths", () => {
  expect(parseSampleRepoCliOutput(JSON.stringify({
    repoPath: "/tmp/sample/repo",
    workspacePaths: {
      default: "/tmp/sample/repo",
      review: "/tmp/sample/review-workspace",
    },
  }))).toEqual({
    repoPath: "/tmp/sample/repo",
    workspacePaths: {
      default: "/tmp/sample/repo",
      review: "/tmp/sample/review-workspace",
    },
  });
});