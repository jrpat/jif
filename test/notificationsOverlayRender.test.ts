import { expect, test } from "bun:test";

test("notification cards embed a horizontally-scrollable body for long lines", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderNotificationsOverlay.tsx"],
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
    scrollboxFound: boolean;
    scrollWidth: number;
    viewportWidth: number;
    longLineRowIndex: number;
    longLineRowText: string;
    frame: string;
  };

  expect(result.scrollboxFound).toBeTrue();

  expect(result.longLineRowIndex).toBeGreaterThanOrEqual(0);
  expect(result.longLineRowText).toContain("a-very-lon");

  const rows = result.frame.split("\n");
  const tailFragmentInOtherRows = rows
    .filter((_row, idx) => idx !== result.longLineRowIndex)
    .some((row) => row.includes("scrolling"));
  expect(tailFragmentInOtherRows).toBeFalse();

  expect(result.frame).toContain("short line");
});
