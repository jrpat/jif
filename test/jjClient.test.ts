import { expect, test } from "bun:test";
import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { materializeSampleRepoCached } from "../src/dev/sampleRepo.ts";
import {
  JjClient,
  parseChangedFile,
  parseLogOutput,
  parseEvolutionLogOutput,
  parseOperationLogOutput,
  resolveRepositoryLoadLimit,
  tokenizeCommandText,
} from "../src/jj/client.ts";
import { runCommand } from "../src/jj/process.ts";
import { createTempDir } from "./helpers/tempRepo.ts";

const REPO_PATH = "/tmp/repo";

test("resolveRepositoryLoadLimit accepts positive integer overrides and rejects invalid values", () => {
  expect(resolveRepositoryLoadLimit("25", 250)).toBe(25);
  expect(resolveRepositoryLoadLimit("0", 250)).toBe(250);
  expect(resolveRepositoryLoadLimit("-3", 250)).toBe(250);
  expect(resolveRepositoryLoadLimit("not-a-number", 250)).toBe(250);
  expect(resolveRepositoryLoadLimit(undefined, 250)).toBe(250);
});

test("tokenizeCommandText keeps quoted segments together", () => {
  expect(tokenizeCommandText('rebase -r abc123 -o "bookmark main"')).toEqual([
    "rebase",
    "-r",
    "abc123",
    "-o",
    "bookmark main",
  ]);
});

test("parseChangedFile keeps a plain status/path pair as-is", () => {
  expect(parseChangedFile("M src/app.ts")).toEqual({ status: "M", path: "src/app.ts" });
});

test("parseChangedFile expands a renamed file's compressed path to the new path", () => {
  const file = parseChangedFile("R src/foo/{old_name.ext => new_name.ext}");
  expect(file.status).toBe("R");
  // `path` must be a real path jj accepts, not the `{old => new}` display form.
  expect(file.path).toBe("src/foo/new_name.ext");
  expect(file.displayPath).toBe("src/foo/{old_name.ext => new_name.ext}");
});

test("parseChangedFile expands a rename with no shared prefix or suffix", () => {
  const file = parseChangedFile("R {alpha.txt => beta.txt}");
  expect(file.path).toBe("beta.txt");
  expect(file.displayPath).toBe("{alpha.txt => beta.txt}");
});

test("parseChangedFile expands a rename that only shares a trailing segment", () => {
  const file = parseChangedFile("R {deep => sub}/keep.txt");
  expect(file.path).toBe("sub/keep.txt");
  expect(file.displayPath).toBe("{deep => sub}/keep.txt");
});

test("parseChangedFile expands a copied file's compressed path to the new path", () => {
  const file = parseChangedFile("C {orig.txt => dup.txt}");
  expect(file.path).toBe("dup.txt");
  expect(file.displayPath).toBe("{orig.txt => dup.txt}");
});

test("parseLogOutput preserves hybrid graph rows in emission order", () => {
  const output = [
    "@  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001ffirst\u001fmain\u001fdefault,review\u001fabc\u001ffalse\u001f2026-03-30 07:22:39\u001ffalse",
    "│\u001fbody\u001fabcdefgh",
    "|",
    "○  bcdefghi\u001fheader\u001fbcdefghi\u001f22222222\u001fsecond\u001f\u001f\u001fbcd\u001ffalse\u001f2026-03-29 03:05:01\u001ffalse",
    "│\u001fbody\u001fbcdefghi",
  ].join("\n");

  const revisions = parseLogOutput(output);
  expect(revisions).toHaveLength(2);
  expect(revisions[0]?.graphRows).toEqual(["@  ", "│", "|"]);
  expect(revisions[0]?.bookmarks).toEqual(["main"]);
  expect(revisions[0]?.workspaces).toEqual(["default", "review"]);
  expect(revisions[0]?.changeIdPrefixLength).toBe(3);
  expect(revisions[0]?.isEmpty).toBeFalse();
  expect(revisions[0]?.hasConflict).toBeFalse();
  expect(revisions[0]?.filesLoaded).toBeFalse();
  expect(revisions[0]?.localTimestamp).toBe("2026-03-30 07:22:39");
  expect(revisions[1]?.graphRows).toEqual(["○  ", "│"]);
  expect(revisions[1]?.changeIdPrefixLength).toBe(3);
  expect(revisions[1]?.hasConflict).toBeFalse();
});

