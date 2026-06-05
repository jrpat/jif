import type { AppState } from "./domain/types.ts";
import type { CommandDefinition } from "./commands/definitions.ts";

export type Mode =
  | "normal"
  | "files"
  | "op-log"
  | "evolog"
  | "inline-confirmation"
  | "rebase"
  | "restore"
  | "squash"
  | "interdiff"
  | "diff"
  | "absorb"
  | "command"
  | "revset"
  | "search"
  | "diff-viewer"
  | "notifications"
  | "bookmark"
  | "bookmark-move"
  | "extras";

export type ModeDefinition = Readonly<{
  id: Mode;
  parent?: Mode;
  inputPassthrough: boolean;
  label: string;
}>;

export const modeDefinitions: Readonly<Record<Mode, ModeDefinition>> = {
  normal: { id: "normal", inputPassthrough: false, label: "Revisions" },
  files: { id: "files", inputPassthrough: false, label: "Files" },
  "op-log": { id: "op-log", inputPassthrough: false, label: "Op Log" },
  evolog: { id: "evolog", inputPassthrough: false, label: "Evolog" },
  "inline-confirmation": { id: "inline-confirmation", inputPassthrough: false, label: "Confirm" },
  rebase: { id: "rebase", parent: "normal", inputPassthrough: false, label: "Rebase" },
  restore: { id: "restore", parent: "normal", inputPassthrough: false, label: "Restore" },
  squash: { id: "squash", parent: "normal", inputPassthrough: false, label: "Squash" },
  interdiff: { id: "interdiff", parent: "normal", inputPassthrough: false, label: "Interdiff" },
  diff: { id: "diff", parent: "normal", inputPassthrough: false, label: "Diff" },
  absorb: { id: "absorb", parent: "normal", inputPassthrough: false, label: "Absorb" },
  command: { id: "command", inputPassthrough: true, label: "Command" },
  revset: { id: "revset", inputPassthrough: true, label: "Revset" },
  search: { id: "search", inputPassthrough: true, label: "Search" },
  "diff-viewer": { id: "diff-viewer", inputPassthrough: false, label: "Diff" },
  notifications: { id: "notifications", inputPassthrough: false, label: "Notifications" },
  bookmark: { id: "bookmark", parent: "normal", inputPassthrough: false, label: "Bookmark" },
  "bookmark-move": { id: "bookmark-move", parent: "normal", inputPassthrough: false, label: "Bookmark Move" },
  extras: { id: "extras", inputPassthrough: false, label: "Extras" },
};

export type KeymapBinding =
  | string
  | Readonly<{ command: string; canonical: false }>;

export type Keymap = Readonly<Record<"_global" | Mode, Readonly<Record<string, KeymapBinding>>>>;

export const bindingCommand = (binding: KeymapBinding): string =>
  typeof binding === "string" ? binding : binding.command;

export const isCanonicalBinding = (binding: KeymapBinding): boolean =>
  typeof binding === "string";

const alias = (command: string): KeymapBinding => ({ command, canonical: false });

