import { RGBA, TextAttributes, StyledText, type TextChunk } from "@opentui/core";

function ansiIndexToRGBA(index: number, palette: readonly (string | null)[]): RGBA {
  if (index < palette.length && palette[index]) {
    return RGBA.fromHex(palette[index]);
  }
  if (index < 232) {
    // 6x6x6 color cube (indices 16-231)
    const ci = index - 16;
    const r = ci >= 36 ? Math.floor(ci / 36) * 51 : 0;
    const g = (ci % 36) >= 6 ? Math.floor((ci % 36) / 6) * 51 : 0;
    const b = (ci % 6) * 51;
    return RGBA.fromInts(r, g, b);
  }
  // Grayscale ramp (indices 232-255)
  const v = (index - 232) * 10 + 8;
  return RGBA.fromInts(v, v, v);
}

// Matches SGR sequences (\x1b[...m) and other CSI sequences (\x1b[...X)
const CSI_RE = /\x1b\[([0-9;]*)([A-Za-z])/g;

export function parseAnsiToStyledText(input: string, palette: readonly (string | null)[] = []): StyledText {
  if (input.length === 0) return new StyledText([]);

  const chunks: TextChunk[] = [];
  let fg: RGBA | undefined;
  let bg: RGBA | undefined;
  let attrs = TextAttributes.NONE;
  let lastIndex = 0;

  for (const match of input.matchAll(CSI_RE)) {
    // Emit text before this escape
    const textBefore = input.slice(lastIndex, match.index);
    if (textBefore.length > 0) {
      chunks.push(makeChunk(textBefore, fg, bg, attrs));
    }
    lastIndex = match.index + match[0].length;

    // Only process SGR sequences (ending with 'm')
    if (match[2] !== "m") continue;

    const params = match[1]!;
    if (params === "" || params === "0") {
      fg = undefined;
      bg = undefined;
      attrs = TextAttributes.NONE;
      continue;
    }

    const codes = params.split(";").map(Number);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i]!;
      if (c === 0) { fg = undefined; bg = undefined; attrs = TextAttributes.NONE; }
      else if (c === 1) attrs |= TextAttributes.BOLD;
      else if (c === 2) attrs |= TextAttributes.DIM;
      else if (c === 3) attrs |= TextAttributes.ITALIC;
      else if (c === 4) attrs |= TextAttributes.UNDERLINE;
      else if (c === 5 || c === 6) attrs |= TextAttributes.BLINK;
      else if (c === 7) attrs |= TextAttributes.INVERSE;
      else if (c === 8) attrs |= TextAttributes.HIDDEN;
      else if (c === 9) attrs |= TextAttributes.STRIKETHROUGH;
      else if (c === 22) attrs &= ~(TextAttributes.BOLD | TextAttributes.DIM);
      else if (c === 23) attrs &= ~TextAttributes.ITALIC;
      else if (c === 24) attrs &= ~TextAttributes.UNDERLINE;
      else if (c === 25) attrs &= ~TextAttributes.BLINK;
      else if (c === 27) attrs &= ~TextAttributes.INVERSE;
      else if (c === 28) attrs &= ~TextAttributes.HIDDEN;
      else if (c === 29) attrs &= ~TextAttributes.STRIKETHROUGH;
      else if (c >= 30 && c <= 37) fg = ansiIndexToRGBA(c - 30, palette);
      else if (c === 38) { const r = parseExtendedColor(codes, i, palette); if (r) { fg = r.color; i = r.nextIndex; } }
      else if (c === 39) fg = undefined;
      else if (c >= 40 && c <= 47) bg = ansiIndexToRGBA(c - 40, palette);
      else if (c === 48) { const r = parseExtendedColor(codes, i, palette); if (r) { bg = r.color; i = r.nextIndex; } }
      else if (c === 49) bg = undefined;
      else if (c >= 90 && c <= 97) fg = ansiIndexToRGBA(c - 90 + 8, palette);
      else if (c >= 100 && c <= 107) bg = ansiIndexToRGBA(c - 100 + 8, palette);
    }
  }

  // Emit remaining text
  const trailing = input.slice(lastIndex);
  if (trailing.length > 0) {
    chunks.push(makeChunk(trailing, fg, bg, attrs));
  }

  return new StyledText(chunks);
}

function makeChunk(text: string, fg: RGBA | undefined, bg: RGBA | undefined, attrs: number): TextChunk {
  const chunk: TextChunk = { __isChunk: true, text };
  if (fg) chunk.fg = fg;
  if (bg) chunk.bg = bg;
  if (attrs !== TextAttributes.NONE) chunk.attributes = attrs;
  return chunk;
}

function parseExtendedColor(codes: number[], i: number, palette: readonly (string | null)[]): { color: RGBA; nextIndex: number } | null {
  const mode = codes[i + 1];
  if (mode === 5 && i + 2 < codes.length) {
    return { color: ansiIndexToRGBA(codes[i + 2]!, palette), nextIndex: i + 2 };
  }
  if (mode === 2 && i + 4 < codes.length) {
    return { color: RGBA.fromInts(codes[i + 2]!, codes[i + 3]!, codes[i + 4]!), nextIndex: i + 4 };
  }
  return null;
}
