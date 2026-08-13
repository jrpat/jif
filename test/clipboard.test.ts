import { expect, test } from "bun:test";
import {
  clipboardCopyCommand,
  clipboardCopyCommandText,
  copyToClipboard,
} from "../src/ui/clipboard.ts";

test("clipboardCopyCommand uses `pbcopy` on macOS", () => {
  expect(clipboardCopyCommand("darwin", {})).toEqual(["pbcopy"]);
});

test("clipboardCopyCommand uses `clip` on Windows", () => {
  expect(clipboardCopyCommand("win32", {})).toEqual(["clip"]);
});

test("clipboardCopyCommand prefers wl-copy under Wayland and xclip otherwise", () => {
  expect(clipboardCopyCommand("linux", { WAYLAND_DISPLAY: "wayland-0" })).toEqual(["wl-copy"]);
  expect(clipboardCopyCommand("linux", {})).toEqual(["xclip", "-selection", "clipboard"]);
  expect(clipboardCopyCommand("freebsd", {})).toEqual(["xclip", "-selection", "clipboard"]);
});

test("clipboardCopyCommandText renders the command as a shell pipeline fragment", () => {
  expect(clipboardCopyCommandText("darwin", {})).toBe("pbcopy");
  expect(clipboardCopyCommandText("linux", {})).toBe("xclip -selection clipboard");
});

test("copyToClipboard feeds the text to the platform writer on stdin", async () => {
  const spawned: { command: readonly string[]; text: string }[] = [];
  await copyToClipboard({
    text: "main",
    os: "darwin",
    env: {},
    spawn: (command, text) => {
      spawned.push({ command, text });
      return { exited: Promise.resolve(0) };
    },
  });

  expect(spawned).toEqual([{ command: ["pbcopy"], text: "main" }]);
});

test("copyToClipboard throws when the writer exits non-zero", async () => {
  await expect(
    copyToClipboard({
      text: "main",
      os: "linux",
      env: {},
      spawn: () => ({ exited: Promise.resolve(1) }),
    }),
  ).rejects.toThrow(/could not copy/i);
});
