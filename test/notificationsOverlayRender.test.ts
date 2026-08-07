import { expect, test } from "bun:test";

test("notification cards render scrollable bodies without remounting on expansion", async () => {
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
    commandRowIndex: number;
    ordinaryNotificationRowIndex: number;
    initialVerticalScrollbarVisible: boolean | null;
    initialHorizontalScrollbarVisible: boolean | null;
    firstScrollboxStable: boolean;
    expandedScrollboxStable: boolean;
    unrelatedTextContentStable: boolean;
    verticalScrollbarVisibleImmediatelyAfterExpansion: boolean | null;
    frame: string;
  };

  expect(result.scrollboxFound).toBeTrue();
  expect(result.initialVerticalScrollbarVisible).toBeFalse();
  expect(result.initialHorizontalScrollbarVisible).toBeFalse();

  expect(result.longLineRowIndex).toBeGreaterThanOrEqual(0);
  expect(result.longLineRowText).toContain("a-very-lon");
  expect(result.commandRowIndex).toBeGreaterThan(0);
  expect(result.longLineRowIndex).toBe(result.commandRowIndex + 1);
  expect(result.frame).toContain("+2 more lines (l to expand)");

  const rows = result.frame.split("\n");
  expect(rows[result.commandRowIndex - 1]?.replace(/[│ ]/g, "")).toBe("");
  expect(result.ordinaryNotificationRowIndex).toBeGreaterThan(0);
  expect(
    rows[result.ordinaryNotificationRowIndex - 1]?.replace(/[│ ]/g, ""),
  ).toBe("");

  const tailFragmentInOtherRows = rows
    .filter((_row, idx) => idx !== result.longLineRowIndex)
    .some((row) => row.includes("scrolling"));
  expect(tailFragmentInOtherRows).toBeFalse();

  expect(result.frame).toContain("short line");

  expect(result.firstScrollboxStable).toBeTrue();
  expect(result.expandedScrollboxStable).toBeTrue();
  expect(result.unrelatedTextContentStable).toBeTrue();
  expect(result.verticalScrollbarVisibleImmediatelyAfterExpansion).toBeFalse();
});
