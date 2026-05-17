import type { CommandDefinition } from "../commands/definitions.ts";
import type { AppState } from "../domain/types.ts";
import type { Mode } from "../modes.ts";
import { commandCanExecute, getExpandedRevision, getFocusedChildRevision, getFocusedParentRevision, getFocusedRevision } from "../state/store.ts";

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
const SUMMARY_GAP = "   ";
const MODIFIER_LABELS: Readonly<Record<string, string>> = {
  a: "⌥",
  alt: "⌥",
  c: "⌃",
  cmd: "⌘",
  ctrl: "⌃",
  m: "⌘",
  meta: "⌘",
  s: "⇧",
  shift: "⇧",
};
const KEY_LABEL_ABBREVIATIONS: Readonly<Record<string, string>> = {
  escape: "esc",
  enter: "ret",
  space: "⎵",
  " ": "⎵",
  left: "←",
  right: "→",
  down: "↓",
  up: "↑",
};
const SHORTCUT_SUMMARY_SEGMENTS: readonly Readonly<{
  commandIds: readonly string[];
  label: string;
}>[] = [
  { commandIds: ["command-bar"], label: "command" },
  { commandIds: ["shortcut-panel"], label: "help" },
  { commandIds: ["move-down", "move-up"], label: "move" },
  { commandIds: ["edit-revision"], label: "edit" },
  { commandIds: ["new-revision"], label: "new" },
  { commandIds: ["show-revision-diff", "show-file-diff"], label: "diff" },
  { commandIds: ["commit"], label: "commit" },
];

export type ShortcutEntry = Readonly<{
  id: string;
  commandId: string;
  hasModifier: boolean;
  keyLabel: string;
  title: string;
  sortKey: string;
}>;

export type ShortcutPanelBinding = Readonly<{
  key: string;
  command: Pick<CommandDefinition, "id" | "title">;
}>;

export type ShortcutGrid = Readonly<{
  rows: readonly (readonly ShortcutEntry[])[];
  columnCount: number;
  columnWidth: number;
  keyWidth: number;
  gap: number;
}>;

export type ShortcutSummarySegment = Readonly<{
  keyLabel: string;
  label: string;
}>;

export type ShortcutPanelLayout =
  | Readonly<{ kind: "single"; grid: ShortcutGrid }>
  | Readonly<{ kind: "split"; topGrid: ShortcutGrid; bottomGrid: ShortcutGrid }>;

export function shortcutLayoutRowCount(layout: ShortcutPanelLayout): number {
  if (layout.kind === "single") return layout.grid.rows.length;
  const topRows = layout.topGrid.rows.length;
  const bottomRows = layout.bottomGrid.rows.length;
  if (topRows === 0) return bottomRows;
  if (bottomRows === 0) return topRows;
  return topRows + bottomRows + 1;
}

export function normalizeShortcutSortKey(keyLabel: string): string {
  const shortcut = splitShortcutKey(keyLabel);
  return shortcut?.baseKey ?? keyLabel;
}

export function buildShortcutEntries(
  bindings: readonly ShortcutPanelBinding[],
): readonly ShortcutEntry[] {
  return bindings
    .map(({ key: rawKeyLabel, command }) => {
      const keyLabel = formatShortcutKeyLabel(rawKeyLabel);
      return {
        id: `${command.id}:${rawKeyLabel}`,
        commandId: command.id,
        hasModifier: hasShortcutModifier(rawKeyLabel),
        keyLabel,
        title: command.title,
        sortKey: normalizeShortcutSortKey(rawKeyLabel),
      };
    })
    .sort(compareShortcutEntries);
}

export function buildShortcutSummary(
  entries: readonly ShortcutEntry[],
  availableWidth = Number.POSITIVE_INFINITY,
): string {
  return buildShortcutSummarySegments(entries, availableWidth)
    .map((segment) => `${segment.keyLabel} ${segment.label}`)
    .join(SUMMARY_GAP);
}

