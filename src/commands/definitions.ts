import { getAdjacentBookmarkRevisionIndex, getAdjacentWorkspaceRevisionIndex, getExpandedRevision, getFocusedChildRevision, getFocusedNotification, getFocusedOperationLogEntry, getFocusedParentRevision, getNextDivergentSiblingIndex } from "../state/store.ts";
import type { AppState, RebaseSourceKind, RebaseTargetKind } from "../domain/types.ts";
import { canSearchState } from "../search/matching.ts";

export type JjCommandOptions = Readonly<{
  cwd?: string;
  focusWorkingCopyAfterRefresh?: boolean;
}>;

export type ShellCommandOptions = JjCommandOptions;

export type InteractiveJjCommandOptions = Readonly<{
  cwd?: string;
}>;

export type InteractiveShellCommandOptions = Readonly<{
  cwd?: string;
}>;

export type CommandController = Readonly<{
  moveFocus: (delta: number) => void;
  moveFocusToParent: () => void;
  moveFocusToChild: () => void;
  moveFocusToNextDivergentSibling: () => void;
  moveFocusToWorkspace: (direction: 1 | -1) => void;
  moveFocusToBookmark: (direction: 1 | -1) => void;
  focusLogBottom: () => void;
  focusCurrentOperation: () => void;
  openOperationLog: () => void;
  openEvolog: () => void;
  openFocusedRevision: () => void;
  closeFocusedRevision: () => void;
  quit: () => void;
  suspend: () => void;
  cancelOrBlur: () => void;
  confirm: () => void;
  focusCommandBar: () => void;
  focusGitCommandBar: () => void;
  focusShellCommandBar: () => void;
  forceLastCommand: () => void;
  startRebase: () => void;
  startDuplicate: () => void;
  startRevert: () => void;
  startRestore: () => void;
  startSplit: () => void;
  startSplitParallel: () => void;
  diffEditRevision: () => void;
  startSquash: () => void;
  startSquashOnto: () => void;
  startInterdiff: () => void;
  startDiff: () => void;
  startNewRevision: () => void;
  editRevision: () => void;
  enterBookmarkMode: () => void;
  enterExtraMode: () => void;
  startSetParents: () => void;
  toggleSetParentsPick: () => void;
  startNewBetween: () => void;
  toggleNewBetweenBefore: () => void;
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
  selectAllFiles: () => void;
  restoreFiles: () => void;
  untrackFiles: () => void;
  startAbsorb: () => void;
  selectAbsorbDescendants: () => void;
  selectPreviousInlineConfirmationOption: () => void;
  selectNextInlineConfirmationOption: () => void;
  toggleShortFlags: () => void;
  cycleLayout: () => void;
  setRebaseSourceKind: (kind: RebaseSourceKind) => void;
  setRebaseTargetKind: (kind: RebaseTargetKind) => void;
  toggleRebaseSkipEmptied: () => void;
  toggleRebaseSelection: () => void;
  toggleRebaseSelectionKind: () => void;
  toggleSquashAnchor: () => void;
  toggleInterdiffSwap: () => void;
  undo: () => void;
  redo: () => void;
  focusWorkingCopy: () => void;
  openRevsetInput: (initialQuery?: string) => void;
  openFileSearch: () => void;
  restrictRevsetToFocusedFile: () => void;
  toggleShortcutPanel: () => void;
  commit: () => void;
  describe: () => void;
  showRevisionDiff: () => void;
  showFileDiff: () => void;
  restoreOperation: () => void;
  revertOperation: () => void;
  showOperationDiff: () => void;
  scrollDiffViewer: (rowDelta: number, colDelta: number) => void;
  scrollHelpToast: (rowDelta: number) => void;
  togglePreview: () => void;
  cyclePreviewPosition: () => void;
  togglePreviewWordWrap: () => void;
  togglePreviewFullFile: () => void;
  expandPreview: () => void;
  shrinkPreview: () => void;
  scrollPreview: (rowDelta: number) => void;
  openNotifications: () => void;
  expandNotification: () => void;
  collapseNotification: () => void;
  editFocusedNotification: () => void;
  openSearch: () => void;
  openFastJump: () => void;
  nextSearchMatch: () => void;
  prevSearchMatch: () => void;
  toggleSearchIdOnly: () => void;
  reloadConfig: () => void;
  refreshRepository: () => void;
  abandonRevision: () => void;
  jj: (commandText: string, options?: JjCommandOptions) => Promise<void>;
  sh: (commandText: string, options?: ShellCommandOptions) => Promise<void>;
  jji: (commandText: string, options?: InteractiveJjCommandOptions) => Promise<void>;
  shi: (commandText: string, options?: InteractiveShellCommandOptions) => Promise<void>;
  reportError: (error: unknown) => void;
}>;