test("parseLogOutput captures parent revision ids", () => {
  const output = [
    "@  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001ffirst\u001fmain\u001fdefault,review\u001fabc\u001ffalse\u001f2026-03-30 07:22:39\u001ffalse\u001fbcdefghi,cdefghij",
    "│\u001fbody\u001fabcdefgh",
  ].join("\n");

  const revisions = parseLogOutput(output);

  expect(revisions).toHaveLength(1);
  expect(revisions[0]?.parentRevisionIds).toEqual(["bcdefghi", "cdefghij"]);
});

test("parseLogOutput keeps divergent siblings distinct by revision id", () => {
  const output = [
    "@  abcdefgh/0\u001fheader\u001fabcdefgh/0\u001f11111111\u001ffirst divergent\u001fmain\u001fabc\u001ffalse\u001f2026-03-30 07:22:39\u001ffalse",
    "│\u001fbody\u001fabcdefgh/0",
    "○  abcdefgh/1\u001fheader\u001fabcdefgh/1\u001f22222222\u001fsecond divergent\u001f\u001fabc\u001ffalse\u001f2026-03-29 03:05:01\u001ffalse",
    "│\u001fbody\u001fabcdefgh/1",
  ].join("\n");

  const revisions = parseLogOutput(output);

  expect(revisions).toHaveLength(2);
  expect(revisions[0]?.revisionId).toBe("abcdefgh/0");
  expect(revisions[0]?.graphRows).toEqual(["@  ", "│"]);
  expect(revisions[1]?.revisionId).toBe("abcdefgh/1");
  expect(revisions[1]?.graphRows).toEqual(["○  ", "│"]);
});

test("parseLogOutput uses both empty and no description markers for blank empty revisions", () => {
  const output = [
    "@  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001f\u001f\u001f\u001fabc\u001ftrue\u001f2026-03-30 07:22:39\u001ffalse",
    "│\u001fbody\u001fabcdefgh",
  ].join("\n");

  const revisions = parseLogOutput(output);

  expect(revisions).toHaveLength(1);
  expect(revisions[0]?.description).toBe("(empty) (no description)");
  expect(revisions[0]?.isEmpty).toBeTrue();
  expect(revisions[0]?.filesLoaded).toBeTrue();
  expect(revisions[0]?.graphRows).toEqual(["@  ", "│"]);
});

test("parseLogOutput keeps (no description) for blank descriptions on non-empty revisions", () => {
  const output = [
    "@  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001f\u001f\u001f\u001fabc\u001ffalse\u001f2026-03-30 07:22:39\u001ffalse",
    "│\u001fbody\u001fabcdefgh",
  ].join("\n");

  const revisions = parseLogOutput(output);

  expect(revisions).toHaveLength(1);
  expect(revisions[0]?.description).toBe("(no description)");
  expect(revisions[0]?.isEmpty).toBeFalse();
  expect(revisions[0]?.filesLoaded).toBeFalse();
});

test("parseLogOutput tolerates missing timestamp fields", () => {
  const output = [
    "@  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001ffirst\u001f\u001f\u001fabc\u001ffalse\u001f\u001ffalse",
    "│\u001fbody\u001fabcdefgh",
  ].join("\n");

  const revisions = parseLogOutput(output);

  expect(revisions).toHaveLength(1);
  expect(revisions[0]?.localTimestamp).toBe("");
});

