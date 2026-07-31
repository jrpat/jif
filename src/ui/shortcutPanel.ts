import type { CommandDefinition } from "../commands/definitions.ts";
import type { AppState, FocusMode } from "../domain/types.ts";
import { isFileFocusMode, modeDefinitions, revisionLogNavCommandIds, type CanonicalKeyBinding, type KeymapScope, type Mode } from "../modes.ts";
import { commandCanExecute, getFocusedChildRevision, getFocusedFile, getFocusedParentRevision, getFocusedRevision } from "../state/store.ts";
import { hasMatch, score } from "fzy.js";

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
const FILE_FILTER_CHIP_LABEL = "file";
const DRY_RUN_CHIP_LABEL = "#";
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
const MODIFIER_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  a: ["alt", "option"],
  alt: ["alt", "option"],
  c: ["ctrl", "control"],
  ctrl: ["ctrl", "control"],
  cmd: ["cmd", "command", "meta"],
  m: ["cmd", "command", "meta"],
  meta: ["cmd", "command", "meta"],
  s: ["shift"],
  shift: ["shift"],
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
const BASE_KEY_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  " ": ["space"],
  space: ["space"],
  escape: ["escape", "esc"],
  enter: ["enter", "return", "ret"],
  left: ["left", "left arrow"],
  right: ["right", "right arrow"],
  down: ["down", "down arrow"],
  up: ["up", "up arrow"],
  "/": ["/", "slash"],
  "\\": ["\\", "backslash"],
  "`": ["`", "backtick"],
  "-": ["-", "minus", "hyphen"],
  "=": ["=", "equals"],
  "[": ["[", "left bracket"],
  "]": ["]", "right bracket"],
  ";": [";", "semicolon"],
  "'": ["'", "quote", "apostrophe"],
  ",": [",", "comma"],
  ".": [".", "period", "dot"],
  "?": ["?", "question mark"],
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
  { commandIds: ["show-diff"], label: "diff" },
  { commandIds: ["commit"], label: "commit" },
];

export type ShortcutEntry = Readonly<{
  id: string;
  commandId: string;
  hasModifier: boolean;
  keyLabel: string;
  relevance: number | null;
  title: string;
  sortKey: string;
}>;

export type ShortcutPanelBinding = Readonly<{
  key: string;
  command: Pick<CommandDefinition, "id" | "title" | "description">;
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

// Sections render top to bottom with a divider between each populated pair.
// Empty sections are skipped entirely rather than reserving a blank band.
export type ShortcutPanelLayout = Readonly<{ sections: readonly ShortcutGrid[] }>;

// A split panel keeps a mode's own bindings above the ones it inherits. That is
// only worth the extra section when the mode was entered from somewhere — the
// root revision log has nothing to contrast against.
export function shouldSplitShortcutPanelLayout(args: Readonly<{
  showsPersistentShortcutPanel: boolean;
  showsTransientShortcutPanel: boolean;
  hasCommandDraft: boolean;
  activeMode: Mode;
}>): boolean {
  return args.showsTransientShortcutPanel
    ? args.hasCommandDraft
    : args.showsPersistentShortcutPanel && args.activeMode !== "revision-log";
}

export function populatedShortcutSections(
  layout: ShortcutPanelLayout,
): readonly ShortcutGrid[] {
  return layout.sections.filter((grid) => grid.rows.length > 0);
}

export function shortcutLayoutRowCount(layout: ShortcutPanelLayout): number {
  const sections = populatedShortcutSections(layout);
  if (sections.length === 0) return 0;
  const rowCount = sections.reduce((total, grid) => total + grid.rows.length, 0);
  return rowCount + sections.length - 1;
}

export function normalizeShortcutSortKey(keyLabel: string): string {
  const shortcut = splitShortcutKey(keyLabel);
  return shortcut?.baseKey ?? keyLabel;
}

export function buildShortcutEntries(
  bindings: readonly ShortcutPanelBinding[],
  query = "",
): readonly ShortcutEntry[] {
  const terms = shortcutFilterTerms(query);
  const filtered = terms.length > 0;
  const entries: ShortcutEntry[] = [];

  for (const binding of bindings) {
    const relevance = filtered ? shortcutBindingRelevance(binding, terms) : null;
    if (filtered && relevance === null) {
      continue;
    }

    const { key: rawKeyLabel, command } = binding;
    entries.push({
      id: `${command.id}:${rawKeyLabel}`,
      commandId: command.id,
      hasModifier: hasShortcutModifier(rawKeyLabel),
      keyLabel: formatShortcutKeyLabel(rawKeyLabel),
      relevance,
      title: command.title,
      sortKey: normalizeShortcutSortKey(rawKeyLabel),
    });
  }

  return entries.sort(compareShortcutEntries);
}

export function shortcutBindingMatchesQuery(
  binding: ShortcutPanelBinding,
  query: string,
): boolean {
  return shortcutBindingRelevance(binding, shortcutFilterTerms(query)) !== null;
}

function shortcutFilterTerms(query: string): readonly string[] {
  const trimmedQuery = query.trim();
  return trimmedQuery === "" ? [] : trimmedQuery.split(/\s+/);
}

function shortcutBindingRelevance(
  binding: ShortcutPanelBinding,
  terms: readonly string[],
): number | null {
  if (terms.length === 0) {
    return 0;
  }
  const candidates = [
    binding.command.title,
    binding.command.description ?? "",
    binding.command.id,
    binding.key,
    formatShortcutKeyLabel(binding.key),
    ...buildKeySearchAliases(binding.key),
  ];
  const termScores: number[] = [];

  for (const term of terms) {
    let matched = false;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      const matchesWithinWord = (candidate.match(/\S+/g) ?? [])
        .some((word) => hasMatch(term, word));
      if (matchesWithinWord) {
        matched = true;
        bestScore = Math.max(bestScore, score(term, candidate));
      }
    }
    if (!matched) {
      return null;
    }
    termScores.push(bestScore);
  }

  // Addition is commutative in intent but not perfectly so in floating point.
  // Sorting first keeps relevance identical when users reorder the same terms.
  termScores.sort((a, b) => a - b);
  return termScores.reduce((total, termScore) => total + termScore, 0);
}

