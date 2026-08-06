import { RGBA, StyledText, TextAttributes, type TextChunk } from "@opentui/core";
import { parseAnsiToStyledText } from "./ansiToStyledText.ts";

// The executed command renders as its own line above the output. Both the plain
// string used for height math and the styled chunk that actually draws derive
// from this one function, so the measured rows cannot drift from the drawn ones.
function formatCommandHeader(commandText?: string): string | null {
  return commandText ? `❯ ${commandText}` : null;
}

export function getNotificationBodyText(
  text: string,
  commandText?: string,
): string {
  const header = formatCommandHeader(commandText);
  return header === null ? text : `${header}\n${text}`;
}

export function getNotificationCommandLineCount(
  commandText?: string,
): number {
  const header = formatCommandHeader(commandText);
  return header === null ? 0 : header.split(/\r\n|\r|\n/).length;
}

export function buildNotificationStyledText(args: Readonly<{
  text: string;
  commandText?: string;
  commandColor?: string;
  terminalPalette?: readonly (string | null)[];
}>): StyledText {
  const output = parseAnsiToStyledText(args.text, args.terminalPalette);
  const header = formatCommandHeader(args.commandText);
  if (header === null) {
    return output;
  }

  const headerChunk: TextChunk = {
    __isChunk: true,
    text: header,
    attributes: TextAttributes.BOLD,
    ...(args.commandColor ? { fg: RGBA.fromHex(args.commandColor) } : {}),
  };

  return new StyledText([
    headerChunk,
    { __isChunk: true, text: "\n" },
    ...output.chunks,
  ]);
}