test("parseLogOutput creates a synthetic elided revision", () => {
  const output = [
    "◆  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001fsome commit\u001f\u001f\u001fab\u001ffalse\u001f2026-03-30 07:22:39\u001ffalse",
    "│\u001fbody\u001fabcdefgh",
    "~  (elided revisions)",
  ].join("\n");

  const revisions = parseLogOutput(output);
  expect(revisions).toHaveLength(2);
  expect(revisions[0]?.graphRows).toEqual(["◆  ", "│"]);
  expect(revisions[1]?.marker).toBe("elided");
  expect(revisions[1]?.description).toBe("(elided revisions)");
  expect(revisions[1]?.graphRows).toEqual(["~  "]);
  expect(revisions[1]?.revisionId).toBe("__elided_1");
  expect(revisions[1]?.filesLoaded).toBeTrue();
  expect(revisions[1]?.localTimestamp).toBe("");
});

test("parseLogOutput sets hasConflict for conflicted revisions", () => {
  const output = [
    "×  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001fmerge feature\u001f\u001f\u001fabc\u001ffalse\u001f2026-03-30 07:22:39\u001ftrue",
    "│\u001fbody\u001fabcdefgh",
    "○  bcdefghi\u001fheader\u001fbcdefghi\u001f22222222\u001fclean commit\u001f\u001f\u001fbcd\u001ffalse\u001f2026-03-29 03:05:01\u001ffalse",
    "│\u001fbody\u001fbcdefghi",
  ].join("\n");

  const revisions = parseLogOutput(output);
  expect(revisions).toHaveLength(2);
  expect(revisions[0]?.hasConflict).toBeTrue();
  expect(revisions[0]?.marker).toBe("working-copy");
  expect(revisions[1]?.hasConflict).toBeFalse();
});

test("parseOperationLogOutput groups multi-line ANSI entries by operation id", () => {
  const output = [
    "\u001b[1m\u001b[38;5;12m65d964491fc0\u001b[39m \u001b[38;5;3mjrpat@host\u001b[39m \u001b[4m\u001b[38;5;6mjif-3@\u001b[24m\u001b[39m \u001b[38;5;14m9 minutes ago\u001b[39m\u001b[0m",
    "\u001b[1mrebase commit 93f155d4a5345ccc3eb97e649e3ee0eab8878180 and 1 more\u001b[0m",
    "\u001b[1m\u001b[38;5;13margs: jj --color always rebase -r q -r xm -d n\u001b[39m\u001b[0m",
    "\u001b[38;5;4m96df2f0afa0c\u001b[39m \u001b[38;5;3mjrpat@host\u001b[39m \u001b[4m\u001b[38;5;6mjif-3@\u001b[24m\u001b[39m \u001b[38;5;6m9 minutes ago\u001b[39m",
    "export git refs",
    "\u001b[38;5;5margs: jj git export\u001b[39m",
  ].join("\n");

  const entries = parseOperationLogOutput(output);

  expect(entries).toEqual([
    {
      id: "65d964491fc0",
      lines: [
        "\u001b[1m\u001b[38;5;12m65d964491fc0\u001b[39m \u001b[38;5;3mjrpat@host\u001b[39m \u001b[4m\u001b[38;5;6mjif-3@\u001b[24m\u001b[39m \u001b[38;5;14m9 minutes ago\u001b[39m\u001b[0m",
        "\u001b[1mrebase commit 93f155d4a5345ccc3eb97e649e3ee0eab8878180 and 1 more\u001b[0m",
        "\u001b[1m\u001b[38;5;13margs: jj rebase -r q -r xm -d n\u001b[39m\u001b[0m",
      ],
    },
    {
      id: "96df2f0afa0c",
      lines: [
        "\u001b[38;5;4m96df2f0afa0c\u001b[39m \u001b[38;5;3mjrpat@host\u001b[39m \u001b[4m\u001b[38;5;6mjif-3@\u001b[24m\u001b[39m \u001b[38;5;6m9 minutes ago\u001b[39m",
        "export git refs",
        "\u001b[38;5;5margs: jj git export\u001b[39m",
      ],
    },
  ]);
});

