import type { AppState } from "./domain/types.ts";
import type { CommandDefinition } from "./commands/definitions.ts";

export type Mode =
  | "log"
  | "revision-draft"
  | "revision-log"
  | "revision-files"
  | "op-log"
  | "evolog"
  | "inline-confirmation"
  | "rebase"
  | "duplicate"
  | "revert"
  | "restore"
  | "squash"
  | "interdiff"
  | "diff"
  | "absorb"
  | "command"
  | "revset"
  | "file-search"
  | "search"
  | "diff-viewer"
  | "notifications"
  | "bookmark"
  | "bookmark-move"
  | "set-parents"
  | "new-between"
  | "extra";

export type ModeDefinition = Readonly<{
  id: Mode;
  parent?: Mode;
  inputPassthrough: boolean;
  label: string;
}>;

export const modeDefinitions: Readonly<Record<Mode, ModeDefinition>> = {
  // Abstract parent for scrollable log modes. It is never itself active.
  log: { id: "log", inputPassthrough: false, label: "Log" },
  // Abstract parent for revision operation composers. It keeps draft mechanics
  // separate from both the shared log controls and revision-log-only commands.
  "revision-draft": {
    id: "revision-draft",
    parent: "log",
    inputPassthrough: false,
    label: "Revision Draft",
  },
  "revision-log": { id: "revision-log", parent: "log", inputPassthrough: false, label: "Revisions" },
  "revision-files": { id: "revision-files", inputPassthrough: false, label: "Files" },
  "op-log": { id: "op-log", parent: "log", inputPassthrough: false, label: "Op Log" },
  evolog: { id: "evolog", parent: "log", inputPassthrough: false, label: "Evolog" },
  "inline-confirmation": { id: "inline-confirmation", inputPassthrough: false, label: "Confirm" },
  rebase: { id: "rebase", parent: "revision-draft", inputPassthrough: false, label: "Rebase" },
  duplicate: { id: "duplicate", parent: "revision-draft", inputPassthrough: false, label: "Duplicate" },
  revert: { id: "revert", parent: "revision-draft", inputPassthrough: false, label: "Revert" },
  restore: { id: "restore", parent: "revision-draft", inputPassthrough: false, label: "Restore" },
  squash: { id: "squash", parent: "revision-draft", inputPassthrough: false, label: "Squash" },
  interdiff: { id: "interdiff", parent: "revision-draft", inputPassthrough: false, label: "Interdiff" },
  diff: { id: "diff", parent: "revision-draft", inputPassthrough: false, label: "Diff" },
  absorb: { id: "absorb", parent: "revision-draft", inputPassthrough: false, label: "Absorb" },
  command: { id: "command", inputPassthrough: true, label: "Command" },
  revset: { id: "revset", inputPassthrough: true, label: "Revset" },
  "file-search": { id: "file-search", inputPassthrough: true, label: "File Search" },
  search: { id: "search", inputPassthrough: true, label: "Search" },
  "diff-viewer": { id: "diff-viewer", inputPassthrough: false, label: "Diff" },
  notifications: { id: "notifications", inputPassthrough: false, label: "Notifications" },
  bookmark: { id: "bookmark", parent: "log", inputPassthrough: false, label: "Bookmark" },
  "bookmark-move": { id: "bookmark-move", parent: "revision-draft", inputPassthrough: false, label: "Bookmark Move" },
  "set-parents": { id: "set-parents", parent: "revision-draft", inputPassthrough: false, label: "Set Parents" },
  "new-between": { id: "new-between", parent: "revision-draft", inputPassthrough: false, label: "New Between" },
  extra: { id: "extra", inputPassthrough: false, label: "Extra" },
};

export type KeymapBinding =
  | string
  | Readonly<{ command: string; canonical: false }>
  | null;

export type Keymap = Readonly<Record<"_global" | Mode, Readonly<Record<string, KeymapBinding>>>>;

export const bindingCommand = (binding: NonNullable<KeymapBinding>): string =>
  typeof binding === "string" ? binding : binding.command;

export const isCanonicalBinding = (binding: KeymapBinding): binding is string =>
  typeof binding === "string";

