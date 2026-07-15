import { expect, test } from "bun:test";
import { commandDefinitions } from "../src/commands/definitions.ts";
import type { AppState } from "../src/domain/types.ts";
import {
  createInitialState,
  draftConfigs,
  getCommandChipTextForRevision,
  getCommandTargetRowId,
  getDisplayedCommandText,
  openInlineConfirmation,
  setRebaseTargetKind,
  startCommandDraft,
  toggleInterdiffSwap,
} from "../src/state/store.ts";
import {
  resolveCommand,
  getActiveMode,
  getDirectCommandsForMode,
  defaultKeymap,
} from "../src/modes.ts";

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
        filesLoaded: false,
        files: [],
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
        graphRows: ["○  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: false,
        files: [],
      },
    ],
  };
}

function resolveForState(key: string, state: AppState): string | null {
  const mode = getActiveMode(state);
  const commandId = resolveCommand(mode, key);
  if (!commandId) return null;

  const command = commandDefinitions.find((c) => c.id === commandId);
  if (!command) return null;
  if (command.canExecute && !command.canExecute(state)) return null;

  return commandId;
}

test("resolveCommand resolves vim navigation in normal mode", () => {
  const state = createState();
  const parentState: AppState = { ...state, focusedRevisionIndex: 1 };

  expect(resolveForState("j", state)).toBe("move-down");
  expect(resolveForState("k", state)).toBe("move-up");
  expect(resolveForState("G", state)).toBe("jump-to-bottom");
  expect(resolveForState("J", state)).toBe("move-parent");
  expect(resolveForState("K", parentState)).toBe("move-child");
  expect(resolveForState("h", state)).toBe("collapse");
  expect(resolveForState("l", state)).toBe("expand");
  expect(resolveForState("left", state)).toBe("collapse");
});

test("quit is bound globally so q exits from any non-text-input mode", () => {
  expect(defaultKeymap._global.q).toBe("quit");
  expect(defaultKeymap.normal.q).toBeUndefined();
});

test("suspend uses ctrl-z canonically and Z as a normal-mode alias", () => {
  const state = createState();
  const revsetState: AppState = { ...state, focusMode: "revset" };

  expect(defaultKeymap._global["ctrl-z"]).toBe("suspend");
  expect(resolveForState("Z", state)).toBe("suspend");
  expect(resolveForState("Z", revsetState)).toBeNull();
  expect(defaultKeymap.normal.Z).toEqual({ command: "suspend", canonical: false });
});

test("resolveCommand returns null for unbound keys", () => {
  const state = createState();
  expect(resolveForState("z", state)).toBeNull();
});

test("open-evolog canExecute is false when no focused revision or marker is elided", () => {
  const command = commandDefinitions.find((c) => c.id === "open-evolog");
  expect(command).toBeDefined();
  expect(command?.canExecute?.(createState())).toBeTrue();

  const elidedState: AppState = {
    ...createState(),
    revisions: [{ ...createState().revisions[0]!, marker: "elided" }],
    focusedRevisionIndex: 0,
  };
  expect(command?.canExecute?.(elidedState)).toBeFalse();

  const emptyState: AppState = { ...createState(), revisions: [] };
  expect(command?.canExecute?.(emptyState)).toBeFalse();
});

test("ctrl-e resolves to open-evolog and ctrl-o to the operation log in normal mode", () => {
  expect(resolveForState("ctrl-e", createState())).toBe("open-evolog");
  expect(resolveForState("ctrl-o", createState())).toBe("open-operation-log");
});

test("E resolves to diff-edit-revision in normal mode", () => {
  expect(resolveForState("E", createState())).toBe("diff-edit-revision");
});

test("alt-j resolves to jump-to-next-divergent only on a divergent revision", () => {
  const plainState = createState();
  // The focused revision is not divergent, so the command's canExecute gates it.
  expect(resolveForState("alt-j", plainState)).toBeNull();

  const divergentState: AppState = {
    ...plainState,
    revisions: [
      { ...plainState.revisions[0]!, revisionId: "abc1234/1", changeIdPrefixLength: 4 },
      { ...plainState.revisions[1]!, revisionId: "abc1234/2", changeIdPrefixLength: 4 },
    ],
  };
  expect(resolveForState("alt-j", divergentState)).toBe("jump-to-next-divergent");
});

