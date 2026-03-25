import { describe, expect, test } from "bun:test";
import {
  buildCompletionItems,
  extractLastToken,
  matchCompletions,
  REVSET_FUNCTIONS,
  type CompletionItem,
} from "../src/revset/completions.ts";

describe("extractLastToken", () => {
  test("extracts full input when no delimiters", () => {
    expect(extractLastToken("ancestors")).toEqual({ start: 0, token: "ancestors" });
  });

  test("extracts token after space", () => {
    expect(extractLastToken("foo | bar")).toEqual({ start: 6, token: "bar" });
  });

  test("extracts token after open paren", () => {
    expect(extractLastToken("ancestors(trunk")).toEqual({ start: 10, token: "trunk" });
  });

  test("returns empty token when input ends with delimiter", () => {
    expect(extractLastToken("ancestors(")).toEqual({ start: 10, token: "" });
  });

  test("extracts token after comma", () => {
    expect(extractLastToken("reachable(srcs,domain")).toEqual({ start: 15, token: "domain" });
  });

  test("extracts token after colon", () => {
    expect(extractLastToken("x::y")).toEqual({ start: 3, token: "y" });
  });

  test("handles empty input", () => {
    expect(extractLastToken("")).toEqual({ start: 0, token: "" });
  });
});

describe("buildCompletionItems", () => {
  test("merges all sources", () => {
    const items = buildCompletionItems(
      ["main", "feature/foo"],
      ["v1.0"],
      { trunk: "main" },
    );

    const kinds = new Set(items.map((i) => i.kind));
    expect(kinds).toEqual(new Set(["function", "bookmark", "tag", "alias"]));
    expect(items.find((i) => i.name === "main" && i.kind === "bookmark")).toBeDefined();
    expect(items.find((i) => i.name === "v1.0" && i.kind === "tag")).toBeDefined();
    expect(items.find((i) => i.name === "trunk" && i.kind === "alias")).toBeDefined();
    expect(items.filter((i) => i.kind === "function").length).toBe(REVSET_FUNCTIONS.length);
  });
});

describe("matchCompletions", () => {
  const items: CompletionItem[] = [
    { name: "ancestors", kind: "function" },
    { name: "author", kind: "function" },
    { name: "bookmarks", kind: "function" },
    { name: "main", kind: "bookmark" },
    { name: "feature/auth", kind: "bookmark" },
  ];

  test("returns all items in input order for empty token", () => {
    const results = matchCompletions("", items);
    expect(results.length).toBe(items.length);
    expect(results[0]!.name).toBe("ancestors");
    expect(results[results.length - 1]!.name).toBe("feature/auth");
  });

  test("filters by fuzzy match", () => {
    const results = matchCompletions("anc", items);
    expect(results.length).toBe(1);
    expect(results[0]!.name).toBe("ancestors");
  });

  test("best match is first in array", () => {
    const results = matchCompletions("au", items);
    expect(results[0]!.name).toBe("author");
  });

  test("returns all matches", () => {
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      name: `item${i}`,
      kind: "bookmark" as const,
    }));
    const results = matchCompletions("item", manyItems);
    expect(results.length).toBe(20);
  });

  test("returns empty for no matches", () => {
    const results = matchCompletions("zzz", items);
    expect(results.length).toBe(0);
  });
});
