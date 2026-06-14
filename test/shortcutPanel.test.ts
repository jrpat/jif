import { expect, test } from "bun:test";
import { resolveConfiguredKeymap } from "../src/config/index.ts";
import { commandDefinitions, type CommandDefinition } from "../src/commands/definitions.ts";
import type { AppState } from "../src/domain/types.ts";
import { createInitialState, draftConfigs, openFocusedRevision, startCommandDraft } from "../src/state/store.ts";
import {
  collectCanonicalBindingsForMode,
  collectDirectCanonicalBindingsForMode,
  collectInheritedAndGlobalCanonicalBindings,
  defaultKeymap,
  getActiveMode,
} from "../src/modes.ts";
import {
  buildShortcutEntries,
  buildShortcutGrid,
  buildShortcutSummary,
  buildShortcutSummarySegments,
  computeShortcutPanelHeight,
  formatShortcutKeyLabel,
  getShortcutPanelBindings,
  normalizeShortcutSortKey,
  shortcutModeLabel,
  type ShortcutPanelBinding,
  type ShortcutPanelBindingInput,
} from "../src/ui/shortcutPanel.ts";

function makeBinding(commandId: string, title: string, key: string): ShortcutPanelBinding {
  return { key, command: { id: commandId, title } };
}

function bindingsForMode(
  state: AppState,
  keymap = defaultKeymap,
  commands: readonly CommandDefinition[] = commandDefinitions,
): readonly ShortcutPanelBindingInput[] {
  const byId = new Map(commands.map((command) => [command.id, command] as const));
  const resolved: ShortcutPanelBindingInput[] = [];
  for (const { key, commandId } of collectCanonicalBindingsForMode(getActiveMode(state), keymap)) {
    const command = byId.get(commandId);
    if (command) resolved.push({ key, command });
  }
  return resolved;
}

function createState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      {
        rowId: "aaaaaaaa",
        revisionId: "aaaaaaaa",
        parentRevisionIds: ["bbbbbbbb"],
        changeIdPrefixLength: 1,
        commitId: "11111111",
        description: "first",
        localTimestamp: "2026-03-30 07:22:39",
        bookmarks: [],
        workspaces: [],
        graphRows: ["@  "],
        isEmpty: false,
        hasConflict: false,
        marker: "working-copy",
        filesLoaded: true,
        files: [{ status: "M", path: "src/a.ts" }],
      },
      {
        rowId: "bbbbbbbb",
        revisionId: "bbbbbbbb",
        parentRevisionIds: [],
        changeIdPrefixLength: 1,
        commitId: "22222222",
        description: "second",
        localTimestamp: "2026-03-30 07:22:40",
        bookmarks: [],
        workspaces: [],
        graphRows: ["o  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [{ status: "M", path: "src/b.ts" }],
      },
    ],
  };
}

test("normalizeShortcutSortKey strips leading modifiers for sorting", () => {
  expect(normalizeShortcutSortKey("c-f")).toBe("f");
  expect(normalizeShortcutSortKey("ctrl-space")).toBe("space");
  expect(normalizeShortcutSortKey("f")).toBe("f");
});

test("buildShortcutEntries sorts plain keys before modified keys with the same base key", () => {
  const entries = buildShortcutEntries([
    makeBinding("focus-filter", "Filter", "c-f"),
    makeBinding("find", "Find", "f"),
    makeBinding("quit", "Quit", "q"),
  ]);

  expect(entries.map((entry) => entry.keyLabel)).toEqual(["f", "⌃f", "q"]);
});

test("buildShortcutEntries orders modified keys after the capitalized base key", () => {
  const entries = buildShortcutEntries([
    makeBinding("split", "Split", "ctrl-s"),
    makeBinding("squash-onto", "Squash Onto", "S"),
    makeBinding("squash", "Squash", "s"),
  ]);

  expect(entries.map((entry) => entry.keyLabel)).toEqual(["s", "S", "⌃s"]);
});