test("y, alt-r, and alt-s resolve to duplicate, revert, and split-parallel in normal mode", () => {
  const state = createState();
  expect(resolveForState("y", state)).toBe("duplicate");
  expect(resolveForState("alt-r", state)).toBe("revert");
  expect(resolveForState("alt-s", state)).toBe("split-parallel");
});

test("search command only executes in searchable views", () => {
  const searchCommand = commandDefinitions.find((command) => command.id === "search");
  const fastJumpCommand = commandDefinitions.find((command) => command.id === "fast-jump");

  expect(searchCommand?.canExecute?.(createState())).toBeTrue();
  expect(fastJumpCommand?.canExecute?.(createState())).toBeTrue();
  expect(searchCommand?.canExecute?.({ ...createState(), focusMode: "op-log" })).toBeTrue();
  expect(fastJumpCommand?.canExecute?.({ ...createState(), focusMode: "op-log" })).toBeTrue();
  expect(searchCommand?.canExecute?.({
    ...createState(),
    focusMode: "diff-viewer",
    diffViewer: { content: "diff" },
  })).toBeFalse();
  expect(fastJumpCommand?.canExecute?.({
    ...createState(),
    focusMode: "diff-viewer",
    diffViewer: { content: "diff" },
  })).toBeFalse();
});

test("ctrl-f opens file search from normal mode", () => {
  expect(resolveForState("ctrl-f", createState())).toBe("find-file");
});

test("resolveCommand returns null in command mode for browse keys", () => {
  const state: AppState = {
    ...createState(),
    focusMode: "command",
    commandBar: { kind: "jj", text: "", manual: true },
  };

  expect(resolveForState("j", state)).toBeNull();
  expect(resolveForState("k", state)).toBeNull();
});

test("rebase-descendants resolves in rebase mode but not normal mode", () => {
  expect(resolveForState("s", createState())).toBe("squash");

  const rebaseState = startCommandDraft(createState(), draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(resolveForState("s", rebaseState)).toBe("rebase-descendants");
});

test("rebase mode binds source, target, and modifier keys", () => {
  const rebaseState = startCommandDraft(createState(), draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });

  expect(resolveForState("B", rebaseState)).toBe("rebase-source-branch");
  expect(resolveForState("b", rebaseState)).toBe("rebase-target-before");
  expect(resolveForState("a", rebaseState)).toBe("rebase-target-after");
  expect(resolveForState("i", rebaseState)).toBe("rebase-target-insert-between");
  expect(resolveForState("e", rebaseState)).toBe("rebase-toggle-skip-emptied");
});

test("getDirectCommandsForMode returns only rebase-local bindings", () => {
  const commands = getDirectCommandsForMode("rebase", defaultKeymap, commandDefinitions);

  expect(commands.map((command) => command.id).sort()).toEqual([
    "rebase-descendants",
    "rebase-source-branch",
    "rebase-target-after",
    "rebase-target-before",
    "rebase-target-insert-between",
    "rebase-toggle-selection",
    "rebase-toggle-selection-kind",
    "rebase-toggle-skip-emptied",
  ]);
});

test("space and ctrl-space resolve to the rebase selection commands in rebase mode", () => {
  const rebaseState = startCommandDraft(createState(), draftConfigs.rebase, { descendantRevisionIds: ["aaaaaaaa"] });
  expect(resolveForState(" ", rebaseState)).toBe("rebase-toggle-selection");
  expect(resolveForState("ctrl-space", rebaseState)).toBe("rebase-toggle-selection-kind");

  // Duplicate and revert share the target picker but keep plain subject selection.
  const duplicated = startCommandDraft(createState(), draftConfigs.duplicate);
  expect(resolveForState(" ", duplicated)).toBe("toggle-revision-selection");
  expect(resolveForState("ctrl-space", duplicated)).toBeNull();
});

test("R triggers restore-revision in normal mode", () => {
  expect(resolveForState("R", createState())).toBe("restore-revision");
});

