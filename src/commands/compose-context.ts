import type { JjHelp, JjHelpFlag } from "../jj/help.ts";
import type { JjCommandAlias } from "../jj/commandAliases.ts";

export type CommandPath = readonly string[];

export type ComposeContext =
  | Readonly<{ kind: "subcommand"; path: CommandPath; partial: string; start: number; end: number }>
  | Readonly<{ kind: "flag-or-subcommand"; path: CommandPath; partial: string; start: number; end: number }>
  | Readonly<{
      kind: "value";
      token: string;
      possibleValues?: readonly string[];
      path: CommandPath;
      partial: string;
      start: number;
      end: number;
    }>;

export type CommandToken = Readonly<{
  value: string;
  start: number;
  end: number;
  quoted: boolean;
}>;

// Position-tracking tokenizer that mirrors tokenizeCommandText's quote/escape
// rules. Offsets are needed both to locate the token under the cursor and to
// compute the replacement span when a completion is accepted.
export function tokenizeWithSpans(text: string): CommandToken[] {
  const tokens: CommandToken[] = [];
  let current = "";
  let tokenStart = -1;
  let quoted = false;
  let quote: '"' | "'" | null = null;
  let escape = false;

  const flush = (end: number) => {
    if (tokenStart < 0) return;
    tokens.push({ value: current, start: tokenStart, end, quoted });
    current = "";
    tokenStart = -1;
    quoted = false;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;

    if (escape) {
      if (tokenStart < 0) tokenStart = i - 1;
      current += char;
      escape = false;
      continue;
    }

    if (char === "\\") {
      if (tokenStart < 0) tokenStart = i;
      escape = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      if (tokenStart < 0) tokenStart = i;
      quoted = true;
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      flush(i);
      continue;
    }

    if (tokenStart < 0) tokenStart = i;
    current += char;
  }

  flush(text.length);
  return tokens;
}

type HelpFor = (path: CommandPath) => JjHelp | undefined;
type StepResult = "matched" | "missing-help" | "no-match";

const isFlagToken = (value: string) => value.startsWith("-");

function findFlag(help: JjHelp | undefined, name: string): JjHelpFlag | undefined {
  if (!help) return undefined;
  return help.flags.find((flag) => flag.long === name || flag.short === name);
}

function descendPath(path: string[], token: string, helpFor: HelpFor): StepResult {
  const help = helpFor(path);
  if (!help || help.kind !== "group") return "missing-help";
  const match = help.subcommands.find(
    (sub) => sub.name === token || sub.aliases.includes(token),
  );
  if (!match) return "no-match";
  path.push(match.name);
  return "matched";
}

function findCommandAlias(
  aliases: readonly JjCommandAlias[],
  name: string,
): JjCommandAlias | undefined {
  return aliases.find((alias) => {
    const first = alias.expansion[0];
    return alias.name === name && first !== undefined && first !== "util" && !isFlagToken(first);
  });
}

function descendRootAlias(
  path: string[],
  alias: JjCommandAlias,
  helpFor: HelpFor,
): StepResult {
  const startLength = path.length;
  for (const token of alias.expansion) {
    if (isFlagToken(token)) return "matched";

    const result = descendPath(path, token, helpFor);
    if (result === "matched") continue;
    if (result === "missing-help") return result;

    path.length = startLength;
    return "no-match";
  }

  return path.length > startLength ? "matched" : "no-match";
}

export function resolveComposeContext(
  text: string,
  cursorOffset: number,
  helpFor: HelpFor,
  commandAliases: readonly JjCommandAlias[] = [],
): ComposeContext {
  const cursor = Math.max(0, Math.min(cursorOffset, text.length));
  const tokens = tokenizeWithSpans(text);

  // The token the cursor sits within (inclusive of its end), if any.
  let activeIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.start <= cursor && cursor <= token.end) {
      activeIndex = i;
    }
  }

  const active = activeIndex >= 0 ? tokens[activeIndex]! : null;
  const preceding =
    activeIndex >= 0 ? tokens.slice(0, activeIndex) : tokens.filter((t) => t.end <= cursor);

  // Walk subcommand tokens left-to-right, descending while each running path is
  // a loaded group whose subcommands include the token (by name or alias).
  const path: string[] = [];
  for (const token of preceding) {
    if (isFlagToken(token.value)) break;
    const direct = descendPath(path, token.value, helpFor);
    if (direct === "matched") continue;
    if (direct === "missing-help") break;

    const alias = path.length === 0 ? findCommandAlias(commandAliases, token.value) : undefined;
    if (!alias) break;

    const aliased = descendRootAlias(path, alias, helpFor);
    if (aliased === "matched") continue;
    break;
  }

  const help = helpFor(path);
  const partialStart = active ? active.start : cursor;
  const partialEnd = active ? active.end : cursor;
  const activeValue = active ? active.value : "";

  // `--flag=value` — complete the value after the equals (or the flag name
  // before it).
  if (active && !active.quoted && activeValue.startsWith("--") && activeValue.includes("=")) {
    const eq = activeValue.indexOf("=");
    const cursorInValue = cursor - active.start;
    if (cursorInValue > eq) {
      const flag = findFlag(help, activeValue.slice(0, eq));
      if (flag?.valueToken) {
        return {
          kind: "value",
          token: flag.valueToken,
          possibleValues: flag.possibleValues,
          path,
          partial: activeValue.slice(eq + 1, cursorInValue),
          start: active.start + eq + 1,
          end: active.end,
        };
      }
    }
    return {
      kind: "flag-or-subcommand",
      path,
      partial: activeValue.slice(0, Math.max(0, cursorInValue)),
      start: active.start,
      end: active.end,
    };
  }

  // A value-taking flag immediately before the cursor wants its value next.
  const prev = preceding.length > 0 ? preceding[preceding.length - 1]! : null;
  if (prev && isFlagToken(prev.value) && (!active || !isFlagToken(activeValue))) {
    const flag = findFlag(help, prev.value);
    if (flag?.valueToken) {
      return {
        kind: "value",
        token: flag.valueToken,
        possibleValues: flag.possibleValues,
        path,
        partial: active ? activeValue : "",
        start: partialStart,
        end: partialEnd,
      };
    }
  }

  const partial = activeValue;
  const isDash = partial.startsWith("-");

  if (help) {
    if (help.kind === "group" && !isDash) {
      return { kind: "subcommand", path, partial, start: partialStart, end: partialEnd };
    }
    return { kind: "flag-or-subcommand", path, partial, start: partialStart, end: partialEnd };
  }

  // Model not loaded yet: best-effort guess until the cache fills in.
  if (path.length === 0 && !isDash) {
    return { kind: "subcommand", path, partial, start: partialStart, end: partialEnd };
  }
  return { kind: "flag-or-subcommand", path, partial, start: partialStart, end: partialEnd };
}
