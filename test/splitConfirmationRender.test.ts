import { expect, test } from "bun:test";

test("split confirmation wraps the option group as a unit and renders accent styling in the preview", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderSplitConfirmation.tsx"],
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

  const { wide, narrow, preview, revision } = JSON.parse(stdout) as {
    wide: {
      frame: string;
      selectedSpan: { fg: [number, number, number, number]; bg: [number, number, number, number]; attributes: number };
      normalSpan: { fg: [number, number, number, number]; bg: [number, number, number, number]; attributes: number };
    };
    narrow: {
      frame: string;
      selectedSpan: { fg: [number, number, number, number]; bg: [number, number, number, number]; attributes: number };
      normalSpan: { fg: [number, number, number, number]; bg: [number, number, number, number]; attributes: number };
    };
    preview: {
      frame: string;
      filesSpan: { fg: [number, number, number, number]; bg: [number, number, number, number]; attributes: number };
      commandSpan: { fg: [number, number, number, number]; bg: [number, number, number, number]; attributes: number };
    };
    revision: {
      frame: string;
    };
  };

  const wideLines = wide.frame.trimEnd().split("\n");
  const narrowLines = narrow.frame.trimEnd().split("\n");
  const revisionLines = revision.frame.trimEnd().split("\n");

  expect(wideLines[0]).toContain("┌");
  expect(wideLines.at(-1)).toContain("┘");
  expect(wideLines.some((line) => line.includes("Split only selected files?") && line.includes("Interactive"))).toBeTrue();

  expect(narrowLines.some((line) => line.includes("Split only selected files?") && line.includes("Interactive"))).toBeFalse();
  expect(narrowLines.some((line) => line.includes("Yes") && line.includes("Interactive") && line.includes("No"))).toBeTrue();

  expect(wide.selectedSpan.attributes).not.toBe(wide.normalSpan.attributes);
  expect(wide.selectedSpan.bg).not.toEqual(wide.normalSpan.bg);

  expect(preview.frame).toContain("…files…");
  expect(preview.filesSpan.fg).not.toEqual(preview.commandSpan.fg);
  expect(preview.filesSpan.bg).not.toEqual(preview.commandSpan.bg);
  expect(preview.filesSpan.attributes).not.toBe(preview.commandSpan.attributes);

  const fileLineIndex = revisionLines.findIndex((line) => line.includes("src/app.ts"));
  const confirmationLineIndex = revisionLines.findIndex((line) => line.includes("Split only selected files?"));
  expect(fileLineIndex).toBeGreaterThan(-1);
  expect(confirmationLineIndex).toBeGreaterThan(fileLineIndex);
  expect(revision.frame).toContain("Yes");
  expect(revision.frame).toContain("Interactive");
  expect(revision.frame).toContain("No");
}, 20000);