export function buildShortcutSummarySegments(
  entries: readonly ShortcutEntry[],
  availableWidth = Number.POSITIVE_INFINITY,
): readonly ShortcutSummarySegment[] {
  const keyLabelsByCommand = groupShortcutLabelsByCommand(entries);
  const safeWidth = Math.max(1, availableWidth);
  const summarySegments: ShortcutSummarySegment[] = [];
  let summaryWidth = 0;

  for (const segment of SHORTCUT_SUMMARY_SEGMENTS) {
    const keyLabels = collectSummaryKeyLabels(keyLabelsByCommand, segment.commandIds);
    if (keyLabels.length === 0) {
      continue;
    }

    const summarySegment = {
      keyLabel: keyLabels.join("/"),
      label: segment.label,
    } satisfies ShortcutSummarySegment;
    const segmentWidth = summarySegment.keyLabel.length + 1 + summarySegment.label.length;

    if (summarySegments.length === 0) {
      summarySegments.push(summarySegment);
      summaryWidth = segmentWidth;
      continue;
    }

    if (summaryWidth + SUMMARY_GAP.length + segmentWidth <= safeWidth) {
      summarySegments.push(summarySegment);
      summaryWidth += SUMMARY_GAP.length + segmentWidth;
    }
  }

  return summarySegments;
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

  const rowCount = Math.max(1, Math.ceil(entries.length / columnCount));
  const rows: ShortcutEntry[][] = Array.from({ length: rowCount }, () => []);
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const entry = entries[columnIndex * rowCount + rowIndex];
      if (entry) {
        rows[rowIndex]!.push(entry);
      }
    }
  }

  return {
    rows,
    columnCount,
    columnWidth,
    keyWidth,
    gap: GRID_GAP,
  };
}

export type ShortcutPanelBindingInput = Readonly<{
  key: string;
  command: CommandDefinition;
}>;

