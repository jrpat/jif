import type { AppState } from "./domain/types.ts";
import type { CommandDefinition } from "./commands/definitions.ts";

export type Mode =
  | "normal"
  | "files"
  | "op-log"
  | "inline-confirmation"
  | "rebase"
  | "squash"
  | "command"
  | "revset"
  | "search"
  | "search-results"
  | "diff-viewer"
  | "notifications";

export type ModeDefinition = Readonly<{
  id: Mode;
  parent?: Mode;
  inputPassthrough: boolean;
  label: string;
}>;

export const modeDefinitions: Readonly<Record<Mode, ModeDefinition>> = {
  normal: { id: "normal", inputPassthrough: false, label: "Revisions" },
  files: { id: "files", parent: "normal", inputPassthrough: false, label: "Files" },
  "op-log": { id: "op-log", inputPassthrough: false, label: "Op Log" },
  "inline-confirmation": { id: "inline-confirmation", inputPassthrough: false, label: "Confirm" },
  rebase: { id: "rebase", parent: "normal", inputPassthrough: false, label: "Rebase" },
  squash: { id: "squash", parent: "normal", inputPassthrough: false, label: "Squash" },
  command: { id: "command", inputPassthrough: true, label: "Command" },
  revset: { id: "revset", inputPassthrough: true, label: "Revset" },
  search: { id: "search", inputPassthrough: true, label: "Search" },
  "search-results": { id: "search-results", parent: "normal", inputPassthrough: false, label: "Search Results" },
  "diff-viewer": { id: "diff-viewer", inputPassthrough: false, label: "Diff" },
  notifications: { id: "notifications", inputPassthrough: false, label: "Notifications" },
};

export type Keymap = Readonly<Record<"_global" | Mode, Readonly<Record<string, string>>>>;

export const defaultKeymap: Keymap = {
  _global: {
    escape: "cancel",
    "ctrl-r": "refresh-repository",
    "ctrl-z": "suspend",
    q: "quit",
    "`": "open-notifications",
  },
  normal: {
    j: "move-down",
    down: "move-down",
    k: "move-up",
    up: "move-up",
    G: "jump-to-bottom",
    J: "move-parent",
    K: "move-child",
    Z: "suspend",
    l: "expand",
    right: "expand",
    h: "collapse",
    left: "collapse",
    ":": "command-bar",
    ">": "shell-command-bar",
    "!": "force-last-command",
    "?": "shortcut-panel",
    enter: "confirm",
    r: "rebase",
    s: "split",
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
    o: "open-operation-log",
    O: "open-operation-log",
  },
  files: {
    s: "split",
    r: "restore",
    " ": "toggle-file-selection",
  },
  "op-log": {
    j: "move-down",
    down: "move-down",
    k: "move-up",
    up: "move-up",
    G: "jump-to-bottom",
    r: "restore-operation",
    R: "revert-operation",
    d: "show-operation-diff",
    "?": "shortcut-panel",
  },
  "inline-confirmation": {
    h: "inline-confirmation-prev-option",
    left: "inline-confirmation-prev-option",
    l: "inline-confirmation-next-option",
    right: "inline-confirmation-next-option",
    enter: "confirm",
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
    down: "move-down",
    k: "move-up",
    up: "move-up",
    G: "jump-to-bottom",
    l: "expand-notification",
    right: "expand-notification",
    h: "collapse-notification",
    left: "collapse-notification",
    "`": "cancel",
    "?": "shortcut-panel",
  },
};

export function getActiveMode(state: AppState): Mode {
  if (state.focusMode === "command") return "command";
  if (state.focusMode === "revset") return "revset";
  if (state.focusMode === "search") return "search";
  if (state.focusMode === "inline-confirmation") return "inline-confirmation";
  if (state.focusMode === "diff-viewer") return "diff-viewer";
  if (state.focusMode === "op-log") return "op-log";
  if (state.focusMode === "notifications") return "notifications";
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
  return getModeBindings(mode, keymap)[key] ?? null;
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
  const ids = new Set(Object.values(keymap[mode] ?? {}));
  return definitions.filter((def) => ids.has(def.id));
}

function collectBoundCommandIds(
  mode: Mode,
  keymap: Keymap,
  collected: Set<string> = new Set(),
): ReadonlySet<string> {
  const modeBindings = getModeBindings(mode, keymap);
  for (const commandId of Object.values(modeBindings)) {
    collected.add(commandId);
  }

  if (keymap._global) {
    for (const [key, commandId] of Object.entries(keymap._global)) {
      if (!(key in modeBindings)) {
        collected.add(commandId);
      }
    }
  }

  return collected;
}

function getModeBindings(
  mode: Mode,
  keymap: Keymap,
): Readonly<Record<string, string>> {
  const def = modeDefinitions[mode];
  const parentBindings = def.parent ? getModeBindings(def.parent, keymap) : {};
  return {
    ...parentBindings,
    ...(keymap[mode] ?? {}),
  };
}
