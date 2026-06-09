import { expect, test } from "bun:test";
import { JjClient } from "../src/jj/client.ts";
import { JjHelpCache } from "../src/jj/helpCache.ts";
import { createTempDir } from "./helpers/tempRepo.ts";

// `jj <path> -h` is pure clap help and does not require a repo, but we run from
// a fresh temp dir to keep the test hermetic.

test("JjHelpCache loads top-level, group, and leaf help from real jj", async () => {
  const cwd = await createTempDir("help-cache");
  const cache = new JjHelpCache(new JjClient(cwd));

  const top = await cache.load([]);
  expect(top.kind).toBe("group");
  expect(top.subcommands.some((s) => s.name === "log")).toBe(true);
  expect(top.subcommands.some((s) => s.name === "bookmark")).toBe(true);

  const bookmark = await cache.load(["bookmark"]);
  expect(bookmark.kind).toBe("group");
  expect(bookmark.subcommands.some((s) => s.name === "set")).toBe(true);

  const bookmarkSet = await cache.load(["bookmark", "set"]);
  expect(bookmarkSet.kind).toBe("leaf");
  expect(bookmarkSet.flags.some((f) => f.long === "--revision" && f.valueToken === "REVSET")).toBe(
    true,
  );

  // A second read is a synchronous cache hit.
  expect(cache.peek(["bookmark", "set"])).toBe(bookmarkSet);
}, 20000);

test("JjHelpCache dedupes concurrent loads of the same path", async () => {
  let calls = 0;
  const fakeClient = {
    async runHelp(path: readonly string[]): Promise<string> {
      calls += 1;
      // Minimal valid leaf help.
      return `Stub\n\nUsage: jj ${path.join(" ")} [OPTIONS]\n\nOptions:\n  -x, --example  Example flag\n`;
    },
  };
  const cache = new JjHelpCache(fakeClient);

  const [a, b] = await Promise.all([cache.load(["log"]), cache.load(["log"])]);

  expect(calls).toBe(1);
  expect(a).toBe(b);
  expect(a.flags.some((f) => f.long === "--example")).toBe(true);
});
