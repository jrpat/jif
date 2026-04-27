import { expect, test } from "bun:test";

test("revision side chips update their colors when config changes", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderRevisionChipTheme.tsx"],
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

  const {
    initialBg,
    refreshedBg,
    defaultBookmarkBg,
    defaultWorkspaceBg,
    overrideBookmarkBg,
    overrideWorkspaceBg,
  } = JSON.parse(stdout) as {
    initialBg: [number, number, number, number];
    refreshedBg: [number, number, number, number];
    defaultBookmarkBg: [number, number, number, number];
    defaultWorkspaceBg: [number, number, number, number];
    overrideBookmarkBg: [number, number, number, number];
    overrideWorkspaceBg: [number, number, number, number];
  };

  expect(initialBg).toEqual([17, 34, 51, 255]);
  expect(refreshedBg).toEqual([221, 238, 255, 255]);
  expect(defaultBookmarkBg).toEqual([0, 31, 31, 255]);
  expect(defaultWorkspaceBg).toEqual([31, 31, 0, 255]);
  expect(overrideBookmarkBg).toEqual([17, 34, 51, 255]);
  expect(overrideWorkspaceBg).toEqual([221, 238, 255, 255]);
});