test("duplicate mode reuses the rebase target picker but drops the source knobs", () => {
  const drafted = startCommandDraft(createState(), draftConfigs.duplicate);

  expect(getActiveMode(drafted)).toBe("duplicate");
  expect(drafted.commandDraft?.config.kind).toBe("duplicate");

  // Target-kind toggles are shared with rebase.
  expect(resolveForState("b", drafted)).toBe("rebase-target-before");
  expect(resolveForState("a", drafted)).toBe("rebase-target-after");
  expect(resolveForState("i", drafted)).toBe("rebase-target-insert-between");
  // Duplicate has no --source / --branch / --skip-emptied modifiers.
  expect(resolveForState("B", drafted)).toBeNull();

  // Source revisions are positional; the destination uses the shared -d flag.
  const text = getDisplayedCommandText(drafted);
  expect(text.startsWith("duplicate a ")).toBeTrue();
  expect(text).toContain("-d b");

  const afterInsert = setRebaseTargetKind(drafted, "insert-after");
  expect(getDisplayedCommandText(afterInsert)).toContain("-A b");
});

test("duplicate chips tag the source as copy and the target as onto", () => {
  const drafted = startCommandDraft(createState(), draftConfigs.duplicate);
  const sourceRowId = drafted.selectedRowIds[0]!;
  const targetRowId = getCommandTargetRowId(drafted)!;

  expect(getCommandChipTextForRevision(drafted, sourceRowId)).toBe("copy");
  expect(getCommandChipTextForRevision(drafted, targetRowId)).toBe("onto");
});

test("revert mode composes jj revert -r <source> -d <target> with --ignore-immutable on force", () => {
  const drafted = startCommandDraft(createState(), draftConfigs.revert);

  expect(getActiveMode(drafted)).toBe("revert");
  expect(drafted.commandDraft?.config.kind).toBe("revert");
  expect(resolveForState("a", drafted)).toBe("rebase-target-after");

  const text = getDisplayedCommandText(drafted);
  expect(text.startsWith("revert -r a ")).toBeTrue();
  expect(text).toContain("-d b");

  const forced = getDisplayedCommandText(drafted, { forceApply: true });
  expect(forced).toContain("--ignore-immutable");

  const sourceRowId = drafted.selectedRowIds[0]!;
  expect(getCommandChipTextForRevision(drafted, sourceRowId)).toBe("revert");
});

test("i starts interdiff in normal mode and composes jj interdiff -f/-t", () => {
  const state = createState();
  expect(resolveForState("i", state)).toBe("interdiff");

  const drafted = startCommandDraft(state, draftConfigs.interdiff);
  expect(getActiveMode(drafted)).toBe("interdiff");
  expect(drafted.commandDraft?.config.kind).toBe("interdiff");
  expect(drafted.commandDraft?.config.sourceBadgeText).toBe("from");
  expect(drafted.commandDraft?.config.badgeText).toBe("to");
  expect(drafted.commandDraft?.config.template).toContain("interdiff");
  expect(drafted.commandDraft?.config.template).toContain("-f --from");
  expect(drafted.commandDraft?.config.template).toContain("-t --to");
});

function createFilesState(): AppState {
  const base = createState();
  return {
    ...base,
    focusMode: "files",
    focusModeStack: ["revisions", "files"],
    expandedRowId: "aaaaaaaa",
    revisions: base.revisions.map((revision, index) =>
      index === 0
        ? {
          ...revision,
          filesLoaded: true,
          files: [
            { path: "src/app.ts", status: "M" },
            { path: "src/util.ts", status: "M" },
          ],
        }
        : revision
    ),
  };
}

test("a selects all files in files mode", () => {
  const state = createFilesState();
  expect(getActiveMode(state)).toBe("files");
  expect(resolveForState("a", state)).toBe("select-all-files");
});

test("files mode does not inherit Normal revision commands", () => {
  const state = createFilesState();
  // Revision-level operations must not be reachable from the expanded file list
  expect(resolveForState("S", state)).toBeNull();
  expect(resolveForState("R", state)).toBeNull();
  expect(resolveForState("n", state)).toBeNull();
  expect(resolveForState("c", state)).toBeNull();
  // File-scoped actions and navigation remain available
  expect(resolveForState("j", state)).toBe("move-down");
  expect(resolveForState("k", state)).toBe("move-up");
  expect(resolveForState("h", state)).toBe("collapse");
  expect(resolveForState(" ", state)).toBe("toggle-file-selection");
  expect(resolveForState("s", state)).toBeNull();
  expect(resolveForState("ctrl-s", state)).toBe("split");
  expect(resolveForState("ctrl-f", state)).toBe("restrict-revset-to-focused-file");
});