const alias = (command: string): KeymapBinding => ({ command, canonical: false });

// Preview-pane controls, shared by every mode that can show a preview
// (revisions/files/op-log/evolog). Kept in one place so a key change lands in
// all of them at once.
const previewBindings = {
  p: "toggle-preview",
  P: "cycle-preview-position",
  W: "toggle-preview-word-wrap",
  "ctrl-[": "expand-preview",
  "ctrl-]": "shrink-preview",
  "ctrl-j": "scroll-preview-down",
  "ctrl-k": "scroll-preview-up",
} satisfies Readonly<Record<string, KeymapBinding>>;

export const defaultKeymap: Keymap = {
  _global: {
    escape: "cancel",
    "ctrl-r": "refresh-repository",
    "ctrl-,": "reload-config",
    "ctrl-\\": "toggle-dry-run",
    "ctrl-z": "suspend",
    "ctrl-n": "search-next",
    "ctrl-p": "search-prev",
    "ctrl-j": "scroll-help-down",
    "ctrl-k": "scroll-help-up",
    q: "quit",
    "~": "open-notifications",
    "alt-`": "open-releases",
  },
  // Shared by scrollable log modes, including revision operation drafts.
  log: {
    j: "move-down",
    down: alias("move-down"),
    k: "move-up",
    up: alias("move-up"),
    G: "jump-to-bottom",
    ":": "command-bar",
    "ctrl-;": alias("command-bar"),
    ">": "shell-command-bar",
    "ctrl-.": alias("shell-command-bar"),
    "/": "search",
    f: "fast-jump",
    "?": "shortcut-panel",
    "!": "force-last-command",
    "-": "toggle-flags",
    ...previewBindings,
  },
  "revision-draft": {
    enter: "confirm",
    " ": "toggle-revision-selection",
  },
  "revision-log": {
    J: "move-parent",
    K: "move-child",
    "alt-j": "jump-to-next-divergent",
    "]": "move-to-next-bookmark",
    "[": "move-to-prev-bookmark",
    "}": "move-to-next-workspace",
    "{": "move-to-prev-workspace",
    tab: "switch-active-workspace",
    Z: alias("suspend"),
    l: "expand",
    right: alias("expand"),
    h: "collapse",
    left: alias("collapse"),
    g: "git-command-bar",
    enter: "confirm",
    r: "rebase",
    R: "restore-revision",
    y: "duplicate",
    "alt-r": "revert",
    s: "squash",
    S: "squash-onto",
    "ctrl-s": "split",
    "alt-s": "split-parallel",
    i: "interdiff",
    "ctrl-d": "diff",
    n: "new-revision",
    "alt-n": "new-between",
    e: "edit-revision",
    E: "diff-edit-revision",
    c: "commit",
    D: "describe",
    d: "show-revision-diff",
    " ": "toggle-revision-selection",
    _: "cycle-layout",
    u: "undo",
    "alt-u": "redo",
    "@": "jump-to-working-copy",
    L: "edit-revset",
    "ctrl-l": alias("edit-revset"),
    "ctrl-f": "find-file",
    A: "absorb",
    a: "abandon",
    "ctrl-o": "open-operation-log",
    "ctrl-e": "open-evolog",
    b: "enter-bookmark-mode",
    M: "set-parents",
    ";": "enter-extra-mode",
    "ctrl-enter": "expand-diff-context",
  },
  "revision-files": {
    j: "move-down",
    down: alias("move-down"),
    k: "move-up",
    up: alias("move-up"),
    h: "collapse",
    left: alias("collapse"),
    r: "restore",
    d: "show-file-diff",
    "ctrl-u": "untrack",
    "ctrl-f": "restrict-revset-to-focused-file",
    " ": "toggle-file-selection",
    a: "select-all-files",
    ":": "command-bar",
    "ctrl-;": alias("command-bar"),
    ">": "shell-command-bar",
    "ctrl-.": alias("shell-command-bar"),
    "?": "shortcut-panel",
    "ctrl-enter": "toggle-preview-full-file",
    ...previewBindings,
  },
  // Inherits movement/search/preview from `log`; only the operation-specific
  // actions live here.
  "op-log": {
    "@": "jump-to-current-operation",
    r: "restore-operation",
    R: "revert-operation",
    d: "show-operation-diff",
  },
  // Fully covered by the shared `log` bindings — it has no keys of its own.
  evolog: {},
  "inline-confirmation": {
    h: "inline-confirmation-prev-option",
    left: alias("inline-confirmation-prev-option"),
    l: "inline-confirmation-next-option",
    right: alias("inline-confirmation-next-option"),
    enter: "confirm",
  },
  rebase: {
    s: "rebase-descendants",
    B: "rebase-source-branch",
    b: "rebase-target-before",
    a: "rebase-target-after",
    i: "rebase-target-insert-between",
    e: "rebase-toggle-skip-emptied",
    " ": "rebase-toggle-selection",
    "ctrl-space": "rebase-toggle-selection-kind",
  },
  duplicate: {
    b: "rebase-target-before",
    a: "rebase-target-after",
    i: "rebase-target-insert-between",
  },
  revert: {
    b: "rebase-target-before",
    a: "rebase-target-after",
    i: "rebase-target-insert-between",
  },
  restore: {},
  squash: {
    s: "squash-from-anchor",
    S: alias("squash-from-anchor"),
  },
  interdiff: {
    "=": "interdiff-swap",
  },
  diff: {},
  absorb: {
    s: "absorb-descendants",
  },
  command: {
    "ctrl-c": alias("cancel"),
  },
  revset: {
    "ctrl-c": alias("cancel"),
  },
  "file-search": {
    "ctrl-c": alias("cancel"),
  },
  search: {
    "ctrl-c": alias("cancel"),
    tab: "search-toggle-id-only",
    "ctrl-i": alias("search-toggle-id-only"),
  },
  "diff-viewer": {
    j: "scroll-down",
    k: "scroll-up",
    h: "scroll-left",
    l: "scroll-right",
    J: "scroll-down-large",
    K: "scroll-up-large",
    H: "scroll-left-large",
    L: "scroll-right-large",
  },
  notifications: {
    j: "move-down",
    down: alias("move-down"),
    k: "move-up",
    up: alias("move-up"),
    G: "jump-to-bottom",
    l: "expand-notification",
    right: alias("expand-notification"),
    h: "collapse-notification",
    left: alias("collapse-notification"),
    "ctrl-g": "edit-notification",
    "~": "cancel",
    "?": "shortcut-panel",
  },
  bookmark: {
    c: "bookmark-create",
    m: "bookmark-move-from",
    M: "bookmark-move-to",
    d: "bookmark-delete",
    f: "bookmark-forget",
    s: "bookmark-set",
    t: "bookmark-track",
    u: "bookmark-untrack",
  },
  "bookmark-move": {},
  "set-parents": {
    " ": "toggle-set-parents-pick",
  },
  "new-between": {
    " ": "toggle-new-between-before",
  },
  extra: {},
};

