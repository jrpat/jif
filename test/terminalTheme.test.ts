import { PassThrough } from "node:stream";
import { expect, test } from "bun:test";
import {
  detectTerminalThemeMode,
  detectThemeModeFromColorFgbg,
  parseOsc11Response,
} from "../src/config/index.ts";

test("parseOsc11Response decodes terminal background replies", () => {
  const rgb8 = parseOsc11Response("\u001b]11;rgb:ff/80/00\u0007");
  const rgb16 = parseOsc11Response("\u001b]11;rgb:ffff/0000/8080\u001b\\");

  expect(rgb8).toEqual({ r: 255, g: 128, b: 0 });
  expect(rgb16).toEqual({ r: 255, g: 0, b: 128 });
});

test("detectThemeModeFromColorFgbg uses the background slot", () => {
  expect(detectThemeModeFromColorFgbg({ COLORFGBG: "15;0" })).toBe("dark");
  expect(detectThemeModeFromColorFgbg({ COLORFGBG: "0;15" })).toBe("light");
  expect(detectThemeModeFromColorFgbg({})).toBeNull();
});

test("detectTerminalThemeMode prefers OSC 11 terminal background queries", async () => {
  const stdin = new PassThrough() as PassThrough & {
    isTTY: boolean;
    isRaw?: boolean;
    setRawMode: (mode: boolean) => void;
  };
  stdin.isTTY = true;
  stdin.isRaw = false;
  stdin.setRawMode = (mode: boolean) => {
    stdin.isRaw = mode;
  };

  const stdout = new PassThrough() as PassThrough & { isTTY: boolean };
  stdout.isTTY = true;
  let written = "";
  stdout.on("data", (chunk: Buffer | string) => {
    written += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  });

  const detected = detectTerminalThemeMode({
    stdin,
    stdout,
    env: {},
    timeoutMs: 50,
  });

  queueMicrotask(() => {
    stdin.write("\u001b]11;rgb:ffff/ffff/ffff\u0007");
  });

  expect(await detected).toBe("light");
  expect(written).toContain("\u001b]11;?\u0007");
});
