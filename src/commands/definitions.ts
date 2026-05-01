import { getFocusedChildRevision, getFocusedParentRevision } from "../state/store.ts";
import type { AppState } from "../domain/types.ts";

export type JjCommandOptions = Readonly<{
  cwd?: string;
  focusWorkingCopyAfterRefresh?: boolean;
}>;

export type ShellCommandOptions = JjCommandOptions;

export type InteractiveJjCommandOptions = Readonly<{
  cwd?: string;
}>;

export type CommandController = Readonly<{
  moveFocus: (delta: number) => void;
  moveFocusToParent: () => void;
  moveFocusToChild: () => void;
  focusLogBottom: () => void;
  openFocusedRevision: () => void;
  closeFocusedRevision: () => void;
  quit: () => void;
  suspend: () => void;
  cancelOrBlur: () => void;
  confirm: () => void;
  focusCommandBar: () => void;
  focusShellCommandBar: () => void;
  forceLastCommand: () => void;
  startRebase: () => void;
  startSplit: () => void;
  startSquash: () => void;
  startNewRevision: () => void;
  editRevision: () => void;
  toggleSelection: () => void;
  toggleFileSelection: () => void;
  restoreFiles: () => void;
  selectPreviousInlineConfirmationOption: () => void;
  selectNextInlineConfirmationOption: () => void;
  toggleShortFlags: () => void;
  cycleLayout: () => void;
  toggleRebaseDescendants: () => void;
  undo: () => void;
  redo: () => void;
  focusWorkingCopy: () => void;
  openRevsetInput: () => void;
  toggleShortcutPanel: () => void;
  commit: () => void;
  describe: () => void;
  showDiff: () => void;
  openSearch: () => void;
  nextSearchMatch: () => void;
  prevSearchMatch: () => void;
  refreshRepository: () => void;
  absorb: () => void;
  abandonRevision: () => void;
  jj: (commandText: string, options?: JjCommandOptions) => Promise<void>;
  sh: (commandText: string, options?: ShellCommandOptions) => Promise<void>;
  jji: (commandText: string, options?: InteractiveJjCommandOptions) => Promise<void>;
  reportError: (error: unknown) => void;
}>;

export type UserCommandController = Omit<CommandController, "reportError">;

export type CommandDefinition = Readonly<{
  id: string;
  title: string;
  description: string;
  canonicalKeys: readonly string[];
  canExecute?: (state: AppState) => boolean;
  run: (controller: CommandController, state: AppState) => void | Promise<void>;
  group?: "global" | "mode" | "cancel";
}>;

function focusedIsElided(state: AppState): boolean {
  const revision = state.revisions[state.focusedRevisionIndex];
  return revision?.marker === "elided";
}