test("parseOperationLogOutput preserves graph-prefixed operation lines", () => {
  const output = [
    "\u001b[1m\u001b[38;5;2m@\u001b[0m  \u001b[1m\u001b[38;5;12m65d964491fc0\u001b[39m jrpat@host jif-3@ 9 minutes ago\u001b[0m",
    "│  \u001b[1mexport git refs\u001b[0m",
    "│  \u001b[1m\u001b[38;5;13margs: jj git export\u001b[39m\u001b[0m",
    "○  \u001b[38;5;4m96df2f0afa0c\u001b[39m jrpat@host jif-3@ 9 minutes ago",
    "│  snapshot working copy",
    "│  \u001b[38;5;5margs: jj st\u001b[39m",
  ].join("\n");

  const entries = parseOperationLogOutput(output);

  expect(entries).toEqual([
    {
      id: "65d964491fc0",
      lines: [
        "\u001b[1m\u001b[38;5;2m@\u001b[0m  \u001b[1m\u001b[38;5;12m65d964491fc0\u001b[39m jrpat@host jif-3@ 9 minutes ago\u001b[0m",
        "│  \u001b[1mexport git refs\u001b[0m",
        "│  \u001b[1m\u001b[38;5;13margs: jj git export\u001b[39m\u001b[0m",
      ],
    },
    {
      id: "96df2f0afa0c",
      lines: [
        "○  \u001b[38;5;4m96df2f0afa0c\u001b[39m jrpat@host jif-3@ 9 minutes ago",
        "│  snapshot working copy",
        "│  \u001b[38;5;5margs: jj st\u001b[39m",
      ],
    },
  ]);
});

test("parseOperationLogOutput strips jif-injected --color from args lines", () => {
  const output = [
    "65d964491fc0 jrpat@host jif-3@ now",
    "describe commit deadbeef",
    "args: jj --color always describe -m hello",
    "",
    "96df2f0afa0c jrpat@host jif-3@ now",
    "snapshot working copy",
    "args: jj --color=never st",
  ].join("\n");

  const entries = parseOperationLogOutput(output);

  expect(entries[0]?.lines[2]).toBe("args: jj describe -m hello");
  expect(entries[1]?.lines[2]).toBe("args: jj st");
});

test("parseOperationLogOutput preserves ANSI escapes around the stripped flag", () => {
  const output = [
    "65d964491fc0 jrpat@host jif-3@ now",
    "describe commit deadbeef",
    "[1m[38;5;13margs: jj --color always describe -m hello[39m[0m",
  ].join("\n");

  const entries = parseOperationLogOutput(output);

  expect(entries[0]?.lines[2]).toBe(
    "[1m[38;5;13margs: jj describe -m hello[39m[0m",
  );
});

test("parseOperationLogOutput strips --color from graph-prefixed args lines", () => {
  const output = [
    "@  65d964491fc0 jrpat@host jif-3@ now",
    "│  describe commit deadbeef",
    "│  args: jj --color always describe -m hello",
  ].join("\n");

  const entries = parseOperationLogOutput(output);

  expect(entries[0]?.lines[2]).toBe("│  args: jj describe -m hello");
});

test("parseOperationLogOutput leaves non-args lines untouched even when they mention --color", () => {
  const output = [
    "65d964491fc0 jrpat@host jif-3@ now",
    "set ui.color always (free-form description text)",
    "args: jj config set --user ui.color always",
  ].join("\n");

  const entries = parseOperationLogOutput(output);

  expect(entries[0]?.lines[1]).toBe("set ui.color always (free-form description text)");
  expect(entries[0]?.lines[2]).toBe("args: jj config set --user ui.color always");
});

test("parseOperationLogOutput leaves args lines without --color byte-for-byte unchanged", () => {
  const original = "[1m[38;5;13margs: jj rebase -r q -d n[39m[0m";
  const output = [
    "65d964491fc0 jrpat@host jif-3@ now",
    "rebase",
    original,
  ].join("\n");

  const entries = parseOperationLogOutput(output);

  expect(entries[0]?.lines[2]).toBe(original);
});

