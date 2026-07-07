import { expect, test } from "bun:test";
import { formatUsageText, parseCommand } from "../src/cliOptions.ts";
import { main } from "../src/index.ts";

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

test("help flags dispatch to the help command", () => {
  expect(parseCommand(["-h"])).toEqual({ kind: "help" });
  expect(parseCommand(["--help"])).toEqual({ kind: "help" });
});

test("usage text documents options and subcommands", () => {
  const usage = formatUsageText();

  expect(usage).toContain("Usage: jif");
  expect(usage).toContain("-h, --help");
  expect(usage).toContain("--version");
  expect(usage).not.toContain("--sample");
  expect(usage).toContain("Subcommands:");
  expect(usage).toContain("init-config");
});

test("--version dispatches to the version command", () => {
  expect(parseCommand(["--version"])).toEqual({ kind: "version" });
});

test("help wins when both --help and --version are passed", () => {
  expect(parseCommand(["--help", "--version"])).toEqual({ kind: "help" });
  expect(parseCommand(["--version", "-h"])).toEqual({ kind: "help" });
});

test("main prints the version for --version", async () => {
  const originalLog = console.log;
  const originalVersion = process.env.JIF_VERSION;
  const output: string[] = [];
  console.log = (...args: unknown[]) => {
    output.push(args.join(" "));
  };
  process.env.JIF_VERSION = "9.9.9";

  try {
    await main(["--version"]);
  } finally {
    console.log = originalLog;
    if (originalVersion === undefined) {
      delete process.env.JIF_VERSION;
    } else {
      process.env.JIF_VERSION = originalVersion;
    }
  }

  expect(output.join("\n")).toBe("jif 9.9.9");
});

test("main prints usage for --help", async () => {
  const originalLog = console.log;
  const output: string[] = [];
  console.log = (...args: unknown[]) => {
    output.push(args.join(" "));
  };

  try {
    await main(["--help"]);
  } finally {
    console.log = originalLog;
  }

  expect(output.join("\n")).toContain("Subcommands:");
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

test("init-config dispatches to init-config kind with default options", () => {
  expect(parseCommand(["init-config"])).toEqual({
    kind: "init-config",
    options: {
      project: false,
      projectStartDir: undefined,
    },
  });
});

test("init-config -p enables project mode without a path", () => {
  expect(parseCommand(["init-config", "-p"])).toEqual({
    kind: "init-config",
    options: {
      project: true,
      projectStartDir: undefined,
    },
  });

  expect(parseCommand(["init-config", "--project"])).toEqual({
    kind: "init-config",
    options: {
      project: true,
      projectStartDir: undefined,
    },
  });
});

test("init-config -p <path> records the start directory", () => {
  expect(parseCommand(["init-config", "-p", "/some/dir"])).toEqual({
    kind: "init-config",
    options: {
      project: true,
      projectStartDir: "/some/dir",
    },
  });

  expect(parseCommand(["init-config", "--project", "subdir"])).toEqual({
    kind: "init-config",
    options: {
      project: true,
      projectStartDir: "subdir",
    },
  });
});

test("init-config rejects a positional path without --project", () => {
  expect(() => parseCommand(["init-config", "/some/dir"])).toThrow();
});

test("init-config rejects unknown flags", () => {
  expect(() => parseCommand(["init-config", "--config-base", "a.ts"])).toThrow();
});
