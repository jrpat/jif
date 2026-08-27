import { RGBA, StyledText, TextAttributes, type TextChunk } from "@opentui/core";
import type { CommandInvocation } from "../domain/types.ts";
import { parseAnsiToStyledText } from "./ansiToStyledText.ts";

// The executed command renders as its own line above the output. Both the plain
// string used for height math and the styled chunk that actually draws derive
// from this one function, so the measured rows cannot drift from the drawn ones.
function formatCommandHeader(command?: CommandInvocation, title?: string): string | null {
  if (title) return title;
  if (!command) return null;
  const commandText = command.executor === "jj"
    ? `jj ${command.commandText}`
    : command.commandText;
  return `❯ ${commandText}`;
}

export function getNotificationBodyText(
  text: string,
  command?: CommandInvocation,
  title?: string,
): string {
  const header = formatCommandHeader(command, title);
  return header === null ? text : `${header}\n${text}`;
}

export function getNotificationCommandLineCount(
  command?: CommandInvocation,
  title?: string,
): number {
  const header = formatCommandHeader(command, title);
  return header === null ? 0 : header.split(/\r\n|\r|\n/).length;
}

export function buildNotificationStyledText(args: Readonly<{
  text: string;
  command?: CommandInvocation;
  title?: string;
  commandColor?: string;
  terminalPalette?: readonly (string | null)[];
}>): StyledText {
  const output = parseAnsiToStyledText(args.text, args.terminalPalette);
  const header = formatCommandHeader(args.command, args.title);
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