function buildKeySearchAliases(key: string): readonly string[] {
  const shortcut = splitShortcutKey(key);
  if (shortcut === null) {
    return baseKeySearchAliases(key);
  }

  const modifierCombinations = shortcut.modifiers.reduce<readonly string[][]>(
    (combinations, modifier) => {
      const aliases = MODIFIER_SEARCH_ALIASES[modifier] ?? [modifier];
      return combinations.flatMap((combination) =>
        aliases.map((alias) => [...combination, alias])
      );
    },
    [[]],
  );
  const baseAliases = baseKeySearchAliases(shortcut.baseKey);
  return modifierCombinations.flatMap((modifiers) =>
    baseAliases.map((base) => [...modifiers, base].join(" "))
  );
}

function baseKeySearchAliases(key: string): readonly string[] {
  return BASE_KEY_SEARCH_ALIASES[key] ?? [key];
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
  leadingSegments: readonly ShortcutSummarySegment[] = [],
): readonly ShortcutSummarySegment[] {
  const keyLabelsByCommand = groupShortcutLabelsByCommand(entries);
  const safeWidth = Math.max(1, availableWidth);
  const summarySegments: ShortcutSummarySegment[] = [...leadingSegments];
  let summaryWidth = measureSummaryWidth(summarySegments);

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

function measureSummaryWidth(segments: readonly ShortcutSummarySegment[]): number {
  let width = 0;
  segments.forEach((segment, index) => {
    const segmentWidth = segment.keyLabel.length + 1 + segment.label.length;
    width += index === 0 ? segmentWidth : SUMMARY_GAP.length + segmentWidth;
  });
  return width;
}

// The collapsed status chip renders as ` label ` and is absolutely positioned at
// the left edge, so it steals this many columns from the shortcut summary's draw
// area. The summary fit must subtract it to drop trailing hints instead of
// overflowing them.
export function stateChipSummaryWidth(label: string): number {
  return label.length + 2;
}

export function buildStateChipLabel(
  isFileFilterRevset: boolean,
  dryRun: boolean,
): string | null {
  const labels = [
    ...(isFileFilterRevset ? [FILE_FILTER_CHIP_LABEL] : []),
    ...(dryRun ? [DRY_RUN_CHIP_LABEL] : []),
  ];
  return labels.length > 0 ? labels.join(" · ") : null;
}

export function buildShortcutGrid(
  entries: readonly ShortcutEntry[],
  availableWidth: number,
): ShortcutGrid {
  return buildShortcutGridWithGeometry(
    entries,
    resolveShortcutGridGeometry([entries], availableWidth),
  );
}

// One grid per group, all sharing a single column geometry so the key column
// stays aligned across the dividers that separate the panel's sections.
export function buildAlignedShortcutGrids(
  entryGroups: readonly (readonly ShortcutEntry[])[],
  availableWidth: number,
): readonly ShortcutGrid[] {
  const geometry = resolveShortcutGridGeometry(entryGroups, availableWidth);
  return entryGroups.map((entries) => buildShortcutGridWithGeometry(entries, geometry));
}

type ShortcutGridGeometry = Readonly<{
  columnCount: number;
  columnWidth: number;
  keyWidth: number;
  gap: number;
}>;

function resolveShortcutGridGeometry(
  entryGroups: readonly (readonly ShortcutEntry[])[],
  availableWidth: number,
): ShortcutGridGeometry {
  const safeWidth = Math.max(1, availableWidth);
  const maxColumns = Math.max(1, Math.floor((safeWidth + GRID_GAP) / (MIN_COLUMN_WIDTH + GRID_GAP)));
  const entryCount = entryGroups.reduce(
    (maximum, entries) => Math.max(maximum, entries.length),
    0,
  );
  const columnCount = Math.min(Math.max(entryCount, 1), maxColumns);
  const columnWidth = Math.max(
    1,
    Math.floor((safeWidth - GRID_GAP * (columnCount - 1)) / columnCount),
  );
  const keyWidth = Math.min(
    MAX_KEY_WIDTH,
    entryGroups.reduce(
      (maximum, entries) =>
        entries.reduce(
          (groupMaximum, entry) => Math.max(groupMaximum, entry.keyLabel.length),
          maximum,
        ),
      0,
    ),
  );

  return {
    columnCount,
    columnWidth,
    keyWidth,
    gap: GRID_GAP,
  };
}

function buildShortcutGridWithGeometry(
  entries: readonly ShortcutEntry[],
  geometry: ShortcutGridGeometry,
): ShortcutGrid {
  const { columnCount, columnWidth, keyWidth, gap } = geometry;
  // An entryless group yields no rows at all, so callers can tell an empty
  // section from one holding a single row.
  const rowCount = Math.ceil(entries.length / columnCount);
  const rows: ShortcutEntry[][] = Array.from({ length: rowCount }, () => []);
  if (entries.some((entry) => entry.relevance !== null)) {
    entries.forEach((entry, index) => {
      rows[Math.floor(index / columnCount)]!.push(entry);
    });
  } else {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const entry = entries[columnIndex * rowCount + rowIndex];
        if (entry) {
          rows[rowIndex]!.push(entry);
        }
      }
    }
  }

  return {
    rows,
    columnCount,
    columnWidth,
    keyWidth,
    gap,
  };
}