export type UserCommandController = Omit<CommandController, "reportError">;

export type CommandDefinition = Readonly<{
  id: string;
  title: string;
  description?: string;
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

function helpToastVisible(state: AppState): boolean {
  return state.statusMessages.some((message) => message.variant === "help");
}

export const commandDefinitions: readonly CommandDefinition[] = [
  {
    id: "move-down",
    title: "Move Down",
    description: "Move through revisions or files",
    run: (controller) => controller.moveFocus(1),
  },
  {
    id: "move-up",
    title: "Move Up",
    description: "Move through revisions or files",
    run: (controller) => controller.moveFocus(-1),
  },
  {
    id: "scroll-down",
    title: "Scroll Down",
    description: "Scroll the diff viewer down",
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(1, 0),
  },
  {
    id: "scroll-up",
    title: "Scroll Up",
    description: "Scroll the diff viewer up",
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(-1, 0),
  },
  {
    id: "scroll-left",
    title: "Scroll Left",
    description: "Scroll the diff viewer left",
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(0, -1),
  },
  {
    id: "scroll-right",
    title: "Scroll Right",
    description: "Scroll the diff viewer right",
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(0, 1),
  },
  {
    id: "scroll-down-large",
    title: "Scroll Down Large",
    description: "Scroll the diff viewer down by 10 lines",
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(10, 0),
  },
  {
    id: "scroll-up-large",
    title: "Scroll Up Large",
    description: "Scroll the diff viewer up by 10 lines",
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(-10, 0),
  },
  {
    id: "scroll-left-large",
    title: "Scroll Left Large",
    description: "Scroll the diff viewer left by 10 characters",
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(0, -10),
  },
  {
    id: "scroll-right-large",
    title: "Scroll Right Large",
    description: "Scroll the diff viewer right by 10 characters",
    canExecute: (state) => state.diffViewer !== null,
    run: (controller) => controller.scrollDiffViewer(0, 10),
  },
  {
    id: "scroll-help-down",
    title: "Scroll Help Down",
    description: "Scroll the visible help toast down one line",
    canExecute: helpToastVisible,
    run: (controller) => controller.scrollHelpToast(1),
  },
  {
    id: "scroll-help-up",
    title: "Scroll Help Up",
    description: "Scroll the visible help toast up one line",
    canExecute: helpToastVisible,
    run: (controller) => controller.scrollHelpToast(-1),
  },
  {
    id: "move-parent",
    title: "Move to Parent",
    description: "Focus the nearest visible parent revision",
    canExecute: (state) => getFocusedParentRevision(state) !== null,
    run: (controller) => controller.moveFocusToParent(),
  },
  {
    id: "move-child",
    title: "Move Up Graph",
    description: "Focus the first visible child revision above the current selection",
    canExecute: (state) => getFocusedChildRevision(state) !== null,
    run: (controller) => controller.moveFocusToChild(),
  },
  {
    id: "jump-to-next-divergent",
    title: "Next Divergent",
    description: "Jump to the next visible divergent sibling of the focused revision",
    canExecute: (state) => getNextDivergentSiblingIndex(state) !== null,
    run: (controller) => controller.moveFocusToNextDivergentSibling(),
  },
  {
    id: "move-to-next-workspace",
    title: "Next Workspace",
    description: "Focus the next visible revision that has a workspace",
    canExecute: (state) => getAdjacentWorkspaceRevisionIndex(state, 1) !== null,
    run: (controller) => controller.moveFocusToWorkspace(1),
  },
  {
    id: "move-to-prev-workspace",
    title: "Previous Workspace",
    description: "Focus the previous visible revision that has a workspace",
    canExecute: (state) => getAdjacentWorkspaceRevisionIndex(state, -1) !== null,
    run: (controller) => controller.moveFocusToWorkspace(-1),
  },
  {
    id: "move-to-next-bookmark",
    title: "Next Bookmark",
    description: "Focus the next visible revision that has a bookmark",
    canExecute: (state) => getAdjacentBookmarkRevisionIndex(state, 1) !== null,
    run: (controller) => controller.moveFocusToBookmark(1),
  },
  {
    id: "move-to-prev-bookmark",
    title: "Previous Bookmark",
    description: "Focus the previous visible revision that has a bookmark",
    canExecute: (state) => getAdjacentBookmarkRevisionIndex(state, -1) !== null,
    run: (controller) => controller.moveFocusToBookmark(-1),
  },
  {
    id: "jump-to-bottom",
    title: "Jump to Bottom",
    description: "Jump to the last revision in the log",
    run: (controller) => controller.focusLogBottom(),
  },
  {
    id: "jump-to-current-operation",
    title: "Jump to @",
    description: "Jump to the current operation",
    run: (controller) => controller.focusCurrentOperation(),
    group: "mode",
  },
  {
    id: "open-operation-log",
    title: "Operation Log",
    description: "Show the repository operation log",
    run: (controller) => controller.openOperationLog(),
    group: "global",
  },
  {
    id: "open-evolog",
    title: "Evolog",
    description: "Show the evolution log for the focused revision",
    canExecute: (state) => {
      const revision = state.revisions[state.focusedRevisionIndex];
      return revision !== undefined && revision.marker !== "elided";
    },
    run: (controller) => controller.openEvolog(),
    group: "global",
  },
  {
    id: "open-notifications",
    title: "Notifications",
    description: "Show recent toast notifications",
    run: (controller) => controller.openNotifications(),
    group: "global",
  },
  {
    id: "expand-notification",
    title: "Expand",
    description: "Show all lines of the focused notification",
    run: (controller) => controller.expandNotification(),
    group: "mode",
  },
  {
    id: "collapse-notification",
    title: "Collapse",
    description: "Truncate the focused notification",
    run: (controller) => controller.collapseNotification(),
    group: "mode",
  },
  {
    id: "edit-notification",
    title: "Edit in $EDITOR",
    description: "Open the focused notification's text in $EDITOR",
    canExecute: (state) => getFocusedNotification(state) !== null,
    run: (controller) => controller.editFocusedNotification(),
    group: "mode",
  },
  {
    id: "expand",
    title: "Expand Revision",
    description: "Open changed files for the focused revision",
    run: (controller) => controller.openFocusedRevision(),
  },
  {
    id: "collapse",
    title: "Collapse Revision",
    description: "Close the focused detail view",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.closeFocusedRevision(),
  },
  {
    id: "command-bar",
    title: "Command Bar",
    description: "Focus the command bar",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.focusCommandBar(),
    group: "global",
  },
  {
    id: "git-command-bar",
    title: "Git Command",
    description: "Compose a jj git command with completion",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.focusGitCommandBar(),
    group: "global",
  },
  {
    id: "shell-command-bar",
    title: "Shell Command Bar",
    description: "Focus the shell command bar",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.focusShellCommandBar(),
    group: "global",
  },
  {
    id: "force-last-command",
    title: "Retry + Force",
    description: "Retry the latest retryable command with a force flag when supported",
    run: (controller) => controller.forceLastCommand(),
    group: "global",
  },
  {
    id: "shortcut-panel",
    title: "Shortcuts",
    description: "Expand or collapse the shortcut panel",
    run: (controller) => controller.toggleShortcutPanel(),
    group: "global",
  },
  {
    id: "quit",
    title: "Quit",
    description: "Exit the application",
    run: (controller) => controller.quit(),
    group: "global",
  },
  {
    id: "suspend",
    title: "Suspend",
    description: "Suspend the application and return to the shell",
    run: (controller) => controller.suspend(),
    group: "global",
  },
  {
    id: "confirm",
    title: "Confirm",
    description: "Run the current command",
    run: (controller) => controller.confirm(),
    group: "mode",
  },
  {
    id: "cancel",
    title: "Cancel",
    description: "Cancel command composition or leave input mode",
    run: (controller) => controller.cancelOrBlur(),
    group: "cancel",
  },
  {
    id: "rebase",
    title: "Rebase",
    description: "Start a rebase command from the focused revision",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startRebase(),
    group: "global",
  },
  {
    id: "restore-revision",
    title: "Restore",
    description: "Restore the focused revision from another",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startRestore(),
    group: "global",
  },
  {
    id: "duplicate",
    title: "Duplicate",
    description: "Copy the focused revision to another location, choosing the target",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startDuplicate(),
    group: "global",
  },
  {
    id: "revert",
    title: "Revert",
    description: "Create a new revision that undoes the focused revision, choosing where to place it",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startRevert(),
    group: "global",
  },
  {
    id: "split",
    title: "Split",
    description: "Split the focused revision, or choose how to use the current file selection",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startSplit(),
    group: "mode",
  },
  {
    id: "split-parallel",
    title: "Split Parallel",
    description: "Split the focused revision into sibling commits that share its parent",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startSplitParallel(),
    group: "mode",
  },
  {
    id: "restore",
    title: "Restore",
    description: "Restore selected files to their state before this change",
    run: (controller) => controller.restoreFiles(),
    group: "mode",
  },
  {
    id: "untrack",
    title: "Untrack",
    description: "Stop tracking the focused file, or all selected files",
    run: (controller) => controller.untrackFiles(),
    group: "mode",
  },
  {
    id: "squash",
    title: "Squash",
    description: "Squash the focused revision into another",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startSquash(),
    group: "global",
  },
  {
    id: "squash-onto",
    title: "Squash Onto",
    description: "Keep the focused revision as the target and select the branch above it (or the lowest selected revision and its descendants) as the source",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startSquashOnto(),
    group: "global",
  },
  {
    id: "interdiff",
    title: "Interdiff",
    description: "Show the interdiff between the focused revision and another",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startInterdiff(),
    group: "global",
  },
  {
    id: "diff",
    title: "Diff",
    description: "Show the diff between the focused revision and another",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startDiff(),
    group: "global",
  },
  {
    id: "new-revision",
    title: "New Revision",
    description: "Create a new revision from the focused revision",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startNewRevision(),
    group: "global",
  },
  {
    id: "edit-revision",
    title: "Edit Revision",
    description: "Edit the focused revision",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.editRevision(),
    group: "global",
  },
  {
    id: "diff-edit-revision",
    title: "Diff Edit",
    description: "Touch up the focused revision's changes in your diff editor",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.diffEditRevision(),
    group: "global",
  },
  {
    id: "commit",
    title: "Commit",
    description: "Commit the working-copy revision (@)",
    run: (controller) => controller.commit(),
    group: "global",
  },
  {
    id: "describe",
    title: "Describe",
    description: "Edit description of the focused revision",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.describe(),
    group: "global",
  },
  {
    id: "show-revision-diff",
    title: "Diff",
    description: "Show diff for the focused revision",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.showRevisionDiff(),
    group: "global",
  },
  {
    id: "show-file-diff",
    title: "Diff",
    description: "Show diff for the focused file",
    canExecute: (state) => focusedFileExists(state),
    run: (controller) => controller.showFileDiff(),
    group: "global",
  },
  {
    id: "restore-operation",
    title: "Restore Operation",
    description: "Restore the selected operation",
    canExecute: (state) => getFocusedOperationLogEntry(state) !== null,
    run: (controller) => controller.restoreOperation(),
    group: "mode",
  },
  {
    id: "revert-operation",
    title: "Revert Operation",
    description: "Revert the selected operation",
    canExecute: (state) => getFocusedOperationLogEntry(state) !== null,
    run: (controller) => controller.revertOperation(),
    group: "mode",
  },
  {
    id: "show-operation-diff",
    title: "Operation Diff",
    description: "Show repository changes for the selected operation",
    canExecute: (state) => getFocusedOperationLogEntry(state) !== null,
    run: (controller) => controller.showOperationDiff(),
    group: "mode",
  },
  {
    id: "toggle-revision-selection",
    title: "Select",
    description: "Add or remove the focused revision from the selection",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.toggleSelection(),
    group: "mode",
  },
  {
    id: "toggle-file-selection",
    title: "Select File",
    description: "Add or remove the focused file from the selection",
    run: (controller) => controller.toggleFileSelection(),
    group: "mode",
  },
  {
    id: "select-all-files",
    title: "Select All Files",
    description: "Select every changed file, or clear the selection if all are already selected",
    run: (controller) => controller.selectAllFiles(),
    group: "mode",
  },
  {
    id: "toggle-flags",
    title: "Short Flags",
    description: "Toggle between short and long flag names",
    run: (controller) => controller.toggleShortFlags(),
    group: "global",
  },
  {
    id: "cycle-layout",
    title: "Cycle Layout",
    description: "Rotate expanded, condensed, and super-condensed layouts",
    run: (controller) => controller.cycleLayout(),
    group: "global",
  },
  {
    id: "toggle-preview",
    title: "Toggle Preview",
    description: "Show or hide the preview pane for this session",
    run: (controller) => controller.togglePreview(),
    group: "global",
  },
  {
    id: "cycle-preview-position",
    title: "Preview Position",
    description: "Cycle the preview pane between auto, right, and below",
    run: (controller) => controller.cyclePreviewPosition(),
    group: "global",
  },
  {
    id: "toggle-preview-word-wrap",
    title: "Preview Word Wrap",
    description: "Wrap or unwrap long preview diff lines",
    run: (controller) => controller.togglePreviewWordWrap(),
    group: "global",
  },
  {
    id: "toggle-preview-full-file",
    title: "Full File Preview",
    description: "Toggle effectively full-file context for file preview diffs",
    canExecute: (state) => state.focusMode === "files",
    run: (controller) => controller.togglePreviewFullFile(),
    group: "mode",
  },
  {
    id: "expand-preview",
    title: "Grow Preview",
    description: "Grow the preview pane",
    run: (controller) => controller.expandPreview(),
    group: "global",
  },
  {
    id: "shrink-preview",
    title: "Shrink Preview",
    description: "Shrink the preview pane",
    run: (controller) => controller.shrinkPreview(),
    group: "global",
  },
  {
    id: "scroll-preview-down",
    title: "Scroll Preview Down",
    description: "Scroll the preview pane down",
    run: (controller) => controller.scrollPreview(1),
    group: "global",
  },
  {
    id: "scroll-preview-up",
    title: "Scroll Preview Up",
    description: "Scroll the preview pane up",
    run: (controller) => controller.scrollPreview(-1),
    group: "global",
  },
  {
    id: "undo",
    title: "Undo",
    description: "Undo the last operation",
    run: (controller) => controller.undo(),
    group: "global",
  },
  {
    id: "redo",
    title: "Redo",
    description: "Redo the last undone operation",
    run: (controller) => controller.redo(),
    group: "global",
  },
  {
    id: "jump-to-working-copy",
    title: "Jump to @",
    description: "Jump to the working-copy revision",
    run: (controller) => controller.focusWorkingCopy(),
  },
  {
    id: "rebase-descendants",
    title: "Toggle --source",
    description: "Rebase the focused revision and its descendants",
    run: (controller) => controller.setRebaseSourceKind("source"),
    group: "mode",
  },
  {
    id: "rebase-source-branch",
    title: "Toggle --branch",
    description: "Rebase the whole branch containing the focused revision",
    run: (controller) => controller.setRebaseSourceKind("branch"),
    group: "mode",
  },
  {
    id: "rebase-target-before",
    title: "Toggle --insert-before",
    description: "Insert the rebase before the target revision",
    run: (controller) => controller.setRebaseTargetKind("insert-before"),
    group: "mode",
  },
  {
    id: "rebase-target-after",
    title: "Toggle --insert-after",
    description: "Insert the rebase after the target revision",
    run: (controller) => controller.setRebaseTargetKind("insert-after"),
    group: "mode",
  },
  {
    id: "rebase-target-insert-between",
    title: "Insert between",
    description: "Pin the focused revision as --insert-after; navigate to choose --insert-before",
    run: (controller) => controller.setRebaseTargetKind("insert-between"),
    group: "mode",
  },
  {
    id: "rebase-toggle-skip-emptied",
    title: "Toggle --skip-emptied",
    description: "Skip revisions that become empty after the rebase",
    run: (controller) => controller.toggleRebaseSkipEmptied(),
    group: "mode",
  },
  {
    id: "rebase-toggle-selection",
    title: "Select",
    description: "Add or remove the focused revision as a rebase subject or an additional target, per the current spacebar behavior",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.toggleRebaseSelection(),
    group: "mode",
  },
  {
    id: "rebase-toggle-selection-kind",
    title: "Select Subjects/Targets",
    description: "Toggle whether space selects additional rebase subjects or additional targets",
    run: (controller) => controller.toggleRebaseSelectionKind(),
    group: "mode",
  },
  {
    id: "squash-from-anchor",
    title: "Squash To Anchor",
    description: "Extend the squash source to a range ending at @ (or @- if @ is empty)",
    run: (controller) => controller.toggleSquashAnchor(),
    group: "mode",
  },
  {
    id: "interdiff-swap",
    title: "Swap from/to",
    description: "Swap whether the focused and selected revisions are the --from or --to of the interdiff",
    run: (controller) => controller.toggleInterdiffSwap(),
    group: "mode",
  },
  {
    id: "absorb-descendants",
    title: "Select Descendants",
    description: "Select absorb targets from the focused revision, stopping before the absorb source",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.selectAbsorbDescendants(),
    group: "mode",
  },
  {
    id: "inline-confirmation-prev-option",
    title: "Previous Option",
    description: "Select the previous confirmation option",
    run: (controller) => controller.selectPreviousInlineConfirmationOption(),
    group: "mode",
  },
  {
    id: "inline-confirmation-next-option",
    title: "Next Option",
    description: "Select the next confirmation option",
    run: (controller) => controller.selectNextInlineConfirmationOption(),
    group: "mode",
  },
  {
    id: "edit-revset",
    title: "Edit Revset",
    description: "Change which revisions are displayed",
    run: (controller) => controller.openRevsetInput(),
  },
  {
    id: "find-file",
    title: "Find File",
    description: "Find revisions that changed a file",
    run: (controller) => controller.openFileSearch(),
    group: "global",
  },
  {
    id: "restrict-revset-to-focused-file",
    title: "File History",
    description: "Show revisions that changed the focused file",
    canExecute: focusedFileExists,
    run: (controller) => controller.restrictRevsetToFocusedFile(),
    group: "mode",
  },
  {
    id: "search",
    title: "Search",
    description: "Incremental search through the revision log",
    canExecute: canSearchState,
    run: (controller) => controller.openSearch(),
    group: "global",
  },
  {
    id: "fast-jump",
    title: "Fast Jump",
    description: "Incremental search that clears highlights on Enter",
    canExecute: canSearchState,
    run: (controller) => controller.openFastJump(),
    group: "global",
  },
  {
    id: "search-next",
    title: "Next Match",
    description: "Jump to the next search match",
    canExecute: (state) => state.searchQuery !== "",
    run: (controller) => controller.nextSearchMatch(),
    group: "mode",
  },
  {
    id: "search-prev",
    title: "Prev Match",
    description: "Jump to the previous search match",
    canExecute: (state) => state.searchQuery !== "",
    run: (controller) => controller.prevSearchMatch(),
    group: "mode",
  },
  {
    id: "search-toggle-id-only",
    title: "ID-only",
    description: "Restrict the search to revision IDs, matched by prefix",
    run: (controller) => controller.toggleSearchIdOnly(),
    group: "mode",
  },
  {
    id: "refresh-repository",
    title: "Refresh",
    description: "Refresh the revision log",
    run: (controller) => controller.refreshRepository(),
    group: "global",
  },
  {
    id: "reload-config",
    title: "Reload Config",
    description: "Reload config files and apply runtime settings",
    run: (controller) => controller.reloadConfig(),
    group: "global",
  },
  {
    id: "absorb",
    title: "Absorb",
    description: "Absorb working-copy changes into ancestor revisions, choosing the targets",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startAbsorb(),
    group: "global",
  },
  {
    id: "abandon",
    title: "Abandon",
    description: "Abandon the focused revision",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.abandonRevision(),
    group: "global",
  },
  {
    id: "enter-bookmark-mode",
    title: "Bookmark",
    description: "Enter bookmark mode",
    run: (controller) => controller.enterBookmarkMode(),
    group: "global",
  },
  {
    id: "set-parents",
    title: "Set Parents",
    description: "Change the focused revision's parents; toggle revisions to add or remove them as parents",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startSetParents(),
    group: "global",
  },
  {
    id: "toggle-set-parents-pick",
    title: "Toggle Parent",
    description: "Add the focused revision as a parent of the subject, or remove it if it already is one",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.toggleSetParentsPick(),
    group: "mode",
  },
  {
    id: "new-between",
    title: "New Between",
    description: "Create a new revision inserted after the selected revisions and before the focused one",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startNewBetween(),
    group: "global",
  },
  {
    id: "toggle-new-between-before",
    title: "Pin --insert-before",
    description: "Pin the focused revision as an explicit --insert-before target, or unpin it",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.toggleNewBetweenBefore(),
    group: "mode",
  },
  {
    id: "enter-extra-mode",
    title: "Extra",
    description: "Enter extra mode for user-defined commands",
    run: (controller) => controller.enterExtraMode(),
    group: "global",
  },
  {
    id: "bookmark-create",
    title: "Create",
    description: "Create a bookmark on the focused revision",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startBookmarkCreate(),
    group: "mode",
  },
  {
    id: "bookmark-move-from",
    title: "Move From",
    description: "Move a bookmark from the focused revision to another",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startBookmarkMoveFrom(),
    group: "mode",
  },
  {
    id: "bookmark-move-to",
    title: "Move To",
    description: "Move a bookmark to the focused revision",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startBookmarkMoveTo(),
    group: "mode",
  },
  {
    id: "bookmark-delete",
    title: "Delete",
    description: "Delete a bookmark",
    run: (controller) => controller.startBookmarkDelete(),
    group: "mode",
  },
  {
    id: "bookmark-forget",
    title: "Forget",
    description: "Forget a bookmark",
    run: (controller) => controller.startBookmarkForget(),
    group: "mode",
  },
  {
    id: "bookmark-set",
    title: "Set",
    description: "Set a bookmark to the focused revision",
    canExecute: (state) => !focusedIsElided(state),
    run: (controller) => controller.startBookmarkSet(),
    group: "mode",
  },
  {
    id: "bookmark-track",
    title: "Track",
    description: "Track a remote bookmark",
    run: (controller) => controller.startBookmarkTrack(),
    group: "mode",
  },
  {
    id: "bookmark-untrack",
    title: "Untrack",
    description: "Untrack a remote bookmark",
    run: (controller) => controller.startBookmarkUntrack(),
    group: "mode",
  },
];
