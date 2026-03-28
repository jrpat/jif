import type { CommandDefinition } from "../commands/definitions.ts";
import type { AppState, FocusMode } from "../domain/types.ts";
import { commandCanExecute, getExpandedRevision, getFocusedRevision } from "../state/store.ts";

const MODIFIER_PREFIXES = new Set([
  "a",
  "alt",
  "c",
  "cmd",
  "ctrl",
  "m",
  "meta",
  "s",
  "shift",
]);

const GRID_GAP = 2;
const MIN_COLUMN_WIDTH = 24;
const MAX_KEY_WIDTH = 12;
const KEY_LABEL_ABBREVIATIONS: Readonly<Record<string, string>> = {
  escape: "esc",
  enter: "ret",
  space: "spc",
  left: "←",
  right: "→",
  down: "↓",
  up: "↑",
};

export type ShortcutEntry = Readonly<{
  id: string;
  commandId: string;
  keyLabel: string;
  title: string;
  sortKey: string;
}>;

export type ShortcutGrid = Readonly<{
  rows: readonly (readonly ShortcutEntry[])[];
  columnCount: number;
  columnWidth: number;
  keyWidth: number;
  gap: number;
}>;

export function normalizeShortcutSortKey(keyLabel: string): string {
  const parts = keyLabel.split("-");
  let index = 0;

  while (index < parts.length - 1 && MODIFIER_PREFIXES.has(parts[index]!.toLowerCase())) {
    index += 1;
  }

  const normalized = parts.slice(index).join("-");
  return normalized.length > 0 ? normalized : keyLabel;
}

export function buildShortcutEntries(
  commands: readonly Pick<CommandDefinition, "id" | "title" | "canonicalKeys">[],
): readonly ShortcutEntry[] {
  return commands
    .flatMap((command) =>
      command.canonicalKeys.map((rawKeyLabel) => {
        const keyLabel = formatShortcutKeyLabel(rawKeyLabel);
        return {
          id: `${command.id}:${rawKeyLabel}`,
        commandId: command.id,
        keyLabel,
        title: command.title,
        sortKey: normalizeShortcutSortKey(keyLabel),
        };
      })
    )
    .sort(compareShortcutEntries);
}

export function buildShortcutSummary(entries: readonly ShortcutEntry[]): string {
  return entries.map((entry) => `${entry.keyLabel} ${entry.title.toLowerCase()}`).join("   ");
}

export function buildShortcutGrid(
  entries: readonly ShortcutEntry[],
  availableWidth: number,
): ShortcutGrid {
  const safeWidth = Math.max(1, availableWidth);
  const maxColumns = Math.max(1, Math.floor((safeWidth + GRID_GAP) / (MIN_COLUMN_WIDTH + GRID_GAP)));
  const columnCount = Math.min(Math.max(entries.length, 1), maxColumns);
  const columnWidth = Math.max(
    1,
    Math.floor((safeWidth - GRID_GAP * (columnCount - 1)) / columnCount),
  );
  const keyWidth = Math.min(
    MAX_KEY_WIDTH,
    entries.reduce((maxWidth, entry) => Math.max(maxWidth, entry.keyLabel.length), 0),
  );

  const rows: ShortcutEntry[][] = [];
  for (let index = 0; index < entries.length; index += columnCount) {
    rows.push(entries.slice(index, index + columnCount));
  }

  return {
    rows,
    columnCount,
    columnWidth,
    keyWidth,
    gap: GRID_GAP,
  };
}

export function getShortcutPanelCommands(
  state: AppState,
  commands: readonly CommandDefinition[],
): readonly CommandDefinition[] {
  const actionable = commands.filter((command) => commandHasImmediateEffect(state, command));

  if (state.commandDraft !== null) {
    return actionable.filter((command) =>
      NAVIGATION_COMMAND_IDS.has(command.id) ||
      command.group === "mode" ||
      command.group === "cancel" ||
      command.id === "shortcut-panel"
    );
  }

  if (state.focusMode === "files") {
    return actionable.filter((command) =>
      NAVIGATION_COMMAND_IDS.has(command.id) ||
      command.group === "mode" ||
      command.group === "cancel" ||
      command.id === "shortcut-panel"
    );
  }

  return actionable;
}

export function computeShortcutPanelHeight(terminalHeight: number): number {
  const safeHeight = Math.max(1, terminalHeight);
  if (safeHeight < 6) {
    return safeHeight;
  }

  return Math.max(1, Math.min(20, Math.floor(safeHeight / 2)));
}

export function shortcutModeLabel(mode: FocusMode): string {
  switch (mode) {
    case "revisions":
      return "Revisions";
    case "files":
      return "Files";
    case "command":
      return "Command";
    case "revset":
      return "Revset";
  }
}

export function formatShortcutKeyLabel(keyLabel: string): string {
  return KEY_LABEL_ABBREVIATIONS[keyLabel] ?? keyLabel;
}

function compareShortcutEntries(a: ShortcutEntry, b: ShortcutEntry): number {
  const keyComparison = a.sortKey.localeCompare(b.sortKey);
  if (keyComparison !== 0) {
    return keyComparison;
  }

  const modifierComparison = modifierWeight(a.keyLabel) - modifierWeight(b.keyLabel);
  if (modifierComparison !== 0) {
    return modifierComparison;
  }

  const labelComparison = a.keyLabel.localeCompare(b.keyLabel);
  if (labelComparison !== 0) {
    return labelComparison;
  }

  return a.title.localeCompare(b.title);
}

function modifierWeight(keyLabel: string): number {
  return normalizeShortcutSortKey(keyLabel) === keyLabel ? 0 : 1;
}

const NAVIGATION_COMMAND_IDS = new Set([
  "move-down",
  "move-up",
  "expand",
  "collapse",
]);

function commandHasImmediateEffect(
  state: AppState,
  command: Pick<CommandDefinition, "id">,
): boolean {
  switch (command.id) {
    case "confirm":
      return commandCanExecute(state);
    case "cancel":
      return hasCancelableState(state);
    case "expand":
      return state.focusMode === "revisions" && getFocusedRevision(state) !== null;
    case "collapse":
      return state.expandedRevisionId !== null;
    case "toggle-revision-selection":
      return state.focusMode === "revisions" && getFocusedRevision(state) !== null;
    case "toggle-file-selection":
      return state.focusMode === "files" && currentFocusedFileExists(state);
    case "restore":
      return state.focusMode === "files" && currentFocusedFileExists(state);
    case "rebase":
    case "squash":
      return state.focusMode === "revisions" && getFocusedRevision(state) !== null;
    case "jump-to-working-copy":
      return state.revisions.some((revision) => revision.marker === "working-copy");
    default:
      return true;
  }
}

function hasCancelableState(state: AppState): boolean {
  return (
    state.statusMessage !== null ||
    state.focusMode === "command" ||
    state.commandDraft !== null ||
    state.selectedRevisionIds.length > 0 ||
    state.focusMode === "files"
  );
}

function currentFocusedFileExists(state: AppState): boolean {
  const expandedRevision = getExpandedRevision(state);
  return expandedRevision !== null && expandedRevision.files[state.focusedFileIndex] !== undefined;
}
