import { expect, test } from "bun:test";
import { parseCliOptions } from "../src/cliOptions.ts";

test("parseCliOptions recognizes startup flags", () => {
  expect(parseCliOptions(["--long-flags", "--repo", "../repo"])).toEqual({
    command: "run",
    explicitRepoPath: "../repo",
    sampleName: undefined,
    useLongFlags: true,
    configReplacement: undefined,
    configBaseLayers: [],
    configOverrideLayers: [],
  });

  expect(parseCliOptions(["--sample=fixture"])).toEqual({
    command: "run",
    explicitRepoPath: undefined,
    sampleName: "fixture",
    useLongFlags: false,
    configReplacement: undefined,
    configBaseLayers: [],
    configOverrideLayers: [],
  });

  expect(parseCliOptions(["init-config"])).toEqual({
    command: "init-config",
    explicitRepoPath: undefined,
    sampleName: undefined,
    useLongFlags: false,
    configReplacement: undefined,
    configBaseLayers: [],
    configOverrideLayers: [],
  });
});

test("parseCliOptions parses --config replacement (space and equals forms)", () => {
  expect(parseCliOptions(["--config", "foo.ts"]).configReplacement).toBe("foo.ts");
  expect(parseCliOptions(["--config=foo.ts"]).configReplacement).toBe("foo.ts");
});

test("parseCliOptions throws on duplicate --config", () => {
  expect(() => parseCliOptions(["--config", "a.ts", "--config", "b.ts"])).toThrow();
});

test("parseCliOptions collects repeated --config-base in argv order", () => {
  const opts = parseCliOptions(["--config-base", "a.ts", "--config-base=b.ts"]);
  expect(opts.configBaseLayers).toEqual(["a.ts", "b.ts"]);
  expect(opts.configOverrideLayers).toEqual([]);
});

test("parseCliOptions collects repeated --config-override in argv order", () => {
  const opts = parseCliOptions(["--config-override=a.ts", "--config-override", "b.ts"]);
  expect(opts.configOverrideLayers).toEqual(["a.ts", "b.ts"]);
  expect(opts.configBaseLayers).toEqual([]);
});

test("parseCliOptions keeps base and override lists independent and ordered", () => {
  const opts = parseCliOptions([
    "--config-override", "x.ts",
    "--config-base", "a.ts",
    "--config-override", "y.ts",
    "--config-base", "b.ts",
  ]);
  expect(opts.configBaseLayers).toEqual(["a.ts", "b.ts"]);
  expect(opts.configOverrideLayers).toEqual(["x.ts", "y.ts"]);
});

test("parseCliOptions throws when --config-base has no value", () => {
  expect(() => parseCliOptions(["--config-base"])).toThrow();
});

test("parseCliOptions accepts layer flags under init-config without affecting command", () => {
  const opts = parseCliOptions(["init-config", "--config-base", "a.ts"]);
  expect(opts.command).toBe("init-config");
  expect(opts.configBaseLayers).toEqual(["a.ts"]);
});
