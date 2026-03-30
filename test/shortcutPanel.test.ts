import { expect, test } from "bun:test";
import { getVisibleCommands, type CommandDefinition } from "../src/commands/definitions.ts";
import type { AppState } from "../src/domain/types.ts";
import { createInitialState, draftConfigs, openFocusedRevision, startCommandDraft } from "../src/state/store.ts";
import {
  buildShortcutEntries,
  buildShortcutGrid,
  buildShortcutSummary,
  computeShortcutPanelHeight,
  formatShortcutKeyLabel,
  getShortcutPanelCommands,
  normalizeShortcutSortKey,
  shortcutModeLabel,
} from "../src/ui/shortcutPanel.ts";

function createCommand(
  id: string,
  title: string,
  canonicalKeys: readonly string[],
): Pick<CommandDefinition, "id" | "title" | "canonicalKeys"> {
  return { id, title, canonicalKeys };
}

function createState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      {
        changeId: "aaaaaaaa",
        changeIdPrefixLength: 1,
        commitId: "11111111",
        description: "first",
        bookmarks: [],
        workspaces: [],
        graphHead: "@  ",
        graphTail: [],
        isEmpty: false,
        marker: "working-copy",
        filesLoaded: true,
        files: [{ status: "M", path: "src/a.ts" }],
      },
      {
        changeId: "bbbbbbbb",
        changeIdPrefixLength: 1,
        commitId: "22222222",
        description: "second",
        bookmarks: [],
        workspaces: [],
        graphHead: "o  ",
        graphTail: [],
        isEmpty: false,
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
    createCommand("focus-filter", "Filter", ["c-f"]),
    createCommand("find", "Find", ["f"]),
    createCommand("quit", "Quit", ["q"]),
  ]);

  expect(entries.map((entry) => entry.keyLabel)).toEqual(["f", "c-f", "q"]);
});

test("buildShortcutEntries expands multiple canonical keys into separate entries", () => {
  const entries = buildShortcutEntries([
    createCommand("move-down", "Move Down", ["j", "down"]),
  ]);

  expect(entries.map((entry) => entry.id)).toEqual([
    "move-down:down",
    "move-down:j",
  ]);
});

test("buildShortcutSummary creates a collapsed single-line help string", () => {
  const summary = buildShortcutSummary(
    buildShortcutEntries([
      createCommand("shortcuts", "Shortcuts", ["?"]),
      createCommand("quit", "Quit", ["q"]),
    ]),
  );

  expect(summary).toBe("? shortcuts   q quit");
});

test("buildShortcutSummary uses abbreviated key labels from canonical keys", () => {
  const summary = buildShortcutSummary(
    buildShortcutEntries([
      createCommand("cancel", "Cancel", ["escape"]),
    ]),
  );

  expect(summary).toBe("esc cancel");
});

test("formatShortcutKeyLabel keeps key descriptions to three letters or fewer", () => {
  expect(formatShortcutKeyLabel("space")).toBe("spc");
  expect(formatShortcutKeyLabel("enter")).toBe("ret");
  expect(formatShortcutKeyLabel("left")).toBe("←");
  expect(formatShortcutKeyLabel("right")).toBe("→");
  expect(formatShortcutKeyLabel("down")).toBe("↓");
  expect(formatShortcutKeyLabel("up")).toBe("↑");
  expect(formatShortcutKeyLabel("escape")).toBe("esc");
  expect(formatShortcutKeyLabel("j")).toBe("j");
});

test("buildShortcutGrid packs entries left to right before wrapping", () => {
  const entries = buildShortcutEntries([
    createCommand("a", "Alpha", ["a"]),
    createCommand("b", "Bravo", ["b"]),
    createCommand("c", "Charlie", ["c"]),
    createCommand("d", "Delta", ["d"]),
    createCommand("e", "Echo", ["e"]),
  ]);

  const grid = buildShortcutGrid(entries, 50);

  expect(grid.columnCount).toBe(2);
  expect(grid.rows.map((row) => row.map((entry) => entry.keyLabel))).toEqual([
    ["a", "b"],
    ["c", "d"],
    ["e"],
  ]);
});

test("buildShortcutGrid falls back to one column in narrow terminals", () => {
  const entries = buildShortcutEntries([
    createCommand("a", "Alpha", ["a"]),
    createCommand("b", "Bravo", ["b"]),
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
  expect(shortcutModeLabel("revisions")).toBe("Revisions");
  expect(shortcutModeLabel("files")).toBe("Files");
  expect(shortcutModeLabel("command")).toBe("Command");
});

test("getShortcutPanelCommands narrows rebase draft shortcuts to draft-relevant actions", () => {
  let state = createState();
  state = startCommandDraft(state, draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa", "bbbbbbbb"] });

  const commands = getShortcutPanelCommands(state, getVisibleCommands(state));
  const ids = commands.map((command) => command.id);

  expect(ids).toContain("move-down");
  expect(ids).toContain("move-up");
  expect(ids).toContain("confirm");
  expect(ids).toContain("cancel");
  expect(ids).toContain("rebase-descendants");
  expect(ids).toContain("shortcut-panel");
  expect(ids).not.toContain("quit");
  expect(ids).not.toContain("undo");
  expect(ids).not.toContain("toggle-condensed-layout");
  expect(ids).not.toContain("edit-revset");
});

test("getShortcutPanelCommands narrows file mode shortcuts to file-relevant actions", () => {
  let state = createState();
  state = openFocusedRevision(state);

  const commands = getShortcutPanelCommands(state, getVisibleCommands(state));
  const ids = commands.map((command) => command.id);

  expect(ids).toContain("restore");
  expect(ids).toContain("toggle-file-selection");
  expect(ids).toContain("collapse");
  expect(ids).toContain("shortcut-panel");
  expect(ids).not.toContain("rebase");
  expect(ids).not.toContain("squash");
  expect(ids).not.toContain("undo");
  expect(ids).not.toContain("edit-revset");
});
