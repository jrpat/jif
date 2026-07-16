import { describe, expect, test } from "bun:test";
import type { JjHelp } from "../src/jj/help.ts";
import type { ComposeContext } from "../src/commands/compose-context.ts";
import { resolveComposeContext } from "../src/commands/compose-context.ts";
import {
  buildComposeItems,
  computeComposeAccept,
} from "../src/commands/compose-completions.ts";
import type { CompletionItem } from "../src/revset/completions.ts";

const TOP: JjHelp = {
  kind: "group",
  hasSubcommands: true,
  subcommands: [
    { name: "log", aliases: [], description: "Show revision history" },
    { name: "bookmark", aliases: ["b"], description: "Manage bookmarks" },
    { name: "git", aliases: [], description: "Manage Git remotes" },
    { name: "util", aliases: [], description: "Infrequently used commands" },
  ],
  flags: [],
  positionals: [],
};

// Commands chosen so the typed alias coincidentally fuzzy-matches a *different*
// command's name (e.g. `b` matches "bisect", `ci` matches "config"). The alias
// must still win so the alias is treated as the command it names, not as a
// stray substring. `quux` carries an alias that is not a subsequence of its
// name, proving aliases are matched at all (not just re-ranked).
const TOP_ALIASES: JjHelp = {
  kind: "group",
  hasSubcommands: true,
  subcommands: [
    { name: "bisect", aliases: [], description: "Find a bad revision" },
    { name: "bookmark", aliases: ["b"], description: "Manage bookmarks" },
    { name: "commit", aliases: ["ci"], description: "Update and create a change" },
    { name: "config", aliases: [], description: "Manage config" },
    { name: "quux", aliases: ["zz"], description: "Unrelated command" },
  ],
  flags: [],
  positionals: [],
};

const LOG: JjHelp = {
  kind: "leaf",
  hasSubcommands: false,
  subcommands: [],
  flags: [
    { short: "-r", long: "--revision", valueToken: "REVSETS", description: "Which revisions to show" },
    { short: undefined, long: "--reversed", description: "Reverse order" },
  ],
  positionals: [],
};

const BOOKMARK_SET: JjHelp = {
  kind: "leaf",
  hasSubcommands: false,
  subcommands: [],
  flags: [{ short: "-r", long: "--revision", valueToken: "REVSET", description: "Target" }],
  positionals: [{ token: "NAMES", optional: false, variadic: true, description: "The bookmarks" }],
};

const GIT: JjHelp = {
  kind: "group",
  hasSubcommands: true,
  subcommands: [{ name: "push", aliases: [], description: "Push to a Git remote" }],
  flags: [],
  positionals: [],
};

const GIT_PUSH: JjHelp = {
  kind: "leaf",
  hasSubcommands: false,
  subcommands: [],
  flags: [{ short: "-b", long: "--bookmark", valueToken: "BOOKMARK", description: "Push only this bookmark" }],
  positionals: [],
};

const REVSET_ITEMS: CompletionItem[] = [
  { name: "author", kind: "function", detail: "author(pattern)", hasParameters: true },
  { name: "root", kind: "function", detail: "root()", hasParameters: false },
  { name: "main", kind: "bookmark" },
];

const ctx = (over: Partial<ComposeContext> & Pick<ComposeContext, "kind">): ComposeContext =>
  ({ path: [], partial: "", start: 0, end: 0, ...over }) as ComposeContext;

