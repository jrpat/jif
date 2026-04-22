import { expect, test, describe } from "bun:test";
import { RGBA, TextAttributes } from "@opentui/core";
import { parseAnsiToStyledText } from "../src/ui/ansiToStyledText.ts";

const TEST_PALETTE = [
  "#000000", "#cd0000", "#00cd00", "#cdcd00",
  "#0000ee", "#cd00cd", "#00cdcd", "#e5e5e5",
  "#7f7f7f", "#ff0000", "#00ff00", "#ffff00",
  "#5c5cff", "#ff00ff", "#00ffff", "#ffffff",
];

describe("parseAnsiToStyledText", () => {
  test("plain text with no ANSI codes returns a single unstyled chunk", () => {
    const result = parseAnsiToStyledText("hello world");
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]!.text).toBe("hello world");
    expect(result.chunks[0]!.fg).toBeUndefined();
    expect(result.chunks[0]!.bg).toBeUndefined();
  });

  test("empty string returns no chunks", () => {
    const result = parseAnsiToStyledText("");
    expect(result.chunks).toHaveLength(0);
  });

  test("bold text", () => {
    const result = parseAnsiToStyledText("\x1b[1mhello\x1b[0m");
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]!.text).toBe("hello");
    expect(result.chunks[0]!.attributes! & TextAttributes.BOLD).toBeTruthy();
  });

  test("italic text", () => {
    const result = parseAnsiToStyledText("\x1b[3mitalic\x1b[0m");
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]!.text).toBe("italic");
    expect(result.chunks[0]!.attributes! & TextAttributes.ITALIC).toBeTruthy();
  });

  test("standard foreground color (red) uses palette", () => {
    const result = parseAnsiToStyledText("\x1b[31mred\x1b[0m", TEST_PALETTE);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]!.text).toBe("red");
    const fg = result.chunks[0]!.fg!;
    expect(fg).toBeDefined();
    const [r, g, b] = fg.toInts();
    expect(r).toBe(0xcd);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  test("standard background color (green) uses palette", () => {
    const result = parseAnsiToStyledText("\x1b[42mgreen bg\x1b[0m", TEST_PALETTE);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]!.text).toBe("green bg");
    const bg = result.chunks[0]!.bg!;
    expect(bg).toBeDefined();
    const [r, g, b] = bg.toInts();
    expect(r).toBe(0);
    expect(g).toBe(0xcd);
    expect(b).toBe(0);
  });

  test("bright foreground color uses palette", () => {
    const result = parseAnsiToStyledText("\x1b[91mbright red\x1b[0m", TEST_PALETTE);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]!.text).toBe("bright red");
    const fg = result.chunks[0]!.fg!;
    const [r, g, b] = fg.toInts();
    expect(r).toBe(0xff);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  test("256-color foreground", () => {
    const result = parseAnsiToStyledText("\x1b[38;5;196mcolor\x1b[0m", TEST_PALETTE);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]!.text).toBe("color");
    expect(result.chunks[0]!.fg).toBeDefined();
  });

  test("RGB true color foreground", () => {
    const result = parseAnsiToStyledText("\x1b[38;2;255;128;0mcolor\x1b[0m");
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]!.text).toBe("color");
    const fg = result.chunks[0]!.fg!;
    const [r, g, b] = fg.toInts();
    expect(r).toBe(255);
    expect(g).toBe(128);
    expect(b).toBe(0);
  });

  test("RGB true color background", () => {
    const result = parseAnsiToStyledText("\x1b[48;2;0;255;128mcolor\x1b[0m");
    expect(result.chunks).toHaveLength(1);
    const bg = result.chunks[0]!.bg!;
    const [r, g, b] = bg.toInts();
    expect(r).toBe(0);
    expect(g).toBe(255);
    expect(b).toBe(128);
  });

  test("multiple attributes in one sequence", () => {
    const result = parseAnsiToStyledText("\x1b[1;3;4mtext\x1b[0m");
    expect(result.chunks).toHaveLength(1);
    const attrs = result.chunks[0]!.attributes!;
    expect(attrs & TextAttributes.BOLD).toBeTruthy();
    expect(attrs & TextAttributes.ITALIC).toBeTruthy();
    expect(attrs & TextAttributes.UNDERLINE).toBeTruthy();
  });

  test("reset mid-stream creates separate chunks", () => {
    const result = parseAnsiToStyledText("\x1b[31mred\x1b[0mplain", TEST_PALETTE);
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0]!.text).toBe("red");
    expect(result.chunks[0]!.fg).toBeDefined();
    expect(result.chunks[1]!.text).toBe("plain");
    expect(result.chunks[1]!.fg).toBeUndefined();
  });

  test("mixed styled and unstyled segments", () => {
    const result = parseAnsiToStyledText("before \x1b[1mbold\x1b[0m after");
    expect(result.chunks).toHaveLength(3);
    expect(result.chunks[0]!.text).toBe("before ");
    expect(result.chunks[1]!.text).toBe("bold");
    expect(result.chunks[1]!.attributes! & TextAttributes.BOLD).toBeTruthy();
    expect(result.chunks[2]!.text).toBe(" after");
  });

  test("default foreground reset (39)", () => {
    const result = parseAnsiToStyledText("\x1b[31mred\x1b[39mdefault", TEST_PALETTE);
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0]!.fg).toBeDefined();
    expect(result.chunks[1]!.fg).toBeUndefined();
  });

  test("attribute clear codes", () => {
    const result = parseAnsiToStyledText("\x1b[1;3mbold italic\x1b[22mnot bold\x1b[0m");
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0]!.attributes! & TextAttributes.BOLD).toBeTruthy();
    expect(result.chunks[0]!.attributes! & TextAttributes.ITALIC).toBeTruthy();
    // After \x1b[22m: bold cleared, italic remains
    expect(result.chunks[1]!.attributes! & TextAttributes.BOLD).toBeFalsy();
    expect(result.chunks[1]!.attributes! & TextAttributes.ITALIC).toBeTruthy();
  });

  test("non-SGR escape sequences are stripped", () => {
    const result = parseAnsiToStyledText("before\x1b[2Jafter");
    const text = result.chunks.map((c) => c.text).join("");
    expect(text).toBe("beforeafter");
    // No chunk should contain escape characters
    for (const chunk of result.chunks) {
      expect(chunk.text).not.toContain("\x1b");
    }
  });

  test("all chunks have __isChunk set to true", () => {
    const result = parseAnsiToStyledText("a \x1b[1mb\x1b[0m c");
    for (const chunk of result.chunks) {
      expect(chunk.__isChunk).toBe(true);
    }
  });
});