test("buildShortcutEntries emits one entry per binding", () => {
  const entries = buildShortcutEntries([
    makeBinding("move-down", "Move Down", "j"),
    makeBinding("move-down", "Move Down", "down"),
  ]);

  expect(entries.map((entry) => entry.id)).toEqual([
    "move-down:down",
    "move-down:j",
  ]);
});

test("buildShortcutSummary creates a collapsed single-line help string", () => {
  const entries = buildShortcutEntries([
    makeBinding("command-bar", "Command Bar", ":"),
    makeBinding("shortcut-panel", "Shortcuts", "?"),
    makeBinding("move-down", "Move Down", "j"),
    makeBinding("move-up", "Move Up", "k"),
    makeBinding("move-parent", "Move to Parent", "J"),
    makeBinding("move-parent", "Move to Parent", "K"),
    makeBinding("edit-revision", "Edit Revision", "e"),
    makeBinding("new-revision", "New Revision", "n"),
    makeBinding("show-revision-diff", "Diff", "d"),
    makeBinding("commit", "Commit", "c"),
  ]);
  const baseSummary = ": command   ? help   j/k move";
  const summaryWithEdit = `${baseSummary}   e edit`;
  const fullSummary = `${summaryWithEdit}   n new   d diff   c commit`;

  expect(buildShortcutSummary(entries, baseSummary.length)).toBe(baseSummary);
  expect(buildShortcutSummary(entries, summaryWithEdit.length)).toBe(summaryWithEdit);
  expect(buildShortcutSummary(entries, fullSummary.length)).toBe(fullSummary);
});

test("buildShortcutSummary skips missing higher-priority actions and keeps fitting later ones", () => {
  const entries = buildShortcutEntries([
    makeBinding("command-bar", "Command Bar", ":"),
    makeBinding("shortcut-panel", "Shortcuts", "?"),
    makeBinding("move-down", "Move Down", "j"),
    makeBinding("move-up", "Move Up", "k"),
    makeBinding("edit-revision", "Edit Revision", "e"),
    makeBinding("new-revision", "New Revision", "n"),
    makeBinding("show-revision-diff", "Diff", "d"),
  ]);
  const expected = ": command   ? help   j/k move   e edit   n new   d diff";

  expect(buildShortcutSummary(entries, expected.length)).toBe(expected);
});

test("buildShortcutSummary ignores move-parent in the collapsed status bar", () => {
  const entries = buildShortcutEntries([
    makeBinding("command-bar", "Command Bar", ":"),
    makeBinding("shortcut-panel", "Shortcuts", "?"),
    makeBinding("move-down", "Move Down", "j"),
    makeBinding("move-up", "Move Up", "k"),
    makeBinding("move-parent", "Move to Parent", "J"),
    makeBinding("move-parent", "Move to Parent", "K"),
    makeBinding("edit-revision", "Edit Revision", "e"),
  ]);
  const expected = ": command   ? help   j/k move   e edit";

  expect(buildShortcutSummary(entries, expected.length)).toBe(expected);
});

test("buildShortcutSummarySegments keeps key labels separate for bold rendering", () => {
  const entries = buildShortcutEntries([
    makeBinding("command-bar", "Command Bar", ":"),
    makeBinding("shortcut-panel", "Shortcuts", "?"),
    makeBinding("move-down", "Move Down", "j"),
    makeBinding("move-up", "Move Up", "k"),
    makeBinding("move-parent", "Move to Parent", "J"),
    makeBinding("move-parent", "Move to Parent", "K"),
    makeBinding("edit-revision", "Edit Revision", "e"),
  ]);

  expect(buildShortcutSummarySegments(entries, 38)).toEqual([
    { keyLabel: ":", label: "command" },
    { keyLabel: "?", label: "help" },
    { keyLabel: "j/k", label: "move" },
    { keyLabel: "e", label: "edit" },
  ]);
});