test("restrict-revset-to-focused-file requires a focused file", () => {
  const command = commandDefinitions.find((c) => c.id === "restrict-revset-to-focused-file");
  expect(command).toBeDefined();
  expect(command?.canExecute?.(createFilesState())).toBeTrue();
  expect(command?.canExecute?.({ ...createState(), focusMode: "files" })).toBeFalse();
});

test("= swaps from/to roles while composing interdiff", () => {
  const state = createState();
  const drafted = startCommandDraft(state, draftConfigs.interdiff);

  expect(resolveForState("=", drafted)).toBe("interdiff-swap");

  const fromRowId = drafted.selectedRowIds[0]!;
  const toRowId = getCommandTargetRowId(drafted)!;
  expect(getCommandChipTextForRevision(drafted, fromRowId)).toBe("from");
  expect(getCommandChipTextForRevision(drafted, toRowId)).toBe("to");

  const before = getDisplayedCommandText(drafted);
  expect(before.startsWith("interdiff -f")).toBe(true);

  const swapped = toggleInterdiffSwap(drafted);
  expect(swapped.commandDraft?.interdiffSwapped).toBe(true);
  expect(getCommandChipTextForRevision(swapped, fromRowId)).toBe("to");
  expect(getCommandChipTextForRevision(swapped, toRowId)).toBe("from");

  const after = getDisplayedCommandText(swapped);
  expect(after.startsWith("interdiff -t")).toBe(true);

  const swappedBack = toggleInterdiffSwap(swapped);
  expect(swappedBack.commandDraft?.interdiffSwapped).toBe(false);
  expect(getDisplayedCommandText(swappedBack)).toBe(before);
});

test("toggleInterdiffSwap is a no-op outside interdiff drafts", () => {
  const state = createState();
  const drafted = startCommandDraft(state, draftConfigs.squash);
  expect(toggleInterdiffSwap(drafted)).toBe(drafted);
});

test("ctrl-d starts diff in normal mode and composes jj diff -f/-t", () => {
  const state = createState();
  expect(resolveForState("ctrl-d", state)).toBe("diff");

  const drafted = startCommandDraft(state, draftConfigs.diff);
  expect(getActiveMode(drafted)).toBe("diff");
  expect(drafted.commandDraft?.config.kind).toBe("diff");
  expect(drafted.commandDraft?.config.sourceBadgeText).toBe("from");
  expect(drafted.commandDraft?.config.badgeText).toBe("to");
  expect(drafted.commandDraft?.config.template).toContain("diff");
  expect(drafted.commandDraft?.config.template).toContain("-f --from");
  expect(drafted.commandDraft?.config.template).toContain("-t --to");
});

test("inline confirmation uses a dedicated mode with local option navigation", () => {
  let state = createState();
  state = {
    ...state,
    focusMode: "files",
    expandedRowId: "aaaaaaaa",
    revisions: state.revisions.map((revision, index) =>
      index === 0
        ? {
          ...revision,
          filesLoaded: true,
          files: [{ path: "src/app.ts", status: "M" }],
        }
        : revision
    ),
    selectedFilePaths: ["src/app.ts"],
  };

  state = openInlineConfirmation(state, {
    kind: "split-files",
    rowId: "aaaaaaaa",
    message: "Split selected files?",
    options: ["yes", "interactive", "no"],
    selectedOption: "yes",
    actualCommandByOption: {
      yes: "split -r a /tmp/repo/src/app.ts",
      interactive: "split -i -r a /tmp/repo/src/app.ts",
      no: "split -r a",
    },
    previewCommandByOption: {
      yes: "split -r a …files…",
      interactive: "split -i -r a …files…",
      no: "split -r a",
    },
  });

  expect(getActiveMode(state)).toBe("inline-confirmation");
  expect(resolveForState("h", state)).toBe("inline-confirmation-prev-option");
  expect(resolveForState("left", state)).toBe("inline-confirmation-prev-option");
  expect(resolveForState("l", state)).toBe("inline-confirmation-next-option");
  expect(resolveForState("right", state)).toBe("inline-confirmation-next-option");
  expect(resolveForState("j", state)).toBeNull();
});
test("undo and redo resolve in normal mode", () => {
  const state = createState();
  expect(resolveForState("u", state)).toBe("undo");
  expect(resolveForState("alt-u", state)).toBe("redo");
  expect(resolveForState("U", state)).toBeNull();
  expect(defaultKeymap.normal["alt-u"]).toBe("redo");
  expect(defaultKeymap.normal.U).toBeUndefined();
  // `G` is inherited from the shared `log` parent, not bound directly on normal.
  expect(defaultKeymap.log.G).toBe("jump-to-bottom");
});

