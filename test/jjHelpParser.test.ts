import { describe, expect, test } from "bun:test";
import { parseJjHelp, type JjHelp } from "../src/jj/help.ts";

// Compact `jj -h` text, captured from jj 0.42.0. These fixtures intentionally
// preserve clap's column alignment and description wrapping so the parser is
// exercised against the real shapes it must tolerate.

const TOP_LEVEL = `Jujutsu (An experimental VCS)

Usage: jj [OPTIONS] <COMMAND>

Commands:
  abandon           Abandon a revision
  bookmark          Manage bookmarks [default alias: b]
  describe          Update the change description or other metadata [default alias: desc]
  log               Show revision history
  operation         Commands for working with the operation log [aliases: op]

Options:
  -h, --help     Print help (see a summary with '-h')
  -V, --version  Print version

Global Options:
  -R, --repository <REPOSITORY>  Path to repository to operate on
      --color <WHEN>             When to colorize output [possible values: always, never, debug,
                                 auto]
`;

const LOG = `Show revision history

Usage: jj log [OPTIONS] [FILESETS]...

Arguments:
  [FILESETS]...  Show revisions modifying the given paths

Options:
  -r, --revision <REVSETS>   Which revisions to show
  -n, --limit <LIMIT>        Limit number of revisions to show
      --reversed             Show revisions in the opposite order (older revisions first)
  -G, --no-graph             Don't show the graph, show a flat list of revisions
  -T, --template <TEMPLATE>  Render each revision using the given template
  -p, --patch                Show patch
  -h, --help                 Print help (see more with '--help')

Global Options:
  -R, --repository <REPOSITORY>      Path to repository to operate on
      --color <WHEN>                 When to colorize output [possible values: always, never, debug,
                                     auto]
`;

const BOOKMARK = `Manage bookmarks [default alias: b]

Usage: jj bookmark [OPTIONS] <COMMAND>

Commands:
  create   Create a new bookmark [aliases: c]
  delete   Delete an existing bookmark and propagate the deletion to remotes on the next push
           [aliases: d]
  set      Create a new bookmark, or update an existing one by name [aliases: s]

Options:
  -h, --help  Print help (see more with '--help')
`;

const BOOKMARK_SET = `Create a new bookmark, or update an existing one by name

Usage: jj bookmark set [OPTIONS] <NAMES>...

Arguments:
  <NAMES>...  The bookmarks to update

Options:
  -r, --revision <REVSET>  The bookmark's target revision [default: @] [aliases: --to]
  -B, --allow-backwards    Allow moving the bookmark backwards or sideways
  -h, --help               Print help (see more with '--help')
`;

const DESCRIBE = `Update the change description or other metadata [default alias: desc]

Usage: jj describe [OPTIONS] [REVSETS]...

Arguments:
  [REVSETS]...  The revision(s) whose description to edit (default: @) [aliases: -r]

Options:
  -m, --message <MESSAGE>  The change description to use (don't open editor)
      --stdin              Read the change description from stdin
  -h, --help               Print help (see more with '--help')
`;

const flag = (help: JjHelp, long: string) =>
  help.flags.find((f) => f.long === long);

describe("parseJjHelp: top-level", () => {
  const help = parseJjHelp(TOP_LEVEL);

  test("is a group with subcommands", () => {
    expect(help.kind).toBe("group");
    expect(help.hasSubcommands).toBe(true);
    expect(help.subcommands.map((s) => s.name)).toEqual([
      "abandon",
      "bookmark",
      "describe",
      "log",
      "operation",
    ]);
  });

  test("captures subcommand descriptions and aliases (default + plain)", () => {
    const bookmark = help.subcommands.find((s) => s.name === "bookmark")!;
    expect(bookmark.description).toBe("Manage bookmarks");
    expect(bookmark.aliases).toEqual(["b"]);

    const op = help.subcommands.find((s) => s.name === "operation")!;
    expect(op.aliases).toEqual(["op"]);
  });

  test("keeps -h/--help and -V/--version as real flags", () => {
    expect(flag(help, "--help")).toMatchObject({ short: "-h", long: "--help" });
    expect(flag(help, "--version")).toMatchObject({ short: "-V", long: "--version" });
  });
});