describe("buildComposeItems", () => {
  test("subcommand rows carry name and description", () => {
    const items = buildComposeItems({
      context: ctx({ kind: "subcommand", partial: "bo" }),
      help: TOP,
      revsetItems: [],
      bookmarks: [],
    });
    const bookmark = items.find((i) => i.id === "sub:bookmark");
    expect(bookmark).toMatchObject({ text: "bookmark", detail: "Manage bookmarks" });
  });

  test("a command alias is recognized and ranked first (b -> bookmark, not bisect)", () => {
    const items = buildComposeItems({
      context: ctx({ kind: "subcommand", partial: "b" }),
      help: TOP_ALIASES,
      revsetItems: [],
      bookmarks: [],
    });
    // Index 0 is the default Tab target (best match). Typing bookmark's alias
    // must complete to bookmark, even though "b" also fuzzy-matches "bisect".
    expect(items[0]).toMatchObject({ id: "sub:bookmark" });
    expect(items.some((i) => i.id === "sub:bisect")).toBe(true);
  });

  test("a command alias outranks an incidental name match (ci -> commit, not config)", () => {
    const items = buildComposeItems({
      context: ctx({ kind: "subcommand", partial: "ci" }),
      help: TOP_ALIASES,
      revsetItems: [],
      bookmarks: [],
    });
    expect(items[0]).toMatchObject({ id: "sub:commit" });
  });

  test("a command is matchable by an alias that is not a subsequence of its name", () => {
    const items = buildComposeItems({
      context: ctx({ kind: "subcommand", partial: "zz" }),
      help: TOP_ALIASES,
      revsetItems: [],
      bookmarks: [],
    });
    expect(items.map((i) => i.id)).toContain("sub:quux");
  });

  test("configured command aliases appear as top-level completions", () => {
    const items = buildComposeItems({
      context: ctx({ kind: "subcommand", partial: "g" }),
      help: TOP,
      revsetItems: [],
      bookmarks: [],
      commandAliases: [{ name: "g", expansion: ["git"] }],
    });
    expect(items[0]).toMatchObject({ id: "cmdalias:g", tag: "al", text: "g", detail: "git" });
  });

  test("multi-token command aliases are suggested when their first token is supported", () => {
    const items = buildComposeItems({
      context: ctx({ kind: "subcommand", partial: "pu" }),
      help: TOP,
      revsetItems: [],
      bookmarks: [],
      commandAliases: [{ name: "pull", expansion: ["git", "fetch"] }],
    });
    expect(items[0]).toMatchObject({ id: "cmdalias:pull", tag: "al", text: "pull", detail: "git fetch" });
  });

  test("unsupported command aliases are not suggested", () => {
    const items = buildComposeItems({
      context: ctx({ kind: "subcommand", partial: "" }),
      help: TOP,
      revsetItems: [],
      bookmarks: [],
      commandAliases: [
        { name: "up", expansion: ["util", "exec", "--", "bash"] },
        { name: "wat", expansion: ["not-a-command"] },
      ],
    });
    expect(items.map((i) => i.id)).not.toContain("cmdalias:up");
    expect(items.map((i) => i.id)).not.toContain("cmdalias:wat");
  });

  test("flag rows render bold long flag, dim short tag, dim description", () => {
    const items = buildComposeItems({
      context: ctx({ kind: "flag-or-subcommand", path: ["log"] }),
      help: LOG,
      revsetItems: [],
      bookmarks: [],
    });
    expect(items.find((i) => i.id === "flag:--revision")).toMatchObject({
      tag: "-r",
      text: "--revision",
      bold: true,
      detail: "Which revisions to show",
    });
    expect(items.find((i) => i.id === "flag:--reversed")).toMatchObject({
      text: "--reversed",
      bold: true,
    });
    expect(items.find((i) => i.id === "flag:--reversed")!.tag).toBeUndefined();
  });

  test("bookmark-leaf flag context also offers bookmark names", () => {
    const items = buildComposeItems({
      context: ctx({ kind: "flag-or-subcommand", path: ["bookmark", "set"] }),
      help: BOOKMARK_SET,
      revsetItems: [],
      bookmarks: ["main", "dev"],
    });
    expect(items.find((i) => i.id === "bmname:main")).toMatchObject({ tag: "bm", text: "main" });
    expect(items.find((i) => i.id === "flag:--revision")).toBeDefined();
  });

  test.each([
    ["bookmark track", "BOOKMARK[@REMOTE]", "Bookmark name patterns or remote bookmark symbols to track"],
    ["bookmark untrack", "BOOKMARK[@REMOTE]", "Bookmark name patterns or remote bookmark symbols to untrack"],
    ["bookmark rename", "OLD", "The old name of the bookmark"],
  ])("%s positional offers bookmark names", (command, token, description) => {
    const items = buildComposeItems({
      context: ctx({ kind: "flag-or-subcommand", path: command.split(" ") }),
      help: {
        kind: "leaf",
        hasSubcommands: false,
        subcommands: [],
        flags: [],
        positionals: [{ token, optional: false, variadic: true, description }],
      },
      revsetItems: [],
      bookmarks: ["main", "feature/ui"],
    });

    expect(items.map((item) => item.id)).toEqual(["bmname:main", "bmname:feature/ui"]);
  });

  test("revset value offers @, @- literals plus revset items", () => {
    const items = buildComposeItems({
      context: ctx({ kind: "value", token: "REVSETS", path: ["log"] } as Partial<ComposeContext> &
        Pick<ComposeContext, "kind">),
      help: LOG,
      revsetItems: REVSET_ITEMS,
      bookmarks: [],
    });
    expect(items.find((i) => i.id === "lit:@")).toBeDefined();
    expect(items.find((i) => i.id === "lit:@-")).toBeDefined();
    expect(items.find((i) => i.id === "fn:author:1")).toBeDefined();
    expect(items.find((i) => i.id === "rev:main")).toMatchObject({ tag: "bm", text: "main" });
  });

  test.each(["git push -b ", "git push --bookmark "])(
    "%s offers bookmark names for its value",
    (text) => {
      const helpFor = (path: readonly string[]) => {
        if (path.length === 0) return TOP;
        if (path.join(" ") === "git") return GIT;
        if (path.join(" ") === "git push") return GIT_PUSH;
        return undefined;
      };
      const context = resolveComposeContext(text, text.length, helpFor);
      const items = buildComposeItems({
        context,
        help: GIT_PUSH,
        revsetItems: [],
        bookmarks: ["main", "feature/ui"],
      });

      expect(context).toMatchObject({ kind: "value", token: "BOOKMARK", path: ["git", "push"] });
      expect(items).toEqual([
        { id: "bmname:main", tag: "bm", text: "main" },
        { id: "bmname:feature/ui", tag: "bm", text: "feature/ui" },
      ]);
    },
  );

  test("enum value offers possible values", () => {
    const items = buildComposeItems({
      context: ctx({
        kind: "value",
        token: "WHEN",
        possibleValues: ["always", "never"],
      } as Partial<ComposeContext> & Pick<ComposeContext, "kind">),
      help: LOG,
      revsetItems: [],
      bookmarks: [],
    });
    expect(items.map((i) => i.id)).toEqual(["enum:always", "enum:never"]);
  });

  test("returns no rows when the model has not loaded", () => {
    const items = buildComposeItems({
      context: ctx({ kind: "flag-or-subcommand", path: ["log"] }),
      help: undefined,
      revsetItems: [],
      bookmarks: [],
    });
    expect(items).toEqual([]);
  });
});