export type ShortcutPanelBindingInput = Readonly<{
  key: string;
  scope: KeymapScope;
  command: CommandDefinition;
}>;

// Pairs canonical bindings with their command definitions, dropping keys bound to
// a command that the active configuration does not define.
export function resolveShortcutPanelBindings(
  bindings: readonly CanonicalKeyBinding[],
  commandsById: ReadonlyMap<string, CommandDefinition>,
): readonly ShortcutPanelBindingInput[] {
  const resolved: ShortcutPanelBindingInput[] = [];
  for (const { key, commandId, scope } of bindings) {
    const command = commandsById.get(commandId);
    if (command) resolved.push({ key, scope, command });
  }
  return resolved;
}

// The expanded panel's sections, in render order. Bindings the user configured
// themselves always lead, so custom keys are the first thing the panel answers
// with instead of being scattered through the built-in defaults. Below them the
// built-ins either stay whole or split into the mode's own bindings and the ones
// it inherits.
export function buildShortcutPanelSectionEntries(args: Readonly<{
  directBindings: readonly ShortcutPanelBindingInput[];
  inheritedBindings: readonly ShortcutPanelBindingInput[];
  isUserDefined: (binding: ShortcutPanelBindingInput) => boolean;
  splitInheritedBindings: boolean;
  query: string;
}>): readonly (readonly ShortcutEntry[])[] {
  const { directBindings, inheritedBindings, isUserDefined, query } = args;
  const userBindings = [...directBindings, ...inheritedBindings].filter(isUserDefined);
  const directBuiltIns = directBindings.filter((binding) => !isUserDefined(binding));
  const inheritedBuiltIns = inheritedBindings.filter((binding) => !isUserDefined(binding));
  const builtInGroups = args.splitInheritedBindings
    ? [directBuiltIns, inheritedBuiltIns]
    : [[...directBuiltIns, ...inheritedBuiltIns]];

  return [userBindings, ...builtInGroups].map((bindings) =>
    buildShortcutEntries(bindings, query)
  );
}

