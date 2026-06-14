import { hasMatch, score } from "fzy.js";
import { quoteArg } from "../jj/process.ts";
import type { JjHelp } from "../jj/help.ts";
import {
  matchCompletions,
  type CompletionItem,
  type CompletionKind,
} from "../revset/completions.ts";
import type { AutocompleteListItem } from "../ui/AutocompleteList.tsx";
import type { ComposeContext } from "./compose-context.ts";

const REVSET_TOKENS = new Set(["REVSET", "REVSETS", "REVISION", "REVISIONS"]);
const REVSET_LITERALS = ["@", "@-"] as const;

// Bottom-to-top flow: the AutocompleteList reverses for display, so a best-first
// logical order surfaces the best match nearest the input. This mirrors
// matchCompletions in src/revset/completions.ts.
// `key` may return several candidate strings (e.g. a subcommand's name and its
// aliases). An item matches if any candidate does, and it is scored by its best
// candidate, so an exact alias hit (`b` for `bookmark`) outranks an incidental
// fuzzy name hit (`b` in `bisect`).
function fuzzyFilter<T>(
  partial: string,
  items: readonly T[],
  key: (item: T) => string | readonly string[],
): T[] {
  if (!partial) {
    return items.slice();
  }
  const scored: { item: T; value: number }[] = [];
  for (const item of items) {
    const candidate = key(item);
    const candidates = typeof candidate === "string" ? [candidate] : candidate;
    let matched = false;
    let best = Number.NEGATIVE_INFINITY;
    for (const value of candidates) {
      if (hasMatch(partial, value)) {
        matched = true;
        best = Math.max(best, score(partial, value));
      }
    }
    if (matched) {
      scored.push({ item, value: best });
    }
  }
  scored.sort((a, b) => a.value - b.value);
  return scored.map((entry) => entry.item).reverse();
}

function completionKindLabel(kind: CompletionKind): string {
  switch (kind) {
    case "function":
      return "fn";
    case "bookmark":
      return "bm";
    case "tag":
      return "tg";
    case "alias":
      return "al";
  }
}

// Bookmark subcommands whose positional argument is a bookmark name we can
// complete (e.g. `jj bookmark set <NAMES>`, `delete`, `forget`, `move`).
function isBookmarkNamePositional(help: JjHelp | undefined): boolean {
  if (!help) return false;
  return help.positionals.some((positional) => /NAMES?/.test(positional.token));
}

export function buildComposeItems(args: {
  context: ComposeContext;
  help: JjHelp | undefined;
  revsetItems: readonly CompletionItem[];
  bookmarks: readonly string[];
}): AutocompleteListItem[] {
  const { context, help, revsetItems, bookmarks } = args;

  if (context.kind === "value") {
    return buildValueItems(context, revsetItems, bookmarks);
  }

  // Both subcommand and flag-or-subcommand kinds need the loaded model.
  if (!help) {
    return [];
  }

  const items: AutocompleteListItem[] = [];

  if (context.kind === "flag-or-subcommand") {
    const dash = context.partial.startsWith("-");

    // Bookmark-name positional (e.g. `jj bookmark set `): surface bookmark
    // names alongside flags unless the user is clearly typing a flag.
    if (!dash && context.path[0] === "bookmark" && isBookmarkNamePositional(help)) {
      for (const name of fuzzyFilter(context.partial, bookmarks, (b) => b)) {
        items.push({ id: `bmname:${name}`, tag: "bm", text: name });
      }
    }

    const flags = fuzzyFilter(
      context.partial,
      help.flags,
      (flag) => [flag.short, flag.long].filter(Boolean).join(" "),
    );
    for (const flag of flags) {
      items.push({
        id: `flag:${flag.long}`,
        tag: flag.short,
        text: flag.long,
        bold: true,
        detail: flag.description || undefined,
      });
    }
  }

  // Subcommands appear for an explicit subcommand context and for groups that
  // also accept flags.
  if (context.kind === "subcommand" || help.kind === "group") {
    const subcommands = fuzzyFilter(context.partial, help.subcommands, (sub) => [
      sub.name,
      ...sub.aliases,
    ]);
    for (const sub of subcommands) {
      items.push({ id: `sub:${sub.name}`, text: sub.name, detail: sub.description || undefined });
    }
  }

  return items;
}

function buildValueItems(
  context: Extract<ComposeContext, { kind: "value" }>,
  revsetItems: readonly CompletionItem[],
  bookmarks: readonly string[],
): AutocompleteListItem[] {
  if (context.possibleValues && context.possibleValues.length > 0) {
    return fuzzyFilter(context.partial, context.possibleValues, (value) => value).map((value) => ({
      id: `enum:${value}`,
      text: value,
    }));
  }

  if (REVSET_TOKENS.has(context.token)) {
    const items: AutocompleteListItem[] = [];
    for (const literal of fuzzyFilter(context.partial, REVSET_LITERALS, (lit) => lit)) {
      items.push({ id: `lit:${literal}`, text: literal });
    }
    for (const item of matchCompletions(context.partial, revsetItems)) {
      const id = item.kind === "function" ? `fn:${item.name}:${item.hasParameters ? 1 : 0}` : `rev:${item.name}`;
      items.push({ id, tag: completionKindLabel(item.kind), text: item.name, detail: item.detail });
    }
    return items;
  }

  // Deferred tokens (FILESETS, TEMPLATE, REMOTE, MESSAGE, ...): no completion.
  void bookmarks;
  return [];
}

export function computeComposeAccept(args: {
  text: string;
  context: ComposeContext;
  item: AutocompleteListItem;
}): { text: string; cursorOffset: number } {
  const { text, context, item } = args;
  const [insertion, trailing] = acceptInsertion(item);
  const replacement = `${insertion}${trailing}`;
  const next = text.slice(0, context.start) + replacement + text.slice(context.end);
  return { text: next, cursorOffset: context.start + replacement.length };
}

// Returns the literal to insert and the trailing text (a space for most
// completions, "(" / "()" for revset functions so the cursor lands ready for
// arguments).
function acceptInsertion(item: AutocompleteListItem): [string, string] {
  const colon = item.id.indexOf(":");
  const prefix = colon >= 0 ? item.id.slice(0, colon) : item.id;
  const rest = colon >= 0 ? item.id.slice(colon + 1) : "";

  switch (prefix) {
    case "fn": {
      const sep = rest.lastIndexOf(":");
      const name = rest.slice(0, sep);
      const hasParameters = rest.slice(sep + 1) === "1";
      return [name, hasParameters ? "(" : "()"];
    }
    case "bmname":
    case "rev":
      return [quoteArg(rest), " "];
    case "sub":
    case "flag":
    case "lit":
    case "enum":
      return [rest, " "];
    default:
      return [item.text, " "];
  }
}
