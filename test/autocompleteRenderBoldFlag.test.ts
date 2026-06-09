import { expect, test } from "bun:test";
import { TextAttributes } from "@opentui/core";

test("autocomplete renders a bold long flag while other text stays non-bold", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderComposeFlagRow.tsx"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  expect(exitCode).toBe(0);
  expect(stderr).toBe("");

  const { revisionAttrs, shortTagAttrs, plainAttrs, allFlagsVisible, flagSpanIntact } = JSON.parse(
    stdout,
  ) as {
    revisionAttrs: number | null;
    shortTagAttrs: number | null;
    plainAttrs: number | null;
    allFlagsVisible: boolean;
    flagSpanIntact: boolean;
  };

  expect(revisionAttrs).not.toBeNull();
  expect(plainAttrs).not.toBeNull();

  const isBold = (attrs: number | null) => ((attrs ?? 0) & TextAttributes.BOLD) !== 0;

  expect(isBold(revisionAttrs)).toBe(true);
  expect(isBold(shortTagAttrs)).toBe(false);
  expect(isBold(plainAttrs)).toBe(false);

  // Over-long descriptions must not wrap: every row stays on its own line (so
  // none get pushed out of the viewport) and the long flag name is never clipped.
  expect(allFlagsVisible).toBe(true);
  expect(flagSpanIntact).toBe(true);
}, 20000);
