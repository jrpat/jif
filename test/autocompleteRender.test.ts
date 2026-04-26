import { expect, test } from "bun:test";

test("bottom-to-top autocomplete list starts scrolled to show first item at bottom", async () => {
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

  const { frame } = JSON.parse(stdout) as { frame: string };
  const lines = frame.split("\n").filter(Boolean);
  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];
  expect(firstLine).toStartWith("┌");
  expect(firstLine).toEndWith("┐");
  expect(lastLine).toStartWith("│");
  expect(lastLine).toEndWith("│");
  expect(lastLine).toContain("all");
}, 20000);
