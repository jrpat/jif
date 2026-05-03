import { expect, test } from "bun:test";
import { resolveAppConfig } from "../src/config/index.ts";
import { parseAnsiToStyledText } from "../src/ui/ansiToStyledText.ts";

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

test("operation log entries render as focused multi-line ANSI rows without wrapping", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderOperationLogEntry.tsx"],
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

  const result = JSON.parse(stdout) as {
    frame: string;
    renderedLineCount: number;
    idFg: [number, number, number, number];
    argsFg: [number, number, number, number];
    idBg: [number, number, number, number];
  };

  const config = resolveAppConfig({});
  const expectedIdFg = parseAnsiToStyledText("\u001b[38;5;12m65d964491fc0\u001b[39m", config.terminalPalette)
    .chunks[0]!.fg!.toInts();
  const expectedArgsFg = parseAnsiToStyledText("\u001b[38;5;13margs:\u001b[39m", config.terminalPalette)
    .chunks[0]!.fg!.toInts();
  const expectedFocusedBg = hexToRgb(config.colorScheme.semanticColors.rowFocusedFill!);
  const renderedLines = result.frame.trimEnd().split("\n");

  expect(result.renderedLineCount).toBe(3);
  expect(result.frame).toContain("65d964491fc0");
  expect(result.frame).toContain("rebase commit");
  expect(renderedLines[2]).toContain("args: jj rebase");
  expect(renderedLines[2]).toContain("...");
  expect(result.idFg.slice(0, 3)).toEqual(expectedIdFg.slice(0, 3));
  expect(result.argsFg.slice(0, 3)).toEqual(expectedArgsFg.slice(0, 3));
  expect(result.idBg.slice(0, 3)).toEqual(expectedFocusedBg);
});

test("operation log focus highlight moves when the focused entry changes", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderOperationLogFocus.tsx"],
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

  const result = JSON.parse(stdout) as {
    firstInitialBg: [number, number, number, number];
    secondInitialBg: [number, number, number, number];
    firstAfterBg: [number, number, number, number];
    secondAfterBg: [number, number, number, number];
  };

  expect(result.firstInitialBg).not.toEqual(result.secondInitialBg);
  expect(result.firstAfterBg).toEqual(result.secondInitialBg);
  expect(result.secondAfterBg).toEqual(result.firstInitialBg);
});