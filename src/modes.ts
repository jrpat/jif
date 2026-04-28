import type { AppState } from "./domain/types.ts";
import type { CommandDefinition } from "./commands/definitions.ts";

export type Mode =
  | "normal"
  | "files"
  | "rebase"
  | "squash"
  | "command"
  | "revset"
  | "search"
  | "search-results";

export type ModeDefinition = Readonly<{
  id: Mode;
  parent?: Mode;
  inputPassthrough: boolean;
  label: string;
}>;

export const modeDefinitions: Readonly<Record<Mode, ModeDefinition>> = {
  normal: { id: "normal", inputPassthrough: false, label: "Revisions" },
  files: { id: "files", parent: "normal", inputPassthrough: false, label: "Files" },
  rebase: { id: "rebase", parent: "normal", inputPassthrough: false, label: "Rebase" },
  squash: { id: "squash", parent: "normal", inputPassthrough: false, label: "Squash" },
  command: { id: "command", inputPassthrough: true, label: "Command" },
  revset: { id: "revset", inputPassthrough: true, label: "Revset" },
  search: { id: "search", inputPassthrough: true, label: "Search" },
  "search-results": { id: "search-results", parent: "normal", inputPassthrough: false, label: "Search Results" },
};

export type Keymap = Readonly<Record<"_global" | Mode, Readonly<Record<string, string>>>>;

export const defaultKeymap: Keymap = {
  _global: {
    escape: "cancel",
    "ctrl-r": "refresh-repository",
    "ctrl-z": "suspend",
  },
  normal: {
    j: "move-down",
    down: "move-down",
    k: "move-up",
    up: "move-up",
    J: "move-parent",
    K: "move-child",
    Z: "suspend",
    l: "expand",
    right: "expand",
    h: "collapse",
    left: "collapse",
    ":": "command-bar",
    "!": "force-last-command",
    "?": "shortcut-panel",
    q: "quit",
    enter: "confirm",
    r: "rebase",
    S: "squash",
    n: "new-revision",
    e: "edit-revision",
    c: "commit",
    D: "describe",
    d: "show-diff",
    " ": "toggle-revision-selection",
    "-": "toggle-flags",
    _: "cycle-layout",
    u: "undo",
    U: "redo",
    "@": "jump-to-working-copy",
    L: "edit-revset",
    "/": "search",
    A: "absorb",
    a: "abandon",
  },
  files: {
    r: "restore",
    " ": "toggle-file-selection",
  },
  rebase: {
    s: "rebase-descendants",
  },
  squash: {},
  command: {},
  revset: {},
  search: {},
  "search-results": {
    n: "search-next",
    p: "search-prev",
  },
};

export function getActiveMode(state: AppState): Mode {
  if (state.focusMode === "command") return "command";
  if (state.focusMode === "revset") return "revset";
  if (state.focusMode === "search") return "search";
  if (state.focusMode === "files") return "files";
  if (state.commandDraft?.config.kind === "rebase") return "rebase";
  if (state.commandDraft?.config.kind === "squash") return "squash";
  if (state.searchQuery !== "") return "search-results";
  return "normal";
}

export function resolveCommand(
  mode: Mode,
  key: string,
  keymap: Keymap = defaultKeymap,
): string | null {
  const bindings = keymap[mode];
  if (bindings && key in bindings) {
    return bindings[key]!;
  }

  const def = modeDefinitions[mode];
  if (def.parent) {
    return resolveCommand(def.parent, key, keymap);
  }

  return null;
}

export function getCommandsForMode(
  mode: Mode,
  keymap: Keymap,
  definitions: readonly CommandDefinition[],
): readonly CommandDefinition[] {
  const ids = collectBoundCommandIds(mode, keymap);
  return definitions.filter((def) => ids.has(def.id));
}

function collectBoundCommandIds(
  mode: Mode,
  keymap: Keymap,
  collected: Set<string> = new Set(),
): ReadonlySet<string> {
  const bindings = keymap[mode];
  if (bindings) {
    for (const commandId of Object.values(bindings)) {
      collected.add(commandId);
    }
  }

  // Also include _global commands
  if (keymap._global) {
    for (const commandId of Object.values(keymap._global)) {
      collected.add(commandId);
    }
  }

  const def = modeDefinitions[mode];
  if (def.parent) {
    collectBoundCommandIds(def.parent, keymap, collected);
  }

  return collected;
}