describe("parseJjHelp: leaf command (log)", () => {
  const help = parseJjHelp(LOG);

  test("is a leaf", () => {
    expect(help.kind).toBe("leaf");
    expect(help.hasSubcommands).toBe(false);
    expect(help.subcommands).toEqual([]);
  });

  test("parses short/long/value-token flags", () => {
    expect(flag(help, "--revision")).toMatchObject({
      short: "-r",
      long: "--revision",
      valueToken: "REVSETS",
      description: "Which revisions to show",
    });
    expect(flag(help, "--reversed")).toMatchObject({
      short: undefined,
      long: "--reversed",
      valueToken: undefined,
    });
  });

  test("joins wrapped possible-values across continuation lines", () => {
    const color = flag(help, "--color")!;
    expect(color.valueToken).toBe("WHEN");
    expect(color.possibleValues).toEqual(["always", "never", "debug", "auto"]);
    expect(color.description).toBe("When to colorize output");
  });

  test("keeps the help flag", () => {
    expect(flag(help, "--help")).toMatchObject({ short: "-h", long: "--help" });
  });

  test("parses an optional variadic positional", () => {
    expect(help.positionals).toEqual([
      {
        token: "FILESETS",
        optional: true,
        variadic: true,
        description: "Show revisions modifying the given paths",
      },
    ]);
  });
});

describe("parseJjHelp: group with wrapped command alias (bookmark)", () => {
  const help = parseJjHelp(BOOKMARK);

  test("is a group", () => {
    expect(help.kind).toBe("group");
    expect(help.subcommands.map((s) => s.name)).toEqual(["create", "delete", "set"]);
  });

  test("joins a wrapped subcommand description and its alias", () => {
    const del = help.subcommands.find((s) => s.name === "delete")!;
    expect(del.aliases).toEqual(["d"]);
    expect(del.description).toBe(
      "Delete an existing bookmark and propagate the deletion to remotes on the next push",
    );
  });
});

describe("parseJjHelp: required variadic positional + flag annotations (bookmark set)", () => {
  const help = parseJjHelp(BOOKMARK_SET);

  test("is a leaf with a required variadic positional", () => {
    expect(help.kind).toBe("leaf");
    expect(help.positionals).toEqual([
      { token: "NAMES", optional: false, variadic: true, description: "The bookmarks to update" },
    ]);
  });

  test("strips [default: ...] and [aliases: ...] from the flag description", () => {
    expect(flag(help, "--revision")).toMatchObject({
      short: "-r",
      valueToken: "REVSET",
      description: "The bookmark's target revision",
    });
  });
});

describe("parseJjHelp: positional aliases are stripped (describe)", () => {
  const help = parseJjHelp(DESCRIBE);

  test("strips a trailing [aliases: -r] from a positional description", () => {
    expect(help.positionals).toEqual([
      {
        token: "REVSETS",
        optional: true,
        variadic: true,
        description: "The revision(s) whose description to edit (default: @)",
      },
    ]);
  });

  test("captures the message flag value token", () => {
    expect(flag(help, "--message")).toMatchObject({ short: "-m", valueToken: "MESSAGE" });
  });
});

describe("parseJjHelp: graceful failure", () => {
  test("returns an empty leaf model for garbage input", () => {
    const help = parseJjHelp("not help text at all\nrandom line");
    expect(help.subcommands).toEqual([]);
    expect(help.flags).toEqual([]);
    expect(help.positionals).toEqual([]);
  });

  test("returns an empty model for empty input without throwing", () => {
    expect(() => parseJjHelp("")).not.toThrow();
  });
});
