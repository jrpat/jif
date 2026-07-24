import { expect, test } from "bun:test";
import { browserOpenCommand, openUrl, JIF_RELEASES_URL } from "../src/ui/openUrl.ts";

const URL = "https://example.com/releases";

test("browserOpenCommand uses `open` on macOS", () => {
  expect(browserOpenCommand(URL, "darwin")).toEqual(["open", URL]);
});

test("browserOpenCommand uses `xdg-open` on Linux and other platforms", () => {
  expect(browserOpenCommand(URL, "linux")).toEqual(["xdg-open", URL]);
  expect(browserOpenCommand(URL, "freebsd")).toEqual(["xdg-open", URL]);
});

test("browserOpenCommand uses `cmd /c start` on Windows", () => {
  // The empty title placeholder keeps `start` from treating the URL as a title.
  expect(browserOpenCommand(URL, "win32")).toEqual(["cmd", "/c", "start", "", URL]);
});

test("openUrl spawns the platform opener and resolves on success", async () => {
  const spawned: (readonly string[])[] = [];
  await openUrl({
    url: URL,
    os: "darwin",
    spawn: (command) => {
      spawned.push(command);
      return { exited: Promise.resolve(0) };
    },
  });

  expect(spawned).toEqual([["open", URL]]);
});

test("openUrl throws when the opener exits non-zero", async () => {
  await expect(
    openUrl({
      url: URL,
      os: "linux",
      spawn: () => ({ exited: Promise.resolve(3) }),
    }),
  ).rejects.toThrow(/could not open/i);
});

test("JIF_RELEASES_URL points at the GitHub releases page", () => {
  expect(JIF_RELEASES_URL).toBe("https://github.com/jrpat/jif/releases");
});