export const commandDefinitions: readonly CommandDefinition[] = [
  {
    id: "move-down",
    title: "Move Down",
    description: "Move through revisions or files",
    canonicalKeys: ["j"],
    run: (controller) => controller.moveFocus(1),
  },
  {
    id: "move-up",
    title: "Move Up",
    description: "Move through revisions or files",
    canonicalKeys: ["k"],
    run: (controller) => controller.moveFocus(-1),
  },
  {
    id: "move-parent",
    title: "Move to Parent",
    description: "Focus the nearest visible parent revision",
    canonicalKeys: ["J"],
    canExecute: (state) => getFocusedParentRevision(state) !== null,
    run: (controller) => controller.moveFocusToParent(),
  },
  {
    id: "move-child",
    title: "Move Up Graph",
    description: "Focus the first visible child revision above the current selection",
    canonicalKeys: ["K"],
    canExecute: (state) => getFocusedChildRevision(state) !== null,
    run: (controller) => controller.moveFocusToChild(),
  },
  {
    id: "jump-to-bottom",
    title: "Jump to Bottom",
    description: "Jump to the last revision in the log",
    canonicalKeys: ["G"],
    run: (controller) => controller.focusLogBottom(),
  },
  {
    id: "expand",
    title: "Expand Revision",
    description: "Open changed files for the focused revision",
    canonicalKeys: ["l"],
    run: (controller) => controller.openFocusedRevision(),
  },
  {
    id: "collapse",
    title: "Collapse Revision",
    description: "Close the focused detail view",
    canonicalKeys: ["h"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.closeFocusedRevision(),
  },
  {
    id: "command-bar",
    title: "Command Bar",
    description: "Focus the command bar",
    canonicalKeys: [":"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.focusCommandBar(),
    group: "global",
  },
  {
    id: "shell-command-bar",
    title: "Shell Command Bar",
    description: "Focus the shell command bar",
    canonicalKeys: [">"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.focusShellCommandBar(),
    group: "global",
  },
  {
    id: "force-last-command",
    title: "Force",
    description: "Retry the latest failed command with a force flag when supported",
    canonicalKeys: ["!"],
    run: (controller) => controller.forceLastCommand(),
    group: "global",
  },
  {
    id: "shortcut-panel",
    title: "Shortcuts",
    description: "Expand or collapse the shortcut panel",
    canonicalKeys: ["?"],
    run: (controller) => controller.toggleShortcutPanel(),
    group: "global",
  },
  {
    id: "quit",
    title: "Quit",
    description: "Exit the application",
    canonicalKeys: ["q"],
    run: (controller) => controller.quit(),
    group: "global",
  },
  {
    id: "suspend",
    title: "Suspend",
    description: "Suspend the application and return to the shell",
    canonicalKeys: ["ctrl-z"],
    run: (controller) => controller.suspend(),
    group: "global",
  },
  {
    id: "confirm",
    title: "Confirm",
    description: "Run the current command",
    canonicalKeys: ["enter"],
    run: (controller) => controller.confirm(),
    group: "mode",
  },
  {
    id: "cancel",
    title: "Cancel",
    description: "Cancel command composition or leave input mode",
    canonicalKeys: ["esc"],
    run: (controller) => controller.cancelOrBlur(),
    group: "cancel",
  },
  {
    id: "rebase",
    title: "Rebase",
    description: "Start a rebase command from the focused revision",
    canonicalKeys: ["r"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startRebase(),
    group: "global",
  },
  {
    id: "split",
    title: "Split",
    description: "Split the focused revision, or choose how to use the current file selection",
    canonicalKeys: ["s"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startSplit(),
    group: "mode",
  },
  {
    id: "restore",
    title: "Restore",
    description: "Restore selected files to their state before this change",
    canonicalKeys: ["r"],
    run: (controller) => controller.restoreFiles(),
    group: "mode",
  },
  {
    id: "squash",
    title: "Squash",
    description: "Squash the focused revision into another",
    canonicalKeys: ["S"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startSquash(),
    group: "global",
  },
  {
    id: "new-revision",
    title: "New Revision",
    description: "Create a new revision from the focused revision",
    canonicalKeys: ["n"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startNewRevision(),
    group: "global",
  },
  {
    id: "edit-revision",
    title: "Edit Revision",
    description: "Edit the focused revision",
    canonicalKeys: ["e"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.editRevision(),
    group: "global",
  },
  {
    id: "commit",
    title: "Commit",
    description: "Commit the working-copy revision (@)",
    canonicalKeys: ["c"],
    run: (controller) => controller.commit(),
    group: "global",
  },
  {
    id: "describe",
    title: "Describe",
    description: "Edit description of the focused revision",
    canonicalKeys: ["D"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.describe(),
    group: "global",
  },
  {
    id: "show-diff",
    title: "Diff",
    description: "Show diff for the focused revision or file",
    canonicalKeys: ["d"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.showDiff(),
    group: "global",
  },
  {
    id: "toggle-revision-selection",
    title: "Select",
    description: "Add or remove the focused revision from the selection",
    canonicalKeys: ["space"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.toggleSelection(),
    group: "mode",
  },
  {
    id: "toggle-file-selection",
    title: "Select File",
    description: "Add or remove the focused file from the selection",
    canonicalKeys: ["space"],
    run: (controller) => controller.toggleFileSelection(),
    group: "mode",
  },
  {
    id: "toggle-flags",
    title: "Short Flags",
    description: "Toggle between short and long flag names",
    canonicalKeys: ["-"],
    run: (controller) => controller.toggleShortFlags(),
    group: "global",
  },
  {
    id: "cycle-layout",
    title: "Cycle Layout",
    description: "Rotate expanded, condensed, and super-condensed layouts",
    canonicalKeys: ["_"],
    run: (controller) => controller.cycleLayout(),
    group: "global",
  },
  {
    id: "undo",
    title: "Undo",
    description: "Undo the last operation",
    canonicalKeys: ["u"],
    run: (controller) => controller.undo(),
    group: "global",
  },
  {
    id: "redo",
    title: "Redo",
    description: "Redo the last undone operation",
    canonicalKeys: ["U"],
    run: (controller) => controller.redo(),
    group: "global",
  },
  {
    id: "jump-to-working-copy",
    title: "Jump to @",
    description: "Jump to the working-copy revision",
    canonicalKeys: ["@"],
    run: (controller) => controller.focusWorkingCopy(),
  },
  {
    id: "rebase-descendants",
    title: "Toggle Descendants",
    description: "Include descendants in the rebase preview",
    canonicalKeys: ["s"],
    run: (controller) => controller.toggleRebaseDescendants(),
    group: "mode",
  },
  {
    id: "inline-confirmation-prev-option",
    title: "Previous Option",
    description: "Select the previous confirmation option",
    canonicalKeys: ["h"],
    run: (controller) => controller.selectPreviousInlineConfirmationOption(),
    group: "mode",
  },
  {
    id: "inline-confirmation-next-option",
    title: "Next Option",
    description: "Select the next confirmation option",
    canonicalKeys: ["l"],
    run: (controller) => controller.selectNextInlineConfirmationOption(),
    group: "mode",
  },
  {
    id: "edit-revset",
    title: "Edit Revset",
    description: "Change which revisions are displayed",
    canonicalKeys: ["L"],
    run: (controller) => controller.openRevsetInput(),
  },
  {
    id: "search",
    title: "Search",
    description: "Incremental search through the revision log",
    canonicalKeys: ["/"],
    run: (controller) => controller.openSearch(),
    group: "global",
  },
  {
    id: "search-next",
    title: "Next Match",
    description: "Jump to the next search match",
    canonicalKeys: ["n"],
    run: (controller) => controller.nextSearchMatch(),
    group: "mode",
  },
  {
    id: "search-prev",
    title: "Prev Match",
    description: "Jump to the previous search match",
    canonicalKeys: ["p"],
    run: (controller) => controller.prevSearchMatch(),
    group: "mode",
  },
  {
    id: "refresh-repository",
    title: "Refresh",
    description: "Refresh the revision log",
    canonicalKeys: ["ctrl-r"],
    run: (controller) => controller.refreshRepository(),
    group: "global",
  },
  {
    id: "absorb",
    title: "Absorb",
    description: "Run jj absorb",
    canonicalKeys: ["A"],
    run: (controller) => controller.absorb(),
    group: "global",
  },
  {
    id: "abandon",
    title: "Abandon",
    description: "Abandon the focused revision",
    canonicalKeys: ["a"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.abandonRevision(),
    group: "global",
  },
];