test("parseEvolutionLogOutput splits entries on graph-node glyphs and extracts operation ids", () => {
  const output = [
    "@  xuntkrpo jrp@maild.name 2026-05-15 06:30:40 dafa8495",
    "│  third",
    "│  -- operation 35bf4e939772 describe commit f5029c4b0880",
    "○  xuntkrpo/1 jrp@maild.name 2026-05-15 06:30:40 f5029c4b (hidden)",
    "│  second",
    "│  -- operation fbb9651ace30 describe commit a44bb4e65445",
    "○  xuntkrpo/2 jrp@maild.name 2026-05-15 06:30:40 a44bb4e6 (hidden)",
    "│  first",
    "│  -- operation 0c0c798bfcf6 describe commit e7dd6f6fdce4",
  ].join("\n");

  const entries = parseEvolutionLogOutput(output);

  expect(entries.length).toBe(3);
  expect(entries[0]?.id).toBe("35bf4e939772");
  expect(entries[0]?.lines[0]).toBe("@  xuntkrpo jrp@maild.name 2026-05-15 06:30:40 dafa8495");
  expect(entries[1]?.id).toBe("fbb9651ace30");
  expect(entries[2]?.id).toBe("0c0c798bfcf6");
});

test("parseEvolutionLogOutput captures each entry's commit id from its header line", () => {
  const output = [
    "@  xuntkrpo jrp@maild.name 2026-05-15 06:30:40 dafa8495",
    "│  third",
    "│  -- operation 35bf4e939772 describe commit f5029c4b0880",
    "○  xuntkrpo/1 jrp@maild.name 2026-05-15 06:30:40 f5029c4b (hidden)",
    "│  second",
    "│  -- operation fbb9651ace30 describe commit a44bb4e65445",
  ].join("\n");

  const entries = parseEvolutionLogOutput(output);

  expect(entries[0]?.commitId).toBe("dafa8495");
  expect(entries[1]?.commitId).toBe("f5029c4b");
});

test("parseEvolutionLogOutput preserves ANSI escapes in entry lines", () => {
  const output = [
    "[1m[38;5;2m@[0m  [1m[38;5;13mx[38;5;8muntkrpo[39m",
    "│  [1mthird[0m",
    "│  [38;5;8m--[39m operation [38;5;4m35bf4e939772[39m describe",
  ].join("\n");

  const entries = parseEvolutionLogOutput(output);

  expect(entries.length).toBe(1);
  expect(entries[0]?.id).toBe("35bf4e939772");
  expect(entries[0]?.lines.length).toBe(3);
});

test("parseEvolutionLogOutput falls back to a synthesized id when no operation id is present", () => {
  const output = [
    "@  xuntkrpo jrp@maild.name 2026-05-15 06:30:40 dafa8495",
    "│  third",
  ].join("\n");

  const entries = parseEvolutionLogOutput(output);

  expect(entries.length).toBe(1);
  expect(entries[0]?.id).toBe("evolog-0");
});

test("loadEvolog passes --color and --ignore-working-copy with -r", async () => {
  const client = new JjClient(REPO_PATH);
  let capturedArgs: readonly string[] = [];

  (client as unknown as {
    runJj: (
      args: readonly string[],
    ) => Promise<{ stdout: string; stderr: string }>;
  }).runJj = async (args: readonly string[]) => {
    capturedArgs = args;
    return { stdout: "", stderr: "" };
  };

  await client.loadEvolog("abcd1234");

  expect(capturedArgs).toEqual([
    "evolog",
    "-r",
    "abcd1234",
    "--color",
    "always",
    "--ignore-working-copy",
  ]);
});