export function getActiveMode(state: AppState): Mode {
  if (state.focusMode === "command") return "command";
  if (state.focusMode === "revset") return "revset";
  if (state.focusMode === "file-search") return "file-search";
  if (state.focusMode === "search") return "search";
  if (state.focusMode === "inline-confirmation") return "inline-confirmation";
  if (state.focusMode === "diff-viewer") return "diff-viewer";
  if (state.focusMode === "op-log") return "op-log";
  if (state.focusMode === "evolog") return "evolog";
  if (state.focusMode === "notifications") return "notifications";
  if (state.focusMode === "files") return "revision-files";
  if (state.commandDraft?.config.kind === "rebase") return "rebase";
  if (state.commandDraft?.config.kind === "duplicate") return "duplicate";
  if (state.commandDraft?.config.kind === "revert") return "revert";
  if (state.commandDraft?.config.kind === "restore") return "restore";
  if (state.commandDraft?.config.kind === "squash") return "squash";
  if (state.commandDraft?.config.kind === "interdiff") return "interdiff";
  if (state.commandDraft?.config.kind === "diff") return "diff";
  if (state.commandDraft?.config.kind === "absorb") return "absorb";
  if (state.commandDraft?.config.kind === "set-parents") return "set-parents";
  if (state.commandDraft?.config.kind === "new-between") return "new-between";
  if (state.commandDraft?.config.kind === "bookmark-move") return "bookmark-move";
  if (state.focusMode === "bookmark") return "bookmark";
  if (state.focusMode === "extra") return "extra";
  return "revision-log";
}

