import { expect, test } from "bun:test";
import { resolveConfiguredKeymap } from "../src/config/index.ts";
import { commandDefinitions, type CommandDefinition } from "../src/commands/definitions.ts";
import type { AppState } from "../src/domain/types.ts";
import { createInitialState, draftConfigs, openFocusedRevision, startCommandDraft } from "../src/state/store.ts";
import {
  collectCanonicalBindingsForMode,
  collectDirectCanonicalBindingsForMode,
  collectInheritedAndGlobalCanonicalBindings,
  bindingCommand,
  defaultKeymap,
  getActiveMode,
  type CanonicalKeyBinding,
  type Mode,
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
  resolveShortcutPanelBindings,
  shouldSplitShortcutPanelLayout,
  shortcutModeLabel,
  stateChipSummaryWidth,
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
  return resolveBindings(
    collectCanonicalBindingsForMode(getActiveMode(state), keymap),
    commands,
  );
}

function resolveBindings(
  bindings: readonly CanonicalKeyBinding[],
  commands: readonly CommandDefinition[] = commandDefinitions,
): readonly ShortcutPanelBindingInput[] {
  return resolveShortcutPanelBindings(
    bindings,
    new Map(commands.map((command) => [command.id, command] as const)),
  );
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

test("buildShortcutSummarySegments places leading segments first and budgets for them", () => {
  const entries = buildShortcutEntries([
    makeBinding("command-bar", "Command Bar", ":"),
    makeBinding("shortcut-panel", "Shortcuts", "?"),
    makeBinding("move-down", "Move Down", "j"),
    makeBinding("move-up", "Move Up", "k"),
  ]);
  const segments = buildShortcutSummarySegments(entries, 80, [{ keyLabel: "esc", label: "log" }]);

  expect(segments).toEqual([
    { keyLabel: "esc", label: "log" },
    { keyLabel: ":", label: "command" },
    { keyLabel: "?", label: "help" },
    { keyLabel: "j/k", label: "move" },
  ]);
});

test("buildShortcutSummarySegments drops trailing hints when the leading hint eats the width budget", () => {
  const entries = buildShortcutEntries([
    makeBinding("command-bar", "Command Bar", ":"),
    makeBinding("shortcut-panel", "Shortcuts", "?"),
    makeBinding("move-down", "Move Down", "j"),
    makeBinding("move-up", "Move Up", "k"),
  ]);
  // `esc log` (7) + gap (3) + `: command` (9) = 19 fits; adding `? help` would
  // need 9 more, so it drops rather than overflowing the chip-narrowed row.
  const leading = [{ keyLabel: "esc", label: "log" }];

  expect(buildShortcutSummarySegments(entries, 19, leading)).toEqual([
    { keyLabel: "esc", label: "log" },
    { keyLabel: ":", label: "command" },
  ]);
});

test("stateChipSummaryWidth reserves the rendered ` label ` columns", () => {
  expect(stateChipSummaryWidth("file")).toBe(6);
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
  expect(shortcutModeLabel("revision-log")).toBe("Revisions");
  expect(shortcutModeLabel("revision-log-nav")).toBe("Revision Log Navigation");
  expect(shortcutModeLabel("revision-draft")).toBe("Revision Draft");
  expect(shortcutModeLabel("revision-files")).toBe("Files");
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
  expect(ids).toContain("command-bar");
  expect(ids).toContain("shell-command-bar");
  expect(ids).not.toContain("split");
  expect(ids).not.toContain("split-parallel");
  expect(ids).not.toContain("quit");
  expect(ids).not.toContain("undo");
  expect(ids).not.toContain("cycle-layout");
  expect(ids).not.toContain("edit-revset");
});

test("getShortcutPanelBindings includes Revision Log Navigation in command drafts", () => {
  const base = createState();
  const ancestor = {
    ...base.revisions[1]!,
    rowId: "cccccccc",
    revisionId: "cccccccc",
    commitId: "33333333",
    description: "third",
  };
  const state = startCommandDraft({
    ...base,
    revisions: [
      base.revisions[0]!,
      { ...base.revisions[1]!, parentRevisionIds: [ancestor.revisionId] },
      ancestor,
    ],
  }, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb", "cccccccc"] });

  const bindings = getShortcutPanelBindings(state, bindingsForMode(state));
  const commandsByKey = new Map(bindings.map(({ key, command }) => [key, command.id]));

  for (const [key, binding] of Object.entries(defaultKeymap["revision-log-nav"])) {
    expect(commandsByKey.get(key)).toBe(bindingCommand(binding!));
  }
});

test("transient command-draft panels keep direct and inherited bindings in separate sections", () => {
  const state = startCommandDraft(
    createState(),
    draftConfigs.rebase,
    { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] },
  );
  const mode = getActiveMode(state);
  const direct = getShortcutPanelBindings(
    state,
    resolveBindings(collectDirectCanonicalBindingsForMode(mode, defaultKeymap)),
  );
  const inherited = getShortcutPanelBindings(
    state,
    resolveBindings(collectInheritedAndGlobalCanonicalBindings(mode, defaultKeymap)),
  );

  const directCommandsByKey = new Map(direct.map(({ key, command }) => [key, command.id]));
  const inheritedCommandsByKey = new Map(inherited.map(({ key, command }) => [key, command.id]));

  expect(directCommandsByKey.get("s")).toBe("rebase-descendants");
  expect(directCommandsByKey.has("]")).toBe(false);
  expect(inheritedCommandsByKey.get("]")).toBe("move-to-next-bookmark");
  expect(inheritedCommandsByKey.get("@")).toBe("jump-to-working-copy");
  expect(inheritedCommandsByKey.get(":")).toBe("command-bar");
});

test("shouldSplitShortcutPanelLayout splits everything but the root revision log", () => {
  const cases = [
    // Transient panels split only while a revision draft is being composed.
    { persistent: false, transient: true, draft: true, mode: "rebase", expected: true },
    { persistent: false, transient: true, draft: false, mode: "extra", expected: false },
    // Persistent panels split for any mode entered from the revision log.
    { persistent: true, transient: false, draft: false, mode: "rebase", expected: true },
    { persistent: true, transient: false, draft: false, mode: "revision-log", expected: false },
    { persistent: false, transient: false, draft: false, mode: "rebase", expected: false },
  ] as const satisfies readonly Readonly<{
    persistent: boolean;
    transient: boolean;
    draft: boolean;
    mode: Mode;
    expected: boolean;
  }>[];

  for (const { persistent, transient, draft, mode, expected } of cases) {
    expect(shouldSplitShortcutPanelLayout({
      showsPersistentShortcutPanel: persistent,
      showsTransientShortcutPanel: transient,
      hasCommandDraft: draft,
      activeMode: mode,
    })).toBe(expected);
  }
});

test("getShortcutPanelBindings narrows file mode shortcuts to file-relevant actions", () => {
  let state = createState();
  state = openFocusedRevision(state);

  const bindings = getShortcutPanelBindings(state, bindingsForMode(state));
  const ids = bindings.map(({ command }) => command.id);

  expect(ids).not.toContain("split");
  expect(ids).not.toContain("split-parallel");
  expect(ids).toContain("restore");
  expect(ids).toContain("toggle-file-selection");
  expect(ids).toContain("select-all-files");
  expect(ids).toContain("toggle-preview-full-file");
  expect(ids).toContain("collapse");
  expect(ids).toContain("shortcut-panel");
  expect(ids).toContain("command-bar");
  expect(ids).toContain("shell-command-bar");
  expect(ids).toContain("undo");
  expect(ids).toContain("redo");
  expect(bindings.find(({ command }) => command.id === "toggle-preview-full-file")?.key).toBe("ctrl-enter");
  expect(bindings.find(({ command }) => command.id === "command-bar")?.key).toBe(":");
  expect(bindings.find(({ command }) => command.id === "shell-command-bar")?.key).toBe(">");
  // files mode does not inherit Normal, so revision and global power commands are absent
  expect(ids).not.toContain("force-last-command");
  expect(ids).not.toContain("rebase");
  expect(ids).not.toContain("squash");
  expect(ids).not.toContain("new-revision");
  expect(ids).not.toContain("edit-revision");
  expect(ids).not.toContain("edit-revset");
});

test("getShortcutPanelBindings includes inline configured commands from the merged keymap", () => {
  const state = createState();
  const resolved = resolveConfiguredKeymap({
    "revision-log": {
      g: {
        title: "Custom Action",
        run: () => {},
      },
    },
  });

  const bindings = getShortcutPanelBindings(state, bindingsForMode(state, resolved.keymap, resolved.commands));
  expect(bindings.find(({ command }) => command.id === "user:revision-log:g")?.command.title).toBe("Custom Action");
});

test("collectDirectCanonicalBindingsForMode is mode-specific and excludes parents and globals", () => {
  const keys = collectDirectCanonicalBindingsForMode("revision-files", defaultKeymap).map((b) => b.key);
  // files mode is self-contained: it binds its own navigation and file actions directly
  expect(keys).not.toContain("ctrl-s");
  expect(keys).not.toContain("alt-s");
  expect(keys).toContain("r");
  expect(keys).toContain("d");
  expect(keys).toContain(" ");
  expect(keys).toContain("a");
  expect(keys).toContain("j");
  expect(keys).toContain("k");
  expect(keys).toContain("h");
  expect(keys).toContain(":");
  expect(keys).toContain(">");
  expect(keys).toContain("u");
  expect(keys).toContain("alt-u");
  // files mode does not inherit Normal, so revision-only keys are absent entirely
  expect(keys).not.toContain("G");
  expect(keys).not.toContain("S");
  // globals — must NOT appear here
  expect(keys).not.toContain("q");
  expect(keys).not.toContain("ctrl-z");
});

test("collectInheritedAndGlobalCanonicalBindings returns globals only when a mode has no parent", () => {
  const keys = collectInheritedAndGlobalCanonicalBindings("revision-files", defaultKeymap).map((b) => b.key);
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

test("op-log direct bindings are operation-specific and defer shared log keys to the parent", () => {
  const keys = collectDirectCanonicalBindingsForMode("op-log", defaultKeymap).map((b) => b.key);
  // Operation-specific actions stay directly on op-log
  expect(keys).toContain("@");
  expect(keys).toContain("r");
  expect(keys).toContain("R");
  expect(keys).toContain("d");
  // Shared list/preview/chrome keys now live on the `log` parent, not op-log itself
  expect(keys).not.toContain(":");
  expect(keys).not.toContain("?");
  expect(keys).not.toContain("/");
  expect(keys).not.toContain("f");
  expect(keys).not.toContain("G");
  expect(keys).not.toContain("j");
  expect(keys).not.toContain("k");
  expect(keys).not.toContain("p");
  expect(keys).not.toContain("ctrl-[");
});

test("op-log inherits the shared log keys and globals below the divider", () => {
  const keys = collectInheritedAndGlobalCanonicalBindings("op-log", defaultKeymap).map((b) => b.key);
  // Shared log chrome, inherited from the `log` parent
  expect(keys).toContain(":");
  expect(keys).toContain(">");
  expect(keys).toContain("?");
  expect(keys).toContain("/");
  expect(keys).toContain("f");
  expect(keys).toContain("G");
  expect(keys).toContain("j");
  expect(keys).toContain("k");
  expect(keys).toContain("p");
  expect(keys).toContain("ctrl-[");
  expect(keys).toContain("!");
  expect(keys).toContain("-");
  // Globals
  expect(keys).toContain("q");
  expect(keys).toContain("ctrl-z");
  // Operation-specific keys stay in the direct set, not here
  expect(keys).not.toContain("@");
  expect(keys).not.toContain("R");
});

test("evolog has no direct bindings and inherits everything from the log parent", () => {
  const direct = collectDirectCanonicalBindingsForMode("evolog", defaultKeymap).map((b) => b.key);
  expect(direct).toEqual([]);

  const inherited = collectInheritedAndGlobalCanonicalBindings("evolog", defaultKeymap).map((b) => b.key);
  expect(inherited).toContain(":");
  expect(inherited).toContain(">");
  expect(inherited).toContain("?");
  expect(inherited).toContain("/");
  expect(inherited).toContain("f");
  expect(inherited).toContain("G");
  expect(inherited).toContain("j");
  expect(inherited).toContain("p");
  expect(inherited).toContain("!");
  expect(inherited).toContain("-");
  expect(inherited).toContain("q");
  expect(inherited).not.toContain("@");
});

test("revision drafts surface shared revision navigation", () => {
  const keys = collectCanonicalBindingsForMode("rebase", defaultKeymap).map((b) => b.key);
  for (const key of Object.keys(defaultKeymap["revision-log-nav"])) {
    expect(keys).toContain(key);
  }
  expect(keys).not.toContain("tab");
});

test("normal still surfaces the shared log and revision navigation keys alongside its commands", () => {
  const keys = collectCanonicalBindingsForMode("revision-log", defaultKeymap).map((b) => b.key);
  // Shared log keys — inherited from the `log` parent, must still be present
  expect(keys).toContain(":");
  expect(keys).toContain("?");
  expect(keys).toContain("/");
  expect(keys).toContain("f");
  expect(keys).toContain("G");
  expect(keys).toContain("j");
  expect(keys).toContain("p");
  expect(keys).toContain("ctrl-[");
  expect(keys).toContain("!");
  expect(keys).toContain("-");
  // Shared revision navigation — inherited through `revision-log-nav`
  expect(keys).toContain("J");
  expect(keys).toContain("K");
  expect(keys).toContain("alt-j");
  expect(keys).toContain("@");
  // Revision-specific keys remain directly on normal
  expect(keys).toContain("s");
  expect(keys).toContain("n");
  expect(keys).toContain("c");
});

test("collectCanonicalBindingsForMode excludes alias bindings (canonical: false)", () => {
  const resolved = resolveConfiguredKeymap({
    "revision-log": {
      x: { command: "move-down", canonical: false },
    },
  });

  const keys = collectCanonicalBindingsForMode("revision-log", resolved.keymap).map((b) => b.key);

  expect(keys).toContain("j");
  expect(keys).not.toContain("x");
  expect(keys).not.toContain("down");
});

test("collectCanonicalBindingsForMode excludes null bindings and their inherited commands", () => {
  const resolved = resolveConfiguredKeymap({
    rebase: {
      j: null,
    },
  });

  const keys = collectCanonicalBindingsForMode("rebase", resolved.keymap).map((binding) => binding.key);

  expect(keys).not.toContain("j");
});