test("absorb resolves on shift-a in normal mode", () => {
  const state = createState();
  expect(resolveForState("A", state)).toBe("absorb");
});

test("absorb draft activates absorb mode and keeps normal navigation", () => {
  const drafted = startCommandDraft(createState(), draftConfigs.absorb, {
    presetRevisionIds: ["bbbbbbbb"],
  });

  expect(getActiveMode(drafted)).toBe("absorb");
  expect(drafted.commandDraft?.config.kind).toBe("absorb");
  expect(resolveForState("s", drafted)).toBe("absorb-descendants");
  expect(resolveForState("j", drafted)).toBe("move-down");
  expect(resolveForState(" ", drafted)).toBe("toggle-revision-selection");
  expect(resolveForState("enter", drafted)).toBe("confirm");
});

test("short flags and layout cycling use - and _ respectively", () => {
  const state = createState();
  expect(resolveForState("-", state)).toBe("toggle-flags");
  expect(resolveForState("_", state)).toBe("cycle-layout");
});

test("shortcut panel toggle uses ? in normal mode", () => {
  const state = createState();
  expect(resolveForState("?", state)).toBe("shortcut-panel");
  expect(resolveForState("!", state)).toBe("force-last-command");
  expect(resolveForState(">", state)).toBe("shell-command-bar");
  expect(defaultKeymap.normal[">"]).toBe("shell-command-bar");
  expect(resolveForState("g", state)).toBe("git-command-bar");
  expect(defaultKeymap.normal["g"]).toBe("git-command-bar");

  const revsetState: AppState = { ...state, focusMode: "revset" };
  expect(resolveForState("?", revsetState)).toBeNull();
  expect(resolveForState("!", revsetState)).toBeNull();
  expect(resolveForState(">", revsetState)).toBeNull();
});

test("reload config is globally bound to ctrl-comma", () => {
  expect(defaultKeymap._global["ctrl-,"]).toBe("reload-config");
  expect(commandDefinitions.some((command) => command.id === "reload-config")).toBeTrue();
});

test("new and edit resolve in normal mode only", () => {
  const state = createState();
  expect(resolveForState("n", state)).toBe("new-revision");
  expect(resolveForState("e", state)).toBe("edit-revision");

  const commandState: AppState = {
    ...state,
    focusMode: "command",
    commandBar: { kind: "jj", text: "", manual: true },
  };
  expect(resolveForState("n", commandState)).toBeNull();
  expect(resolveForState("e", commandState)).toBeNull();
});

test("canExecute blocks commands on elided revisions", () => {
  const state: AppState = {
    ...createState(),
    revisions: [
      {
        rowId: "__elided_0",
        revisionId: "__elided_0",
        changeIdPrefixLength: 0,
        commitId: "",
        description: "(elided revisions)",
        localTimestamp: "",
        bookmarks: [],
        workspaces: [],
        graphRows: ["~  "],
        isEmpty: false,
        hasConflict: false,
        marker: "elided",
        filesLoaded: true,
        files: [],
      },
    ],
  };

  expect(resolveForState("n", state)).toBeNull();
  expect(resolveForState("e", state)).toBeNull();
  expect(resolveForState("h", state)).toBeNull();
  // expand still works (controller handles elided expansion)
  expect(resolveForState("l", state)).toBe("expand");
});

test("mode inheritance lets files mode use normal keys", () => {
  const state: AppState = {
    ...createState(),
    focusMode: "files",
    expandedRowId: "aaaaaaaa",
  };

  // Inherited from normal
  expect(resolveForState("j", state)).toBe("move-down");
  expect(resolveForState("k", state)).toBe("move-up");
  expect(resolveForState("?", state)).toBe("shortcut-panel");

  // Mode-local in files
  expect(defaultKeymap.files["ctrl-s"]).toBe("split");
  expect(resolveForState("ctrl-s", state)).toBe("split");
  expect(resolveForState("r", state)).toBe("restore");
  expect(resolveForState(" ", state)).toBe("toggle-file-selection");
});

test("_global escape binding resolves regardless of mode", () => {
  expect(defaultKeymap._global["escape"]).toBe("cancel");
});
