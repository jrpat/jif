import { getExpandedRevision, getFocusedChildRevision, getFocusedOperationLogEntry, getFocusedParentRevision } from "../state/store.ts";
import type { AppState } from "../domain/types.ts";
import { canSearchState } from "../search/matching.ts";

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
  openOperationLog: () => void;
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
  enterBookmarkMode: () => void;
  startBookmarkCreate: () => void;
  startBookmarkMoveFrom: () => void;
  startBookmarkMoveTo: () => void;
  startBookmarkDelete: () => void;
  startBookmarkForget: () => void;
  startBookmarkSet: () => void;
  startBookmarkTrack: () => void;
  startBookmarkUntrack: () => void;
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
  showRevisionDiff: () => void;
  showFileDiff: () => void;
  restoreOperation: () => void;
  revertOperation: () => void;
  showOperationDiff: () => void;
  scrollDiffViewer: (rowDelta: number, colDelta: number) => void;
  openNotifications: () => void;
  expandNotification: () => void;
  collapseNotification: () => void;
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

function focusedFileExists(state: AppState): boolean {
  if (focusedIsElided(state)) return false;
  const expanded = getExpandedRevision(state);
  return expanded !== null && expanded.files[state.focusedFileIndex] !== undefined;
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
    id: "scroll-down",
    title: "Scroll Down",
    description: "Scroll the diff viewer down",
    canonicalKeys: ["j"],
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(1, 0),
  },
  {
    id: "scroll-up",
    title: "Scroll Up",
    description: "Scroll the diff viewer up",
    canonicalKeys: ["k"],
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(-1, 0),
  },
  {
    id: "scroll-left",
    title: "Scroll Left",
    description: "Scroll the diff viewer left",
    canonicalKeys: ["h"],
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(0, -1),
  },
  {
    id: "scroll-right",
    title: "Scroll Right",
    description: "Scroll the diff viewer right",
    canonicalKeys: ["l"],
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(0, 1),
  },
  {
    id: "scroll-down-large",
    title: "Scroll Down Large",
    description: "Scroll the diff viewer down by 10 lines",
    canonicalKeys: ["J"],
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(10, 0),
  },
  {
    id: "scroll-up-large",
    title: "Scroll Up Large",
    description: "Scroll the diff viewer up by 10 lines",
    canonicalKeys: ["K"],
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(-10, 0),
  },
  {
    id: "scroll-left-large",
    title: "Scroll Left Large",
    description: "Scroll the diff viewer left by 10 characters",
    canonicalKeys: ["H"],
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(0, -10),
  },
  {
    id: "scroll-right-large",
    title: "Scroll Right Large",
    description: "Scroll the diff viewer right by 10 characters",
    canonicalKeys: ["L"],
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(0, 10),
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
    id: "open-operation-log",
    title: "Operation Log",
    description: "Show the repository operation log",
    canonicalKeys: ["O"],
    run: (controller) => controller.openOperationLog(),
    group: "global",
  },
  {
    id: "open-notifications",
    title: "Notifications",
    description: "Show recent toast notifications",
    canonicalKeys: ["`"],
    run: (controller) => controller.openNotifications(),
    group: "global",
  },
  {
    id: "expand-notification",
    title: "Expand",
    description: "Show all lines of the focused notification",
    canonicalKeys: ["l"],
    run: (controller) => controller.expandNotification(),
    group: "mode",
  },
  {
    id: "collapse-notification",
    title: "Collapse",
    description: "Truncate the focused notification",
    canonicalKeys: ["h"],
    run: (controller) => controller.collapseNotification(),
    group: "mode",
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
    title: "Retry + Force",
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
    id: "show-revision-diff",
    title: "Diff",
    description: "Show diff for the focused revision",
    canonicalKeys: ["d"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.showRevisionDiff(),
    group: "global",
  },
  {
    id: "show-file-diff",
    title: "Diff",
    description: "Show diff for the focused file",
    canonicalKeys: ["d"],
    canExecute: (state) => focusedFileExists(state),
    run: (controller) => controller.showFileDiff(),
    group: "global",
  },
  {
    id: "restore-operation",
    title: "Restore Operation",
    description: "Restore the selected operation",
    canonicalKeys: ["r"],
    canExecute: (state) => getFocusedOperationLogEntry(state) !== null,
    run: (controller) => controller.restoreOperation(),
    group: "mode",
  },
  {
    id: "revert-operation",
    title: "Revert Operation",
    description: "Revert the selected operation",
    canonicalKeys: ["R"],
    canExecute: (state) => getFocusedOperationLogEntry(state) !== null,
    run: (controller) => controller.revertOperation(),
    group: "mode",
  },
  {
    id: "show-operation-diff",
    title: "Operation Diff",
    description: "Show repository changes for the selected operation",
    canonicalKeys: ["D"],
    canExecute: (state) => getFocusedOperationLogEntry(state) !== null,
    run: (controller) => controller.showOperationDiff(),
    group: "mode",
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
    canExecute: canSearchState,
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
  {
    id: "enter-bookmark-mode",
    title: "Bookmark",
    description: "Enter bookmark mode",
    canonicalKeys: ["b"],
    run: (controller) => controller.enterBookmarkMode(),
    group: "global",
  },
  {
    id: "bookmark-create",
    title: "Create",
    description: "Create a bookmark on the focused revision",
    canonicalKeys: ["c"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startBookmarkCreate(),
    group: "mode",
  },
  {
    id: "bookmark-move-from",
    title: "Move From",
    description: "Move a bookmark from the focused revision to another",
    canonicalKeys: ["m"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startBookmarkMoveFrom(),
    group: "mode",
  },
  {
    id: "bookmark-move-to",
    title: "Move To",
    description: "Move a bookmark to the focused revision",
    canonicalKeys: ["M"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startBookmarkMoveTo(),
    group: "mode",
  },
  {
    id: "bookmark-delete",
    title: "Delete",
    description: "Delete a bookmark",
    canonicalKeys: ["d"],
    run: (controller) => controller.startBookmarkDelete(),
    group: "mode",
  },
  {
    id: "bookmark-forget",
    title: "Forget",
    description: "Forget a bookmark",
    canonicalKeys: ["f"],
    run: (controller) => controller.startBookmarkForget(),
    group: "mode",
  },
  {
    id: "bookmark-set",
    title: "Set",
    description: "Set a bookmark to the focused revision",
    canonicalKeys: ["s"],
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startBookmarkSet(),
    group: "mode",
  },
  {
    id: "bookmark-track",
    title: "Track",
    description: "Track a remote bookmark",
    canonicalKeys: ["t"],
    run: (controller) => controller.startBookmarkTrack(),
    group: "mode",
  },
  {
    id: "bookmark-untrack",
    title: "Untrack",
    description: "Untrack a remote bookmark",
    canonicalKeys: ["u"],
    run: (controller) => controller.startBookmarkUntrack(),
    group: "mode",
  },
];
