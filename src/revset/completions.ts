import { hasMatch, score } from "fzy.js";

export type CompletionKind = "function" | "bookmark" | "tag" | "alias";

export type CompletionItem = Readonly<{
  name: string;
  kind: CompletionKind;
  detail?: string;
  hasParameters?: boolean;
}>;

type FunctionDef = Readonly<{
  name: string;
  hasParameters: boolean;
  signature: string;
}>;

export const REVSET_FUNCTIONS: readonly FunctionDef[] = [
  { name: "all", hasParameters: false, signature: "all(): All visible commits" },
  { name: "ancestors", hasParameters: true, signature: "ancestors(x[, depth])" },
  { name: "at_operation", hasParameters: true, signature: "at_operation(op, x)" },
  { name: "author", hasParameters: true, signature: "author(pattern)" },
  { name: "author_date", hasParameters: true, signature: "author_date(pattern)" },
  { name: "author_email", hasParameters: true, signature: "author_email(pattern)" },
  { name: "author_name", hasParameters: true, signature: "author_name(pattern)" },
  { name: "bisect", hasParameters: true, signature: "bisect(x)" },
  { name: "bookmarks", hasParameters: true, signature: "bookmarks([pattern])" },
  { name: "change_id", hasParameters: true, signature: "change_id(prefix)" },
  { name: "children", hasParameters: true, signature: "children(x[, depth])" },
  { name: "coalesce", hasParameters: true, signature: "coalesce(revsets...)" },
  { name: "commit_id", hasParameters: true, signature: "commit_id(prefix)" },
  { name: "committer", hasParameters: true, signature: "committer(pattern)" },
  { name: "committer_date", hasParameters: true, signature: "committer_date(pattern)" },
  { name: "committer_email", hasParameters: true, signature: "committer_email(pattern)" },
  { name: "committer_name", hasParameters: true, signature: "committer_name(pattern)" },
  { name: "conflicts", hasParameters: false, signature: "conflicts(): Commits with conflicts" },
  { name: "connected", hasParameters: true, signature: "connected(x): Same as x::x" },
  { name: "descendants", hasParameters: true, signature: "descendants(x[, depth])" },
  { name: "description", hasParameters: true, signature: "description(pattern)" },
  { name: "diff_lines", hasParameters: true, signature: "diff_lines(text[, files])" },
  { name: "divergent", hasParameters: false, signature: "divergent(): Divergent commits" },
  { name: "empty", hasParameters: false, signature: "empty(): Commits modifying no files" },
  { name: "exactly", hasParameters: true, signature: "exactly(x, count)" },
  { name: "files", hasParameters: true, signature: "files(expression)" },
  { name: "first_ancestors", hasParameters: true, signature: "first_ancestors(x[, depth])" },
  { name: "first_parent", hasParameters: true, signature: "first_parent(x[, depth])" },
  { name: "fork_point", hasParameters: true, signature: "fork_point(x)" },
  { name: "git_head", hasParameters: false, signature: "git_head(): Git HEAD ref" },
  { name: "git_refs", hasParameters: false, signature: "git_refs(): All Git refs" },
  { name: "heads", hasParameters: true, signature: "heads(x)" },
  { name: "latest", hasParameters: true, signature: "latest(x[, count])" },
  { name: "merges", hasParameters: false, signature: "merges(): Merge commits" },
  { name: "mine", hasParameters: false, signature: "mine(): Commits by current user" },
  { name: "none", hasParameters: false, signature: "none(): No commits" },
  { name: "parents", hasParameters: true, signature: "parents(x[, depth])" },
  { name: "present", hasParameters: true, signature: "present(x)" },
  { name: "reachable", hasParameters: true, signature: "reachable(srcs, domain)" },
  { name: "remote_bookmarks", hasParameters: true, signature: "remote_bookmarks([name[, remote]])" },
  { name: "remote_tags", hasParameters: true, signature: "remote_tags([name[, remote]])" },
  { name: "root", hasParameters: false, signature: "root(): Oldest ancestor" },
  { name: "roots", hasParameters: true, signature: "roots(x)" },
  { name: "signed", hasParameters: false, signature: "signed(): Signed commits" },
  { name: "subject", hasParameters: true, signature: "subject(pattern)" },
  { name: "tags", hasParameters: true, signature: "tags([pattern])" },
  { name: "tracked_remote_bookmarks", hasParameters: true, signature: "tracked_remote_bookmarks([name[, remote]])" },
  { name: "untracked_remote_bookmarks", hasParameters: true, signature: "untracked_remote_bookmarks([name[, remote]])" },
  { name: "visible_heads", hasParameters: false, signature: "visible_heads(): All visible heads" },
  { name: "working_copies", hasParameters: false, signature: "working_copies(): All working copies" },
];

const TOKEN_DELIMITERS = new Set([" ", ",", "|", "&", "~", "(", ")", ".", ":"]);

export function extractLastToken(input: string): { start: number; token: string } {
  let lastDelimiter = -1;
  for (let i = input.length - 1; i >= 0; i--) {
    if (TOKEN_DELIMITERS.has(input[i]!)) {
      lastDelimiter = i;
      break;
    }
  }

  const start = lastDelimiter + 1;
  return { start, token: input.slice(start) };
}

export function buildCompletionItems(
  bookmarks: readonly string[],
  tags: readonly string[],
  aliases: Readonly<Record<string, string>>,
): CompletionItem[] {
  const items: CompletionItem[] = [];

  for (const fn of REVSET_FUNCTIONS) {
    items.push({
      name: fn.name,
      kind: "function",
      detail: fn.signature,
      hasParameters: fn.hasParameters,
    });
  }

  for (const name of bookmarks) {
    items.push({ name, kind: "bookmark" });
  }

  for (const name of tags) {
    items.push({ name, kind: "tag" });
  }

  for (const [name, expansion] of Object.entries(aliases)) {
    items.push({ name, kind: "alias", detail: expansion });
  }

  return items;
}

export function matchCompletions(
  token: string,
  items: readonly CompletionItem[],
): CompletionItem[] {
  if (!token) {
    return items.slice();
  }

  const scored: { item: CompletionItem; score: number }[] = [];

  for (const item of items) {
    if (hasMatch(token, item.name)) {
      scored.push({ item, score: score(token, item.name) });
    }
  }

  scored.sort((a, b) => a.score - b.score);

  return scored.map((s) => s.item).reverse();
}
