import { expect, test } from "bun:test";
import { resolveAppConfig } from "../src/config/index.ts";
import { formatSpinnerText } from "../src/ui/spinner.ts";
import {
  getStatusColor,
  getStatusToastBodyHeight,
  getStatusToastMaxBodyHeight,
} from "../src/ui/statusMessages.ts";

test("getStatusColor maps each status level to the matching semantic color", () => {
  const colors = resolveAppConfig({}).colorScheme.semanticColors;

  expect(getStatusColor("info", colors)).toBe(colors.statusInfo);
  expect(getStatusColor("success", colors)).toBe(colors.statusSuccess);
  expect(getStatusColor("warning", colors)).toBe(colors.statusWarning);
  expect(getStatusColor("error", colors)).toBe(colors.statusError);
});

test("formatSpinnerText prefixes loading text with the shared spinner frames", () => {
  expect(formatSpinnerText("loading more revisions", 0)).toBe("⠋ loading more revisions");
  expect(formatSpinnerText("loading more revisions", 11)).toBe("⠙ loading more revisions");
});

test("getStatusToastMaxBodyHeight caps toast bodies to 15 lines or 15 percent of the terminal", () => {
  expect(getStatusToastMaxBodyHeight(200)).toBe(15);
  expect(getStatusToastMaxBodyHeight(80)).toBe(12);
  expect(getStatusToastMaxBodyHeight(20)).toBe(3);
  expect(getStatusToastMaxBodyHeight(6)).toBe(1);
});

test("getStatusToastBodyHeight also clamps to the number of output lines", () => {
  expect(getStatusToastBodyHeight("one line", 12)).toBe(1);
  expect(getStatusToastBodyHeight("one\ntwo\nthree", 12)).toBe(3);
  expect(getStatusToastBodyHeight("1\n2\n3\n4\n5", 3)).toBe(3);
  expect(getStatusToastBodyHeight("1\n2\n3", 1)).toBe(1);
});

test("message overlays clamp long toasts to the configured body height", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderStatusMessageOverlay.tsx"],
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
    renderedLineCount: number;
    frame: string;
  };

  expect(result.renderedLineCount).toBe(5);
  expect(result.frame).toContain("status line 1");
  expect(result.frame).toContain("status line 3");
});

test("short multiline toasts render at their content height instead of the cap", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderShortStatusMessageOverlay.tsx"],
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
    renderedLineCount: number;
    frame: string;
  };

  expect(result.renderedLineCount).toBe(5);
  expect(result.frame).toContain("alpha");
  expect(result.frame).toContain("beta");
  expect(result.frame).toContain("gamma");
});

test("scrolling a success toast resets its dismiss timer", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderStatusMessageInteraction.tsx"],
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
    bodyFound: boolean;
    dismissCalls: string[];
  };

  expect(result.bodyFound).toBeTrue();
  expect(result.dismissCalls).toEqual(["toast-1"]);
});