test("loadRepository can ignore the working copy for passive refreshes", async () => {
  const client = new JjClient(REPO_PATH);
  let capturedArgs: readonly string[] = [];
  let capturedOptions: { workingCopy?: string } | undefined;

  (client as unknown as {
    runJj(
      args: readonly string[],
      options?: { workingCopy?: string },
    ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  }).runJj = async (args, options) => {
    capturedArgs = args;
    capturedOptions = options;
    return { stdout: "", stderr: "", exitCode: 0 };
  };

  await client.loadRepository(7, "mine()", { workingCopy: "read-only" });

  expect(capturedArgs).toContain("log");
  expect(capturedArgs).toContain("--limit");
  expect(capturedArgs).toContain("7");
  expect(capturedArgs).toContain("mine()");
  expect(capturedOptions?.workingCopy).toBe("read-only");
});

test("verifyRepository can ignore the working copy for passive refreshes", async () => {
  const client = new JjClient(REPO_PATH);
  let capturedArgs: readonly string[] = [];
  let capturedOptions: { workingCopy?: string } | undefined;

  (client as unknown as {
    runJj(
      args: readonly string[],
      options?: { workingCopy?: string },
    ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  }).runJj = async (args, options) => {
    capturedArgs = args;
    capturedOptions = options;
    return { stdout: "", stderr: "", exitCode: 0 };
  };

  await client.verifyRepository({ workingCopy: "read-only" });

  expect(capturedArgs).toEqual(["root"]);
  expect(capturedOptions?.workingCopy).toBe("read-only");
});

test("loadOperationLog keeps jj graph output enabled", async () => {
  const client = new JjClient(REPO_PATH);
  let capturedArgs: readonly string[] = [];

  (client as unknown as {
    runJj(
      args: readonly string[],
      options?: { color?: boolean; cwd?: string },
    ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  }).runJj = async (args) => {
    capturedArgs = args;
    return {
      stdout: [
        "@  65d964491fc0 jrpat@host jif-3@ 9 minutes ago",
        "│  export git refs",
        "│  args: jj git export",
      ].join("\n"),
      stderr: "",
      exitCode: 0,
    };
  };

  const entries = await client.loadOperationLog(7);

  expect(capturedArgs).not.toContain("--no-graph");
  expect(capturedArgs).toContain("--ignore-working-copy");
  expect(capturedArgs).toContain("--limit");
  expect(capturedArgs).toContain("7");
  expect(entries).toEqual([
    {
      id: "65d964491fc0",
      lines: [
        "@  65d964491fc0 jrpat@host jif-3@ 9 minutes ago",
        "│  export git refs",
        "│  args: jj git export",
      ],
    },
  ]);
});

test("file preview diff loader can request effectively full-file context", async () => {
  const client = new JjClient(REPO_PATH);
  const calls: Array<{ args: readonly string[]; options?: { workingCopy?: string } }> = [];

  (client as unknown as {
    runJj(
      args: readonly string[],
      options?: { workingCopy?: string },
    ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  }).runJj = async (args, options) => {
    calls.push({ args, options });
    return { stdout: "", stderr: "", exitCode: 0 };
  };

  await client.loadFileDiff("abc", "/tmp/repo/src/app.ts", { fullFile: true });

  expect(calls.map((call) => call.args)).toEqual([
    ["diff", "-r", "abc", "--git", "--context", "999999", "/tmp/repo/src/app.ts"],
  ]);
  expect(calls.every((call) => call.options?.workingCopy === "read-only")).toBeTrue();
});

test("parseLogOutput defaults hasConflict to false when field is missing", () => {
  const output = [
    "@  abcdefgh\u001fheader\u001fabcdefgh\u001f11111111\u001ffirst\u001f\u001f\u001fabc\u001ffalse\u001f2026-03-30 07:22:39",
    "│\u001fbody\u001fabcdefgh",
  ].join("\n");

  const revisions = parseLogOutput(output);
  expect(revisions[0]?.hasConflict).toBeFalse();
});

test("JjClient loads a real sample repository", async () => {
  const repo = await materializeSampleRepoCached({
    baseDir: await createTempDir("client-sample"),
  });
  const client = new JjClient(repo.repoPath);

  const repository = await client.loadRepository(80);

  expect(repository.revisions.length).toBeGreaterThan(30);
  expect(repository.revisions.some((revision) => revision.bookmarks.length > 0)).toBeTrue();
  expect(repository.revisions.some((revision) => revision.workspaces.length > 0)).toBeTrue();

  const firstChangedRevision = repository.revisions.find((revision) => !revision.isEmpty);
  expect(firstChangedRevision).toBeDefined();

  const firstFiles = await client.loadChangedFiles(firstChangedRevision!.revisionId);
  expect(firstFiles.length).toBeGreaterThan(0);

  const knownFiles = await client.loadKnownFiles();
  expect(knownFiles).toContain("src/app.ts");
  expect(knownFiles).toContain("src/revset.ts");
}, 20000);

test("JjClient resolves a renamed file to a path its single-file diff accepts", async () => {
  const baseDir = await createTempDir("client-rename-preview");
  const repo = join(baseDir, "repo");
  await runCommand(baseDir, ["jj", "git", "init", repo]);
  await mkdir(join(repo, "src"), { recursive: true });
  await Bun.write(join(repo, "src/old_name.ext"), "line1\nline2\nline3\n");
  await runCommand(repo, ["jj", "describe", "-m", "base"]);
  await runCommand(repo, ["jj", "new", "-m", "rename"]);
  await rename(join(repo, "src/old_name.ext"), join(repo, "src/new_name.ext"));
  await Bun.write(join(repo, "src/new_name.ext"), "line1\nCHANGED\nline3\n");

  const client = new JjClient(repo);

  const files = await client.loadChangedFiles("@");
  expect(files).toHaveLength(1);
  const file = files[0]!;
  expect(file.status).toBe("R");
  expect(file.path).toBe("src/new_name.ext");
  expect(file.displayPath).toBe("src/{old_name.ext => new_name.ext}");

  // The resolved `path` (not the `{old => new}` display form) is what the
  // preview pane feeds to jj; jj must accept it and return the rename diff.
  const diff = await client.loadFileDiff("@", join(repo, file.path));
  expect(diff).toContain("rename from src/old_name.ext");
  expect(diff).toContain("rename to src/new_name.ext");
  expect(diff).toContain("+CHANGED");
}, 20000);

test("JjClient marks a real empty revision without loading changed files", async () => {
  const repo = await materializeSampleRepoCached({
    baseDir: await createTempDir("client-empty-revision"),
  });
  await runCommand(repo.repoPath, ["jj", "new", "-m", ""]);

  const client = new JjClient(repo.repoPath);
  const repository = await client.loadRepository(10);
  const workingCopy = repository.revisions[0];

  expect(workingCopy?.isEmpty).toBeTrue();
  expect(workingCopy?.description).toBe("(empty) (no description)");
  expect(workingCopy?.files).toEqual([]);
  expect(workingCopy?.filesLoaded).toBeTrue();
}, 20000);

test("JjClient distinguishes a hidden remote-kept commit from its locally-edited sibling", async () => {
  const baseDir = await createTempDir("client-hidden-sibling");
  const upstream = join(baseDir, "upstream");
  const work = join(baseDir, "work");

  await runCommand(baseDir, ["git", "init", "--bare", upstream]);
  await runCommand(baseDir, ["jj", "git", "clone", upstream, work]);
  await Bun.write(
    join(work, ".jj/repo/config.toml"),
    'revset-aliases."immutable_heads()" = "none()"\n',
  );

  await Bun.write(join(work, "a.txt"), "hello\n");
  await runCommand(work, ["jj", "describe", "-m", "A"]);
  await runCommand(work, ["jj", "bookmark", "create", "main", "-r", "@"]);
  await runCommand(work, ["jj", "git", "push", "-b", "main"]);

  await Bun.write(join(work, "a.txt"), "hello modified\n");
  await runCommand(work, ["jj", "describe", "-m", "A modified"]);

  const client = new JjClient(work);
  const repository = await client.loadRepository(20);

  const interesting = repository.revisions.filter((r) =>
    r.bookmarks.some((b) => b.startsWith("main")),
  );
  expect(interesting).toHaveLength(2);

  const prefixes = interesting.map((r) => r.revisionId.split("/")[0]);
  expect(prefixes[0]).toBe(prefixes[1]);

  const withSuffix = interesting.filter((r) => /\/\d+$/.test(r.revisionId));
  expect(withSuffix).toHaveLength(1);
}, 20000);

test("JjClient resolves the actual workspace root from nested paths", async () => {
  const repo = await materializeSampleRepoCached({
    baseDir: await createTempDir("client-workspace-root"),
  });
  const client = new JjClient(join(repo.repoPath, "src"));

  expect(await client.loadWorkspaceRoot()).toBe(repo.repoPath);
}, 20000);
