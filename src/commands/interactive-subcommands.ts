import { tokenizeCommandText } from "../jj/client.ts";

export const ALWAYS_INTERACTIVE_JJ_SUBCOMMANDS: readonly string[] = [
  "diff",
  "show",
];

export function isAlwaysInteractiveJjCommand(commandText: string): boolean {
  const subcommand = tokenizeCommandText(commandText)[0];
  return subcommand !== undefined && ALWAYS_INTERACTIVE_JJ_SUBCOMMANDS.includes(subcommand);
}
