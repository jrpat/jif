import { expect, test } from "bun:test";

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
  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];
  const selectedTextIndex = selectedLineSpans.findIndex((span) => span.text.includes("all"));

  expect(firstLine.trim()).toBe("");
  expect(lastLine).toStartWith(" ");
  expect(lastLine).toContain("all");
  expect(selectedTextIndex).toBeGreaterThan(0);
  expect(selectedTextIndex).toBeLessThan(selectedLineSpans.length - 1);
  expect(selectedLineSpans[selectedTextIndex - 1].text).toMatch(/\s+/);
  expect(selectedLineSpans[selectedTextIndex - 1].bg).toEqual(selectedLineSpans[selectedTextIndex].bg);
  expect(selectedLineSpans[selectedTextIndex + 1].text).toMatch(/\s+/);
  expect(selectedLineSpans[selectedTextIndex + 1].bg).toEqual(selectedLineSpans[selectedTextIndex].bg);
}, 20000);