export function getShortcutPanelBindings(
  state: AppState,
  bindings: readonly ShortcutPanelBindingInput[],
): readonly ShortcutPanelBindingInput[] {
  const actionable = bindings.filter(({ command }) => commandHasImmediateEffect(state, command));
  const focusMode = shortcutPanelFocusMode(state);

  if (state.focusMode === "preview") {
    return actionable;
  }

  if (state.commandDraft !== null) {
    return actionable.filter(({ command }) =>
      NAVIGATION_COMMAND_IDS.has(command.id) ||
      COMMAND_ENTRY_COMMAND_IDS.has(command.id) ||
      command.group === "mode" ||
      command.group === "cancel" ||
      command.id === "shortcut-panel" ||
      command.id === "filter-shortcuts" ||
      command.id === "force-last-command"
    );
  }

  if (focusMode === "inline-confirmation") {
    return actionable.filter(({ command }) =>
      command.group === "mode" ||
      command.group === "cancel" ||
      command.id === "shortcut-panel" ||
      command.id === "force-last-command"
    );
  }

  if (focusMode === "files") {
    return actionable.filter(({ command }) =>
      NAVIGATION_COMMAND_IDS.has(command.id) ||
      COMMAND_ENTRY_COMMAND_IDS.has(command.id) ||
      command.group === "mode" ||
      command.group === "cancel" ||
      command.id === "shortcut-panel" ||
      command.id === "force-last-command" ||
      command.id === "undo" ||
      command.id === "redo"
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
  return modeDefinitions[mode].label;
}

export function formatShortcutKeyLabel(keyLabel: string): string {
  const shortcut = splitShortcutKey(keyLabel);
  if (shortcut === null) {
    return formatBaseKeyLabel(keyLabel);
  }

  return `${shortcut.modifiers.map((modifier) => MODIFIER_LABELS[modifier]!).join("")}${formatBaseKeyLabel(shortcut.baseKey)}`;
}

function compareShortcutEntries(a: ShortcutEntry, b: ShortcutEntry): number {
  if (a.relevance !== null && b.relevance !== null) {
    if (a.relevance > b.relevance) return -1;
    if (a.relevance < b.relevance) return 1;
  }

  // Group by base key letter case-insensitively so that `s`, `S`, and `^s` cluster together.
  const keyComparison = a.sortKey.toLowerCase().localeCompare(b.sortKey.toLowerCase());
  if (keyComparison !== 0) {
    return keyComparison;
  }

  // Within a letter group, unmodified keys come before modified ones (`s`/`S` before `^s`).
  const modifierComparison = modifierWeight(a) - modifierWeight(b);
  if (modifierComparison !== 0) {
    return modifierComparison;
  }

  // Among same-modifier variants, lowercase precedes uppercase (`s` before `S`).
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

// Focus movement that stays visible in narrowed panels. The shared revision
// navigation scope supplies the revision-relationship jumps; the extras here are
// the linear movement from `log` and the detail expansion from `revision-log`.
const NAVIGATION_COMMAND_IDS = new Set([
  "move-down",
  "move-up",
  ...revisionLogNavCommandIds,
  "expand",
  "collapse",
]);

const COMMAND_ENTRY_COMMAND_IDS = new Set([
  "command-bar",
  "shell-command-bar",
]);

function commandHasImmediateEffect(
  state: AppState,
  command: Pick<CommandDefinition, "id">,
): boolean {
  const focusMode = shortcutPanelFocusMode(state);
  switch (command.id) {
    case "confirm":
      return commandCanExecute(state);
    case "cancel":
      return hasCancelableState(state);
    case "expand":
      return focusMode === "revisions" && getFocusedRevision(state) !== null;
    case "collapse":
      return state.expandedRowId !== null;
    case "move-parent":
      return getFocusedParentRevision(state) !== null;
    case "move-child":
      return getFocusedChildRevision(state) !== null;
    // Bookmark and workspace navigation is always listed so users can see both
    // directions are available; pressing a direction with no target no-ops.
    case "toggle-revision-selection":
      return focusMode === "revisions" && getFocusedRevision(state) !== null;
    case "toggle-file-selection":
      return focusMode === "files" && currentFocusedFileExists(state);
    case "restore":
      return focusMode === "files" && currentFocusedFileExists(state);
    case "split":
    case "split-parallel":
      return (focusMode === "revisions" || focusMode === "files") && getFocusedRevision(state) !== null;
    case "inline-confirmation-prev-option":
    case "inline-confirmation-next-option":
      return focusMode === "inline-confirmation" && state.inlineConfirmation !== null;
    case "rebase":
    case "duplicate":
    case "revert":
    case "diff-edit-revision":
    case "restore-revision":
    case "squash":
    case "interdiff":
    case "diff":
      return focusMode === "revisions" && getFocusedRevision(state) !== null;
    case "jump-to-working-copy":
      return state.revisions.some((revision) => revision.marker === "working-copy");
    default:
      return true;
  }
}

function shortcutPanelFocusMode(state: AppState): FocusMode {
  if (state.focusMode !== "shortcut-filter") {
    return state.focusMode;
  }

  return state.focusModeStack.findLast((mode) => mode !== "shortcut-filter") ?? "revisions";
}

function hasCancelableState(state: AppState): boolean {
  return (
    state.statusMessages.length > 0 ||
    state.focusMode === "command" ||
    state.focusMode === "inline-confirmation" ||
    state.focusMode === "bookmark" ||
    state.focusMode === "preview" ||
    state.commandDraft !== null ||
    state.selectedRowIds.length > 0 ||
    isFileFocusMode(state.focusMode)
  );
}

function currentFocusedFileExists(state: AppState): boolean {
  return getFocusedFile(state) !== null;
}