test("formatShortcutKeyLabel uses symbolic labels for space and modifiers", () => {
  expect(formatShortcutKeyLabel("space")).toBe("⎵");
  expect(formatShortcutKeyLabel(" ")).toBe("⎵");
  expect(formatShortcutKeyLabel("ctrl-r")).toBe("⌃r");
  expect(formatShortcutKeyLabel("ctrl-alt-space")).toBe("⌃⌥⎵");
  expect(formatShortcutKeyLabel("enter")).toBe("ret");
  expect(formatShortcutKeyLabel("left")).toBe("←");
  expect(formatShortcutKeyLabel("right")).toBe("→");
  expect(formatShortcutKeyLabel("down")).toBe("↓");
  expect(formatShortcutKeyLabel("up")).toBe("↑");
  expect(formatShortcutKeyLabel("escape")).toBe("esc");
  expect(formatShortcutKeyLabel("j")).toBe("j");
});

test("buildShortcutGrid packs entries top to bottom before moving right", () => {
  const entries = buildShortcutEntries([
    makeBinding("a", "Alpha", "a"),
    makeBinding("b", "Bravo", "b"),
    makeBinding("c", "Charlie", "c"),
    makeBinding("d", "Delta", "d"),
    makeBinding("e", "Echo", "e"),
  ]);

  const grid = buildShortcutGrid(entries, 50);

  expect(grid.columnCount).toBe(2);
  expect(grid.rows.map((row) => row.map((entry) => entry.keyLabel))).toEqual([
    ["a", "d"],
    ["b", "e"],
    ["c"],
  ]);
});

test("buildShortcutGrid falls back to one column in narrow terminals", () => {
  const entries = buildShortcutEntries([
    makeBinding("a", "Alpha", "a"),
    makeBinding("b", "Bravo", "b"),
  ]);

  const grid = buildShortcutGrid(entries, 20);

  expect(grid.columnCount).toBe(1);
  expect(grid.rows.map((row) => row.map((entry) => entry.keyLabel))).toEqual([
    ["a"],
    ["b"],
  ]);
});

test("computeShortcutPanelHeight follows the adaptive terminal-height rule", () => {
  expect(computeShortcutPanelHeight(50)).toBe(20);
  expect(computeShortcutPanelHeight(30)).toBe(15);
  expect(computeShortcutPanelHeight(6)).toBe(3);
  expect(computeShortcutPanelHeight(5)).toBe(5);
});

test("shortcutModeLabel formats the current mode for the panel header", () => {
  expect(shortcutModeLabel("normal")).toBe("Revisions");
  expect(shortcutModeLabel("files")).toBe("Files");
  expect(shortcutModeLabel("command")).toBe("Command");
  expect(shortcutModeLabel("rebase")).toBe("Rebase");
  expect(shortcutModeLabel("squash")).toBe("Squash");
});

test("getShortcutPanelBindings includes immediate revision actions in revision mode", () => {
  const state = createState();
  const bindings = getShortcutPanelBindings(state, bindingsForMode(state));
  const ids = bindings.map(({ command }) => command.id);

  expect(ids).toContain("absorb");
  expect(ids).toContain("force-last-command");
  expect(ids).toContain("move-parent");
  expect(ids).toContain("new-revision");
  expect(ids).toContain("edit-revision");
});

test("getShortcutPanelBindings always lists bookmark and workspace navigation regardless of target", () => {
  // The default state has no bookmarks or workspaces on any revision, so there is
  // no target in either direction. These four navigation commands should still be
  // listed; pressing a direction with no target simply no-ops.
  const state = createState();
  const bindings = getShortcutPanelBindings(state, bindingsForMode(state));
  const ids = bindings.map(({ command }) => command.id);

  expect(ids).toContain("move-to-next-bookmark");
  expect(ids).toContain("move-to-prev-bookmark");
  expect(ids).toContain("move-to-next-workspace");
  expect(ids).toContain("move-to-prev-workspace");
});