export function resolveCommand(
  mode: Mode,
  key: string,
  keymap: Keymap = defaultKeymap,
): string | null {
  const binding = getModeBindings(mode, keymap)[key];
  return binding == null ? null : bindingCommand(binding);
}

export function isKeyExplicitlyUnbound(
  mode: Mode,
  key: string,
  keymap: Keymap = defaultKeymap,
): boolean {
  return getModeBindings(mode, keymap)[key] === null;
}

export function getCommandsForMode(
  mode: Mode,
  keymap: Keymap,
  definitions: readonly CommandDefinition[],
): readonly CommandDefinition[] {
  const ids = collectBoundCommandIds(mode, keymap);
  return definitions.filter((def) => ids.has(def.id));
}

export function getDirectCommandsForMode(
  mode: Mode,
  keymap: Keymap,
  definitions: readonly CommandDefinition[],
): readonly CommandDefinition[] {
  const ids = new Set(
    Object.values(keymap[mode] ?? {})
      .filter((binding): binding is NonNullable<KeymapBinding> => binding !== null)
      .map(bindingCommand),
  );
  return definitions.filter((def) => ids.has(def.id));
}

export type CanonicalKeyBinding = Readonly<{ key: string; commandId: string }>;

export function collectCanonicalBindingsForMode(
  mode: Mode,
  keymap: Keymap,
): readonly CanonicalKeyBinding[] {
  return [
    ...collectDirectCanonicalBindingsForMode(mode, keymap),
    ...collectInheritedAndGlobalCanonicalBindings(mode, keymap),
  ];
}

export function collectInheritedAndGlobalCanonicalBindings(
  mode: Mode,
  keymap: Keymap,
): readonly CanonicalKeyBinding[] {
  const directBindings = keymap[mode] ?? {};
  const def = modeDefinitions[mode];
  const parentBindings = def.parent ? getModeBindings(def.parent, keymap) : {};

  const results: CanonicalKeyBinding[] = [];
  for (const [key, binding] of Object.entries(parentBindings)) {
    if (key in directBindings) continue;
    if (binding === null) continue;
    if (isCanonicalBinding(binding)) {
      results.push({ key, commandId: bindingCommand(binding) });
    }
  }
  for (const [key, binding] of Object.entries(keymap._global ?? {})) {
    if (key in directBindings) continue;
    if (key in parentBindings) continue;
    if (binding === null) continue;
    if (isCanonicalBinding(binding)) {
      results.push({ key, commandId: bindingCommand(binding) });
    }
  }
  return results;
}

export function collectDirectCanonicalBindingsForMode(
  mode: Mode,
  keymap: Keymap,
): readonly CanonicalKeyBinding[] {
  const results: CanonicalKeyBinding[] = [];
  for (const [key, binding] of Object.entries(keymap[mode] ?? {})) {
    if (binding === null) continue;
    if (isCanonicalBinding(binding)) {
      results.push({ key, commandId: bindingCommand(binding) });
    }
  }
  return results;
}

function collectBoundCommandIds(
  mode: Mode,
  keymap: Keymap,
  collected: Set<string> = new Set(),
): ReadonlySet<string> {
  const modeBindings = getModeBindings(mode, keymap);
  for (const binding of Object.values(modeBindings)) {
    if (binding === null) continue;
    collected.add(bindingCommand(binding));
  }

  if (keymap._global) {
    for (const [key, binding] of Object.entries(keymap._global)) {
      if (!(key in modeBindings) && binding !== null) {
        collected.add(bindingCommand(binding));
      }
    }
  }

  return collected;
}

function getModeBindings(
  mode: Mode,
  keymap: Keymap,
): Readonly<Record<string, KeymapBinding>> {
  const def = modeDefinitions[mode];
  const parentBindings = def.parent ? getModeBindings(def.parent, keymap) : {};
  return {
    ...parentBindings,
    ...(keymap[mode] ?? {}),
  };
}