describe("computeComposeAccept", () => {
  test("subcommand inserts the name and a trailing space", () => {
    expect(
      computeComposeAccept({
        text: "bo",
        context: ctx({ kind: "subcommand", partial: "bo", start: 0, end: 2 }),
        item: { id: "sub:bookmark", text: "bookmark" },
      }),
    ).toEqual({ text: "bookmark ", cursorOffset: 9 });
  });

  test("command alias inserts the alias and a trailing space", () => {
    expect(
      computeComposeAccept({
        text: "pu",
        context: ctx({ kind: "subcommand", partial: "pu", start: 0, end: 2 }),
        item: { id: "cmdalias:pull", tag: "al", text: "pull", detail: "git fetch" },
      }),
    ).toEqual({ text: "pull ", cursorOffset: 5 });
  });

  test("flag inserts the long flag and a trailing space", () => {
    expect(
      computeComposeAccept({
        text: "log ",
        context: ctx({ kind: "flag-or-subcommand", path: ["log"], start: 4, end: 4 }),
        item: { id: "flag:--revision", text: "--revision", bold: true },
      }),
    ).toEqual({ text: "log --revision ", cursorOffset: 15 });
  });

  test("literal value inserts with a trailing space", () => {
    expect(
      computeComposeAccept({
        text: "log -r ",
        context: ctx({ kind: "value", token: "REVSETS", start: 7, end: 7 } as Partial<ComposeContext> &
          Pick<ComposeContext, "kind">),
        item: { id: "lit:@", text: "@" },
      }),
    ).toEqual({ text: "log -r @ ", cursorOffset: 9 });
  });

  test("revset function with parameters inserts an open paren and no trailing space", () => {
    expect(
      computeComposeAccept({
        text: "log -r ",
        context: ctx({ kind: "value", token: "REVSETS", start: 7, end: 7 } as Partial<ComposeContext> &
          Pick<ComposeContext, "kind">),
        item: { id: "fn:author:1", text: "author" },
      }),
    ).toEqual({ text: "log -r author(", cursorOffset: 14 });
  });

  test("revset function without parameters inserts empty parens", () => {
    expect(
      computeComposeAccept({
        text: "log -r ",
        context: ctx({ kind: "value", token: "REVSETS", start: 7, end: 7 } as Partial<ComposeContext> &
          Pick<ComposeContext, "kind">),
        item: { id: "fn:root:0", text: "root" },
      }),
    ).toEqual({ text: "log -r root()", cursorOffset: 13 });
  });

  test("replaces the existing partial token span", () => {
    expect(
      computeComposeAccept({
        text: "log -r @",
        context: ctx({ kind: "value", token: "REVSETS", partial: "@", start: 7, end: 8 } as Partial<ComposeContext> &
          Pick<ComposeContext, "kind">),
        item: { id: "rev:main", text: "main" },
      }),
    ).toEqual({ text: "log -r main ", cursorOffset: 12 });
  });

  test("quotes a bookmark name that needs quoting", () => {
    const result = computeComposeAccept({
      text: "bookmark set ",
      context: ctx({ kind: "flag-or-subcommand", path: ["bookmark", "set"], start: 13, end: 13 }),
      item: { id: "bmname:feature branch", text: "feature branch" },
    });
    expect(result.text).toBe('bookmark set "feature branch" ');
  });
});
