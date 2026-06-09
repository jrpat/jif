import { describe, expect, test } from "bun:test";
import type { JjHelp } from "../src/jj/help.ts";
import {
  resolveComposeContext,
  tokenizeWithSpans,
} from "../src/commands/compose-context.ts";

// Hand-built models keyed by command path, standing in for the help cache.
const MODELS: Record<string, JjHelp> = {
  "": {
    kind: "group",
    hasSubcommands: true,
    subcommands: [
      { name: "log", aliases: [], description: "" },
      { name: "bookmark", aliases: ["b"], description: "" },
      { name: "describe", aliases: ["desc"], description: "" },
      { name: "git", aliases: [], description: "" },
    ],
    flags: [],
    positionals: [],
  },
  log: {
    kind: "leaf",
    hasSubcommands: false,
    subcommands: [],
    flags: [
      { short: "-r", long: "--revision", valueToken: "REVSETS", description: "" },
      { short: undefined, long: "--reversed", description: "" },
      { short: undefined, long: "--color", valueToken: "WHEN", possibleValues: ["always", "never"], description: "" },
    ],
    positionals: [{ token: "FILESETS", optional: true, variadic: true, description: "" }],
  },
  bookmark: {
    kind: "group",
    hasSubcommands: true,
    subcommands: [
      { name: "set", aliases: ["s"], description: "" },
      { name: "delete", aliases: ["d"], description: "" },
    ],
    flags: [],
    positionals: [],
  },
  "bookmark set": {
    kind: "leaf",
    hasSubcommands: false,
    subcommands: [],
    flags: [{ short: "-r", long: "--revision", valueToken: "REVSET", description: "" }],
    positionals: [{ token: "NAMES", optional: false, variadic: true, description: "" }],
  },
  describe: {
    kind: "leaf",
    hasSubcommands: false,
    subcommands: [],
    flags: [{ short: "-m", long: "--message", valueToken: "MESSAGE", description: "" }],
    positionals: [{ token: "REVSETS", optional: true, variadic: true, description: "" }],
  },
  git: { kind: "group", hasSubcommands: true, subcommands: [], flags: [], positionals: [] },
};

const helpFor = (path: readonly string[]): JjHelp | undefined => MODELS[path.join(" ")];

const resolve = (text: string, cursor = text.length) =>
  resolveComposeContext(text, cursor, helpFor);

describe("tokenizeWithSpans", () => {
  test("tracks offsets for plain tokens", () => {
    expect(tokenizeWithSpans("log -r @")).toEqual([
      { value: "log", start: 0, end: 3, quoted: false },
      { value: "-r", start: 4, end: 6, quoted: false },
      { value: "@", start: 7, end: 8, quoted: false },
    ]);
  });

  test("keeps a quoted segment together and marks it quoted", () => {
    const tokens = tokenizeWithSpans('describe -m "hi there"');
    expect(tokens[2]).toEqual({ value: "hi there", start: 12, end: 22, quoted: true });
  });

  test("handles an unterminated quote running to end of input", () => {
    const tokens = tokenizeWithSpans('describe -m "hi ');
    expect(tokens[2]).toEqual({ value: "hi ", start: 12, end: 16, quoted: true });
  });
});

describe("resolveComposeContext: subcommands", () => {
  test("empty input completes top-level subcommands", () => {
    expect(resolve("")).toMatchObject({ kind: "subcommand", path: [], partial: "", start: 0, end: 0 });
  });

  test("partial first token completes top-level subcommands", () => {
    expect(resolve("lo")).toMatchObject({ kind: "subcommand", path: [], partial: "lo", start: 0, end: 2 });
    expect(resolve("log")).toMatchObject({ kind: "subcommand", path: [], partial: "log", start: 0, end: 3 });
  });

  test("trailing space after a group lists its subcommands", () => {
    expect(resolve("bookmark ")).toMatchObject({ kind: "subcommand", path: ["bookmark"], partial: "" });
    expect(resolve("bookmark se")).toMatchObject({ kind: "subcommand", path: ["bookmark"], partial: "se" });
    expect(resolve("git ")).toMatchObject({ kind: "subcommand", path: ["git"], partial: "" });
  });

  test("resolves a subcommand alias when descending", () => {
    expect(resolve("b set ")).toMatchObject({ kind: "flag-or-subcommand", path: ["bookmark", "set"] });
  });
});

describe("resolveComposeContext: flag-or-subcommand", () => {
  test("trailing space after a leaf subcommand lists flags", () => {
    expect(resolve("log ")).toMatchObject({ kind: "flag-or-subcommand", path: ["log"], partial: "" });
  });

  test("a dash starts flag completion", () => {
    expect(resolve("log -")).toMatchObject({ kind: "flag-or-subcommand", path: ["log"], partial: "-", start: 4, end: 5 });
    expect(resolve("log --rev")).toMatchObject({ kind: "flag-or-subcommand", path: ["log"], partial: "--rev" });
  });

  test("a leaf under a group still lists flags", () => {
    expect(resolve("bookmark set ")).toMatchObject({
      kind: "flag-or-subcommand",
      path: ["bookmark", "set"],
      partial: "",
    });
  });
});

describe("resolveComposeContext: values", () => {
  test("a value-taking flag followed by a space completes its token", () => {
    expect(resolve("log -r ")).toMatchObject({ kind: "value", token: "REVSETS", path: ["log"], partial: "" });
  });

  test("passes through possible values for enum tokens", () => {
    expect(resolve("log --color ")).toMatchObject({
      kind: "value",
      token: "WHEN",
      possibleValues: ["always", "never"],
    });
  });

  test("a partially typed value keeps its span for replacement", () => {
    expect(resolve("log -r @")).toMatchObject({ kind: "value", token: "REVSETS", partial: "@", start: 7, end: 8 });
  });

  test("--flag=value form completes the value after the equals", () => {
    const ctx = resolve("log --revision=ma");
    expect(ctx).toMatchObject({ kind: "value", token: "REVSETS", partial: "ma" });
    expect(ctx.start).toBe("log --revision=".length);
    expect(ctx.end).toBe("log --revision=ma".length);
  });

  test("nested leaf value flag resolves under its group path", () => {
    expect(resolve("bookmark set -r ")).toMatchObject({ kind: "value", token: "REVSET", path: ["bookmark", "set"] });
  });

  test("an already-satisfied value flag returns to flag completion", () => {
    expect(resolve("log -r @ ")).toMatchObject({ kind: "flag-or-subcommand", path: ["log"], partial: "" });
  });

  test("a boolean flag does not trigger value completion", () => {
    expect(resolve("log --reversed ")).toMatchObject({ kind: "flag-or-subcommand", path: ["log"] });
  });

  test("an unterminated quoted value keeps the deferred token kind", () => {
    expect(resolve('describe -m "hi ')).toMatchObject({ kind: "value", token: "MESSAGE", path: ["describe"] });
  });
});

describe("resolveComposeContext: unloaded models", () => {
  const emptyHelp = (): JjHelp | undefined => undefined;

  test("falls back to subcommand at the root when no model is loaded", () => {
    expect(resolveComposeContext("lo", 2, emptyHelp)).toMatchObject({ kind: "subcommand", path: [] });
  });

  test("falls back to flag-or-subcommand for a deeper unknown path", () => {
    // top-level model present, but bookmark's model not yet loaded
    const partial = (path: readonly string[]): JjHelp | undefined =>
      path.length === 0 ? MODELS[""] : undefined;
    expect(resolveComposeContext("bookmark set ", 13, partial)).toMatchObject({
      kind: "flag-or-subcommand",
      path: ["bookmark"],
    });
  });
});
