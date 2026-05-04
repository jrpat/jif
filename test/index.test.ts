import { expect, test } from "bun:test";
import { parseCommand } from "../src/cliOptions.ts";

test("default command is run with no flags", () => {
  expect(parseCommand([])).toEqual({
    kind: "run",
    options: {
      explicitRepoPath: undefined,
      sampleName: undefined,
      useLongFlags: false,
      configReplacement: undefined,
      configBaseLayers: [],
      configOverrideLayers: [],
    },
  });
});

test("run command parses startup flags", () => {
  expect(parseCommand(["--long-flags", "--repo", "../repo"])).toEqual({
    kind: "run",
    options: {
      explicitRepoPath: "../repo",
      sampleName: undefined,
      useLongFlags: true,
      configReplacement: undefined,
      configBaseLayers: [],
      configOverrideLayers: [],
    },
  });

  expect(parseCommand(["--sample=fixture"])).toEqual({
    kind: "run",
    options: {
      explicitRepoPath: undefined,
      sampleName: "fixture",
      useLongFlags: false,
      configReplacement: undefined,
      configBaseLayers: [],
      configOverrideLayers: [],
    },
  });
});

test("run command parses --config replacement (space and equals forms)", () => {
  expect(parseCommand(["--config", "foo.ts"])).toEqual({
    kind: "run",
    options: expect.objectContaining({ configReplacement: "foo.ts" }),
  });
  expect(parseCommand(["--config=foo.ts"])).toEqual({
    kind: "run",
    options: expect.objectContaining({ configReplacement: "foo.ts" }),
  });
});

test("run command throws on duplicate --config", () => {
  expect(() => parseCommand(["--config", "a.ts", "--config", "b.ts"])).toThrow();
});

test("run command collects repeated --config-base in argv order", () => {
  const cmd = parseCommand(["--config-base", "a.ts", "--config-base=b.ts"]);
  if (cmd.kind !== "run") throw new Error("expected run");
  expect(cmd.options.configBaseLayers).toEqual(["a.ts", "b.ts"]);
  expect(cmd.options.configOverrideLayers).toEqual([]);
});

test("run command collects repeated --config-override in argv order", () => {
  const cmd = parseCommand(["--config-override=a.ts", "--config-override", "b.ts"]);
  if (cmd.kind !== "run") throw new Error("expected run");
  expect(cmd.options.configOverrideLayers).toEqual(["a.ts", "b.ts"]);
  expect(cmd.options.configBaseLayers).toEqual([]);
});

test("run command keeps base and override lists independent and ordered", () => {
  const cmd = parseCommand([
    "--config-override", "x.ts",
    "--config-base", "a.ts",
    "--config-override", "y.ts",
    "--config-base", "b.ts",
  ]);
  if (cmd.kind !== "run") throw new Error("expected run");
  expect(cmd.options.configBaseLayers).toEqual(["a.ts", "b.ts"]);
  expect(cmd.options.configOverrideLayers).toEqual(["x.ts", "y.ts"]);
});

test("run command throws when --config-base has no value", () => {
  expect(() => parseCommand(["--config-base"])).toThrow();
});

test("init config dispatches to init-config kind with default options", () => {
  expect(parseCommand(["init", "config"])).toEqual({
    kind: "init-config",
    options: {
      project: false,
      projectStartDir: undefined,
    },
  });
});

test("init config -p enables project mode without a path", () => {
  expect(parseCommand(["init", "config", "-p"])).toEqual({
    kind: "init-config",
    options: {
      project: true,
      projectStartDir: undefined,
    },
  });

  expect(parseCommand(["init", "config", "--project"])).toEqual({
    kind: "init-config",
    options: {
      project: true,
      projectStartDir: undefined,
    },
  });
});

test("init config -p <path> records the start directory", () => {
  expect(parseCommand(["init", "config", "-p", "/some/dir"])).toEqual({
    kind: "init-config",
    options: {
      project: true,
      projectStartDir: "/some/dir",
    },
  });

  expect(parseCommand(["init", "config", "--project", "subdir"])).toEqual({
    kind: "init-config",
    options: {
      project: true,
      projectStartDir: "subdir",
    },
  });
});

test("init config rejects a positional path without --project", () => {
  expect(() => parseCommand(["init", "config", "/some/dir"])).toThrow();
});

test("init config rejects unknown flags", () => {
  expect(() => parseCommand(["init", "config", "--config-base", "a.ts"])).toThrow();
});

test("init alone (without subcommand) throws", () => {
  expect(() => parseCommand(["init"])).toThrow();
  expect(() => parseCommand(["init", "bogus"])).toThrow();
});
