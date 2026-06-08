import { tokenizeCommandText } from "../jj/client.ts";

export const ALWAYS_INTERACTIVE_JJ_SUBCOMMANDS: readonly string[] = [
  "diff",
  "show",
  "interdiff",
];

export function isAlwaysInteractiveJjCommand(commandText: string): boolean {
  const subcommand = tokenizeCommandText(commandText)[0];
  return subcommand !== undefined && ALWAYS_INTERACTIVE_JJ_SUBCOMMANDS.includes(subcommand);
}

// A jj invocation requests help when its subcommand is `help` or when it ends
// with a `-h`/`--help` flag (e.g. `rebase --help`). Such commands print
// reference text to stdout, which we surface in a persistent help toast.
export function isHelpJjCommand(commandText: string): boolean {
  const tokens = tokenizeCommandText(commandText);
  if (tokens.length === 0) {
    return false;
  }
  if (tokens[0] === "help") {
    return true;
  }
  const lastToken = tokens[tokens.length - 1];
  return lastToken === "-h" || lastToken === "--help";
}
