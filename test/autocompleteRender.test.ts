import { expect, test } from "bun:test";
import { resolveAppConfig } from "../src/config/index.ts";

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

test("autocomplete list keeps a blank parent row above suggestions and highlights padded selection columns", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderAutocompleteList.tsx"],
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

  const { frame, selectedLineSpans } = JSON.parse(stdout) as {
    frame: string;
    selectedLineSpans: Array<{ text: string; bg: [number, number, number, number] }>;
  };
  const lines = frame.split("\n").slice(0, 6);
  const firstLine = lines[0] ?? "";
  const lastLine = lines[lines.length - 1] ?? "";
  const selectedTextIndex = selectedLineSpans.findIndex((span) => span.text.includes("all"));
  const beforeSpan = selectedLineSpans[selectedTextIndex - 1];
  const selectedSpan = selectedLineSpans[selectedTextIndex];
  const afterSpan = selectedLineSpans[selectedTextIndex + 1];
  const colors = resolveAppConfig({}).colorScheme.semanticColors;
  const expectedFocusedSuggestionBg = hexToRgb(colors.promptSuggestionFocusedFill!);
  const expectedFocusedRowBg = hexToRgb(colors.rowFocusedFill!);

  expect(firstLine.trim()).toBe("");
  expect(lastLine).toStartWith(" ");
  expect(lastLine).toContain("all");
  expect(selectedTextIndex).toBeGreaterThan(0);
  expect(selectedTextIndex).toBeLessThan(selectedLineSpans.length - 1);
  expect(beforeSpan).toBeDefined();
  expect(selectedSpan).toBeDefined();
  expect(afterSpan).toBeDefined();
  expect(beforeSpan?.text).toMatch(/\s+/);
  expect(beforeSpan?.bg).toEqual(selectedSpan?.bg);
  expect(afterSpan?.text).toMatch(/\s+/);
  expect(afterSpan?.bg).toEqual(selectedSpan?.bg);
  expect(selectedSpan?.bg.slice(0, 3)).toEqual(expectedFocusedSuggestionBg);
  expect(selectedSpan?.bg.slice(0, 3)).not.toEqual(expectedFocusedRowBg);
}, 20000);