export function getShortcutPanelBindings(
  state: AppState,
  bindings: readonly ShortcutPanelBindingInput[],
): readonly ShortcutPanelBindingInput[] {
  const actionable = bindings.filter(({ command }) => commandHasImmediateEffect(state, command));

  if (state.commandDraft !== null) {
    return actionable.filter(({ command }) =>
      NAVIGATION_COMMAND_IDS.has(command.id) ||
      command.group === "mode" ||
      command.group === "cancel" ||
      command.id === "shortcut-panel" ||
      command.id === "force-last-command"
    );
  }

  if (state.focusMode === "inline-confirmation") {
    return actionable.filter(({ command }) =>
      command.group === "mode" ||
      command.group === "cancel" ||
      command.id === "shortcut-panel" ||
      command.id === "force-last-command"
    );
  }

  if (state.focusMode === "files") {
    return actionable.filter(({ command }) =>
      NAVIGATION_COMMAND_IDS.has(command.id) ||
      command.group === "mode" ||
      command.group === "cancel" ||
      command.id === "shortcut-panel" ||
      command.id === "force-last-command"
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

export function shortcutModeLabel(mode: Mode): string {
  switch (mode) {
    case "normal":
      return "Revisions";
    case "files":
      return "Files";
    case "op-log":
      return "Op Log";
    case "evolog":
      return "Evolog";
    case "inline-confirmation":
      return "Confirm";
    case "rebase":
      return "Rebase";
    case "restore":
      return "Restore";
    case "squash":
      return "Squash";
    case "command":
      return "Command";
    case "revset":
      return "Revset";
    case "search":
      return "Search";
    case "search-results":
    case "op-log-search-results":
    case "evolog-search-results":
      return "Search Results";
    case "diff-viewer":
      return "Diff";
    case "notifications":
      return "Notifications";
    case "bookmark":
      return "Bookmark";
    case "bookmark-move":
      return "Bookmark Move";
    case "extras":
      return "Extras";
  }
}

export function formatShortcutKeyLabel(keyLabel: string): string {
  const shortcut = splitShortcutKey(keyLabel);
  if (shortcut === null) {
    return formatBaseKeyLabel(keyLabel);
  }

  return `${shortcut.modifiers.map((modifier) => MODIFIER_LABELS[modifier]!).join("")}${formatBaseKeyLabel(shortcut.baseKey)}`;
}

function compareShortcutEntries(a: ShortcutEntry, b: ShortcutEntry): number {
  const keyComparison = a.sortKey.localeCompare(b.sortKey);
  if (keyComparison !== 0) {
    return keyComparison;
  }

  const modifierComparison = modifierWeight(a) - modifierWeight(b);
  if (modifierComparison !== 0) {
    return modifierComparison;
  }

  const labelComparison = a.keyLabel.localeCompare(b.keyLabel);
  if (labelComparison !== 0) {
    return labelComparison;
  }

  return a.title.localeCompare(b.title);
}

function modifierWeight(entry: ShortcutEntry): number {
  return entry.hasModifier ? 1 : 0;
}

function collectSummaryKeyLabels(
  keyLabelsByCommand: ReadonlyMap<string, readonly string[]>,
  commandIds: readonly string[],
): readonly string[] {
  const keyLabels: string[] = [];

  for (const commandId of commandIds) {
    for (const keyLabel of keyLabelsByCommand.get(commandId) ?? []) {
      if (!keyLabels.includes(keyLabel)) {
        keyLabels.push(keyLabel);
      }
    }
  }

  return keyLabels;
}

function groupShortcutLabelsByCommand(
  entries: readonly ShortcutEntry[],
): ReadonlyMap<string, readonly string[]> {
  const keyLabelsByCommand = new Map<string, string[]>();

  for (const entry of entries) {
    const keyLabels = keyLabelsByCommand.get(entry.commandId) ?? [];
    if (!keyLabels.includes(entry.keyLabel)) {
      keyLabels.push(entry.keyLabel);
      keyLabelsByCommand.set(entry.commandId, keyLabels);
    }
  }

  return keyLabelsByCommand;
}

function formatBaseKeyLabel(keyLabel: string): string {
  return KEY_LABEL_ABBREVIATIONS[keyLabel] ?? keyLabel;
}

function hasShortcutModifier(keyLabel: string): boolean {
  return splitShortcutKey(keyLabel) !== null;
}

function splitShortcutKey(keyLabel: string): Readonly<{
  modifiers: readonly string[];
  baseKey: string;
}> | null {
  const parts = keyLabel.split("-");
  if (parts.length < 2) {
    return null;
  }

  const baseKey = parts.at(-1);
  const modifiers = parts.slice(0, -1).map((part) => part.toLowerCase());
  if (baseKey === undefined || modifiers.length === 0 || modifiers.some((part) => !MODIFIER_PREFIXES.has(part))) {
    return null;
  }

  return {
    modifiers,
    baseKey,
  };
}

const NAVIGATION_COMMAND_IDS = new Set([
  "move-down",
  "move-up",
  "move-parent",
  "move-child",
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
      return state.expandedRowId !== null;
    case "move-parent":
      return getFocusedParentRevision(state) !== null;
    case "move-child":
      return getFocusedChildRevision(state) !== null;
    case "toggle-revision-selection":
      return state.focusMode === "revisions" && getFocusedRevision(state) !== null;
    case "toggle-file-selection":
      return state.focusMode === "files" && currentFocusedFileExists(state);
    case "restore":
      return state.focusMode === "files" && currentFocusedFileExists(state);
    case "split":
      return (state.focusMode === "revisions" || state.focusMode === "files") && getFocusedRevision(state) !== null;
    case "inline-confirmation-prev-option":
    case "inline-confirmation-next-option":
      return state.focusMode === "inline-confirmation" && state.inlineConfirmation !== null;
    case "rebase":
    case "restore-revision":
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
    state.statusMessages.length > 0 ||
    state.focusMode === "command" ||
    state.focusMode === "inline-confirmation" ||
    state.focusMode === "bookmark" ||
    state.commandDraft !== null ||
    state.selectedRowIds.length > 0 ||
    state.focusMode === "files"
  );
}

function currentFocusedFileExists(state: AppState): boolean {
  const expandedRevision = getExpandedRevision(state);
  return expandedRevision !== null && expandedRevision.files[state.focusedFileIndex] !== undefined;
}