test("getShortcutPanelBindings narrows rebase draft shortcuts to draft-relevant actions", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] });

  const bindings = getShortcutPanelBindings(state, bindingsForMode(state));
  const ids = bindings.map(({ command }) => command.id);

  expect(ids).toContain("move-down");
  expect(ids).toContain("move-up");
  expect(ids).toContain("confirm");
  expect(ids).toContain("cancel");
  expect(ids).toContain("force-last-command");
  expect(ids).toContain("rebase-descendants");
  expect(ids).toContain("shortcut-panel");
  // split is a mode-group action reachable via the inherited `ctrl-s`, like in the
  // other normal-derived draft modes (restore/diff/absorb)
  expect(ids).toContain("split");
  expect(ids).not.toContain("quit");
  expect(ids).not.toContain("undo");
  expect(ids).not.toContain("cycle-layout");
  expect(ids).not.toContain("edit-revset");
});

test("getShortcutPanelBindings narrows file mode shortcuts to file-relevant actions", () => {
  let state = createState();
  state = openFocusedRevision(state);

  const bindings = getShortcutPanelBindings(state, bindingsForMode(state));
  const ids = bindings.map(({ command }) => command.id);

  expect(ids).toContain("split");
  expect(ids).toContain("restore");
  expect(ids).toContain("toggle-file-selection");
  expect(ids).toContain("select-all-files");
  expect(ids).toContain("collapse");
  expect(ids).toContain("shortcut-panel");
  // files mode does not inherit Normal, so revision and global power commands are absent
  expect(ids).not.toContain("force-last-command");
  expect(ids).not.toContain("rebase");
  expect(ids).not.toContain("squash");
  expect(ids).not.toContain("new-revision");
  expect(ids).not.toContain("edit-revision");
  expect(ids).not.toContain("undo");
  expect(ids).not.toContain("edit-revset");
});

test("getShortcutPanelBindings includes inline configured commands from the merged keymap", () => {
  const state = createState();
  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Custom Action",
        description: "Run a custom action",
        run: () => {},
      },
    },
  });

  const bindings = getShortcutPanelBindings(state, bindingsForMode(state, resolved.keymap, resolved.commands));
  expect(bindings.find(({ command }) => command.id === "user:normal:g")?.command.title).toBe("Custom Action");
});

test("collectDirectCanonicalBindingsForMode is mode-specific and excludes parents and globals", () => {
  const keys = collectDirectCanonicalBindingsForMode("files", defaultKeymap).map((b) => b.key);
  // files mode is self-contained: it binds its own navigation and file actions directly
  expect(keys).toContain("ctrl-s");
  expect(keys).toContain("r");
  expect(keys).toContain("d");
  expect(keys).toContain(" ");
  expect(keys).toContain("a");
  expect(keys).toContain("j");
  expect(keys).toContain("k");
  expect(keys).toContain("h");
  // files mode does not inherit Normal, so revision-only keys are absent entirely
  expect(keys).not.toContain("G");
  expect(keys).not.toContain("S");
  // globals — must NOT appear here
  expect(keys).not.toContain("q");
  expect(keys).not.toContain("ctrl-z");
});

test("collectInheritedAndGlobalCanonicalBindings returns globals only when a mode has no parent", () => {
  const keys = collectInheritedAndGlobalCanonicalBindings("files", defaultKeymap).map((b) => b.key);
  // files mode no longer inherits Normal, so only globals remain in the bottom set
  expect(keys).toContain("q");
  expect(keys).toContain("ctrl-z");
  expect(keys).toContain("escape");
  // Normal-only keys must NOT leak in via inheritance
  expect(keys).not.toContain("G");
  expect(keys).not.toContain("S");
  // direct files-mode bindings — must NOT appear in the bottom set
  expect(keys).not.toContain("ctrl-s");
  expect(keys).not.toContain("r");
  expect(keys).not.toContain("d");
  expect(keys).not.toContain(" ");
  expect(keys).not.toContain("a");
});

test("collectCanonicalBindingsForMode excludes alias bindings (canonical: false)", () => {
  const resolved = resolveConfiguredKeymap({
    normal: {
      x: { command: "move-down", canonical: false },
    },
  });

  const keys = collectCanonicalBindingsForMode("normal", resolved.keymap).map((b) => b.key);

  expect(keys).toContain("j");
  expect(keys).not.toContain("x");
  expect(keys).not.toContain("down");
});