export const defaultKeymap: Keymap = {
  _global: {
    escape: "cancel",
    "ctrl-r": "refresh-repository",
    "ctrl-z": "suspend",
    "ctrl-n": "search-next",
    "ctrl-p": "search-prev",
    q: "quit",
    "~": "open-notifications",
  },
  normal: {
    j: "move-down",
    down: alias("move-down"),
    k: "move-up",
    up: alias("move-up"),
    G: "jump-to-bottom",
    J: "move-parent",
    K: "move-child",
    "ctrl-o": "jump-to-next-divergent",
    w: "move-to-next-workspace",
    W: "move-to-prev-workspace",
    Z: alias("suspend"),
    l: "expand",
    right: alias("expand"),
    h: "collapse",
    left: alias("collapse"),
    ":": "command-bar",
    "ctrl-;": alias("command-bar"),
    ">": "shell-command-bar",
    "ctrl-.": alias("shell-command-bar"),
    "!": "force-last-command",
    "?": "shortcut-panel",
    enter: "confirm",
    r: "rebase",
    R: "restore-revision",
    s: "split",
    S: "squash",
    i: "interdiff",
    "ctrl-d": "diff",
    n: "new-revision",
    e: "edit-revision",
    c: "commit",
    D: "describe",
    d: "show-revision-diff",
    " ": "toggle-revision-selection",
    "-": "toggle-flags",
    _: "cycle-layout",
    u: "undo",
    U: "redo",
    "@": "jump-to-working-copy",
    L: "edit-revset",
    "ctrl-l": alias("edit-revset"),
    "/": "search",
    A: "absorb",
    a: "abandon",
    o: alias("open-operation-log"),
    O: "open-operation-log",
    E: "open-evolog",
    b: "enter-bookmark-mode",
    ";": "enter-extras-mode",
  },
  files: {
    j: "move-down",
    down: alias("move-down"),
    k: "move-up",
    up: alias("move-up"),
    h: "collapse",
    left: alias("collapse"),
    s: "split",
    r: "restore",
    d: "show-file-diff",
    "ctrl-u": "untrack",
    " ": "toggle-file-selection",
    a: "select-all-files",
    "?": "shortcut-panel",
  },
  "op-log": {
    j: "move-down",
    down: alias("move-down"),
    k: "move-up",
    up: alias("move-up"),
    G: "jump-to-bottom",
    "@": "jump-to-current-operation",
    r: "restore-operation",
    R: "revert-operation",
    d: "show-operation-diff",
    ":": "command-bar",
    "ctrl-;": alias("command-bar"),
    "/": "search",
    "?": "shortcut-panel",
  },
  evolog: {
    j: "move-down",
    down: alias("move-down"),
    k: "move-up",
    up: alias("move-up"),
    G: "jump-to-bottom",
    ":": "command-bar",
    "ctrl-;": alias("command-bar"),
    "/": "search",
    "?": "shortcut-panel",
  },
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
    "alt-enter": "rebase-confirm-force",
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
  absorb: {},
  command: {},
  revset: {},
  search: {
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
  extras: {},
};

export function getActiveMode(state: AppState): Mode {
  if (state.focusMode === "command") return "command";
  if (state.focusMode === "revset") return "revset";
  if (state.focusMode === "search") return "search";
  if (state.focusMode === "inline-confirmation") return "inline-confirmation";
  if (state.focusMode === "diff-viewer") return "diff-viewer";
  if (state.focusMode === "op-log") return "op-log";
  if (state.focusMode === "evolog") return "evolog";
  if (state.focusMode === "notifications") return "notifications";
  if (state.focusMode === "files") return "files";
  if (state.commandDraft?.config.kind === "rebase") return "rebase";
  if (state.commandDraft?.config.kind === "restore") return "restore";
  if (state.commandDraft?.config.kind === "squash") return "squash";
  if (state.commandDraft?.config.kind === "interdiff") return "interdiff";
  if (state.commandDraft?.config.kind === "diff") return "diff";
  if (state.commandDraft?.config.kind === "absorb") return "absorb";
  if (state.commandDraft?.config.kind === "bookmark-move") return "bookmark-move";
  if (state.focusMode === "bookmark") return "bookmark";
  if (state.focusMode === "extras") return "extras";
  return "normal";
}

export function resolveCommand(
  mode: Mode,
  key: string,
  keymap: Keymap = defaultKeymap,
): string | null {
  const binding = getModeBindings(mode, keymap)[key];
  return binding === undefined ? null : bindingCommand(binding);
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
  const ids = new Set(Object.values(keymap[mode] ?? {}).map(bindingCommand));
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
    if (isCanonicalBinding(binding)) {
      results.push({ key, commandId: bindingCommand(binding) });
    }
  }
  for (const [key, binding] of Object.entries(keymap._global ?? {})) {
    if (key in directBindings) continue;
    if (key in parentBindings) continue;
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
    collected.add(bindingCommand(binding));
  }

  if (keymap._global) {
    for (const [key, binding] of Object.entries(keymap._global)) {
      if (!(key in modeBindings)) {
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
