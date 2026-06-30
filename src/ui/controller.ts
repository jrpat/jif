import { join } from "node:path";
import type { ScrollBoxRenderable } from "@opentui/core";
import type {
  CommandController,
  InteractiveShellCommandOptions,
  InteractiveJjCommandOptions,
  JjCommandOptions,
  ShellCommandOptions,
} from "../commands/definitions.ts";
import type { AppLayout, BookmarkSuggestion, ChangedFile, FocusMode, OperationLogEntry, RebaseSourceKind, RebaseTargetKind } from "../domain/types.ts";
import { getChangeIdFromRevisionId, getRevisionArg } from "../domain/revisionIds.ts";
import { buildBookmarkSuggestions, type BookmarkTarget } from "../state/bookmarkSuggestions.ts";
import { buildForceRetryPlan } from "../jj/forceRetry.ts";
import { tokenizeCommandText, type WorkingCopyRefreshOptions } from "../jj/client.ts";
import { quoteCommand } from "../jj/process.ts";
import { formatFilesRevset, isFilesOnlyRevset } from "../revset/files.ts";
import { stripAnsi } from "../search/matching.ts";
import type { AppStore } from "../state/appStore.ts";
import {
  draftConfigs,
  getDisplayedCommandText,
  getExpandedRevision,
  getFocusedNotification,
  getFocusedOperationLogEntry,
  getFocusedRevision,
  getFocusedRevisionArg,
  getInlineConfirmation,
  getInlineConfirmationActualCommand,
  getSelectedRevisionIds,
  getSquashAnchorArg,
} from "../state/store.ts";
import { hasUserDescription } from "./revisionHeader.ts";

type ControllerClient = Readonly<{
  loadChangedFiles(revisionId: string): Promise<readonly ChangedFile[]>;
  loadConflictedFiles(revisionId: string): Promise<ReadonlySet<string>>;
  loadOperationLog(): Promise<readonly OperationLogEntry[]>;
  loadEvolog(revisionArg: string): Promise<readonly OperationLogEntry[]>;
  loadOperationDiff(operationId: string): Promise<string>;
  loadInterdiff(commandArgs: readonly string[]): Promise<string>;
  resolveDescendants(revisionId: string): Promise<readonly string[]>;
  resolveRange(from: string, to: string): Promise<readonly string[]>;
  resolveAbsorbTargets(source: string): Promise<readonly string[]>;
  loadBookmarkTargets(): Promise<readonly BookmarkTarget[]>;
  loadAncestorChangeIds(focusedChangeId: string): Promise<readonly string[]>;
  loadDescendantChangeIds(focusedChangeId: string): Promise<readonly string[]>;
  loadKnownFiles(): Promise<readonly string[]>;
}>;

type ExecuteCurrentCommand = (
  commandOverride?: string,
  options?: { recordHistory?: boolean },
) => Promise<void>;

type RunJjCommand = (
  commandText: string,
  options?: JjCommandOptions,
) => Promise<boolean>;

type RunShellCommand = (
  commandText: string,
  options?: ShellCommandOptions,
) => Promise<void>;

type RunInteractiveJjCommand = (
  commandText: string,
  options?: InteractiveJjCommandOptions,
) => Promise<boolean>;

type RunInteractiveShellCommand = (
  commandText: string,
  options?: InteractiveShellCommandOptions,
) => Promise<boolean>;

type OpenTextInEditor = (text: string) => Promise<void>;

type ApplyRevsetQuery = (query: string) => Promise<void>;
type RestoreLogRevsetFromFileFilter = () => Promise<void>;

export function createJifCommandController(args: Readonly<{
  store: AppStore;
  client: ControllerClient;
  destroy(): void;
  suspend(): void;
  executeCurrentCommand: ExecuteCurrentCommand;
  runJjCommand: RunJjCommand;
  runShellCommand: RunShellCommand;
  runInteractiveJjCommand: RunInteractiveJjCommand;
  runInteractiveShellCommand: RunInteractiveShellCommand;
  openTextInEditor: OpenTextInEditor;
  applyRevsetQuery: ApplyRevsetQuery;
  restoreLogRevsetFromFileFilter: RestoreLogRevsetFromFileFilter;
  reloadConfig(): Promise<void> | void;
  refreshRepository(options?: WorkingCopyRefreshOptions): Promise<boolean>;
  expandElidedRevisions(elidedIndex: number): Promise<void>;
  persistLayout(layout: AppLayout): void | Promise<unknown>;
  getDiffViewport(): ScrollBoxRenderable | undefined;
  getHelpViewport(): ScrollBoxRenderable | undefined;
  logShortcutPanelToggle(details: Readonly<{
    before: boolean;
    after: boolean;
    focusMode: FocusMode;
  }>): void;
}>): CommandController {
  const { store, client } = args;

  // `jj split` and `jj split --parallel` share the same flow: split the whole
  // revision when nothing is selected, otherwise confirm whether to carve out
  // only the selected files. The parallel variant just threads `-p` into every
  // composed command and preview.
  function beginSplit(parallel: boolean) {
    const state = store.snapshot();
    const revision = getFocusedRevision(state);
    if (!revision) {
      return;
    }

    const revisionArg = getRevisionArg(revision.revisionId, revision.changeIdPrefixLength);
    const baseArgs = parallel ? ["split", "-p"] : ["split"];
    const previewPrefix = parallel ? "split -p" : "split";
    // The selection belongs to the expanded revision, not to whichever focus
    // mode happens to be active. Overlays (notifications, op-log, …) can drop
    // focus out of files mode while leaving the revision expanded and its
    // files selected, so gate on the expanded row rather than focusMode.
    const selectedFilePaths = state.expandedRowId === revision.rowId
      ? state.selectedFilePaths
      : [];

    if (selectedFilePaths.length === 0) {
      void args.runInteractiveJjCommand(quoteCommand([...baseArgs, "-r", revisionArg]));
      return;
    }

    const absoluteFilePaths = selectedFilePaths.map((filePath) => join(state.repoPath, filePath));
    store.actions.openInlineConfirmation({
      kind: "split-files",
      rowId: revision.rowId,
      message: parallel ? "Split only selected files into a sibling?" : "Split only selected files?",
      options: ["yes", "interactive", "no"],
      selectedOption: "yes",
      actualCommandByOption: {
        yes: quoteCommand([...baseArgs, "-r", revisionArg, ...absoluteFilePaths]),
        interactive: quoteCommand([...baseArgs, "-i", "-r", revisionArg, ...absoluteFilePaths]),
        no: quoteCommand([...baseArgs, "-r", revisionArg]),
      },
      previewCommandByOption: {
        yes: `${previewPrefix} -r ${revisionArg} …files…`,
        interactive: `${previewPrefix} -i -r ${revisionArg} …files…`,
        no: `${previewPrefix} -r ${revisionArg}`,
      },
    });
  }

  return {
    moveFocus(delta: number) {
      store.actions.moveFocus(delta);
    },
    moveFocusToParent() {
      store.actions.moveFocusToParent();
    },
    moveFocusToChild() {
      store.actions.moveFocusToChild();
    },
    moveFocusToNextDivergentSibling() {
      store.actions.moveFocusToNextDivergentSibling();
    },
    moveFocusToWorkspace(direction: 1 | -1) {
      store.actions.moveFocusToWorkspace(direction);
    },
    moveFocusToBookmark(direction: 1 | -1) {
      store.actions.moveFocusToBookmark(direction);
    },
    openOperationLog() {
      store.actions.openOperationLog();
      store.actions.setOperationLogLoading(true);
      void (async () => {
        try {
          const entries = await client.loadOperationLog();
          store.actions.setOperationLogEntries(entries);
        } catch (error) {
          reportError(store, error);
        } finally {
          store.actions.setOperationLogLoading(false);
        }
      })();
    },
    openEvolog() {
      const state = store.snapshot();
      const revision = getFocusedRevision(state);
      const revisionArg = getFocusedRevisionArg(state);
      if (!revision || revisionArg === null || revision.marker === "elided") {
        store.actions.pushEvent("Cannot show evolog: no revision focused", "warning");
        return;
      }

      const label = `${revision.revisionId} ${firstLine(revision.description)}`.trim();
      store.actions.openEvolog(label);
      store.actions.setEvologEntries([]);
      store.actions.setEvologLoading(true);
      void (async () => {
        try {
          const entries = await client.loadEvolog(revisionArg);
          store.actions.setEvologEntries(entries);
        } catch (error) {
          reportError(store, error);
        } finally {
          store.actions.setEvologLoading(false);
        }
      })();
    },
    openNotifications() {
      store.actions.openNotifications();
    },
    expandNotification() {
      store.actions.expandFocusedNotification();
    },
    collapseNotification() {
      store.actions.collapseFocusedNotification();
    },
    editFocusedNotification() {
      const notification = getFocusedNotification(store.snapshot());
      if (!notification) {
        return;
      }

      void (async () => {
        try {
          await args.openTextInEditor(stripAnsi(notification.text));
        } catch (error) {
          reportError(store, error);
        }
      })();
    },
    openFocusedRevision() {
      const state = store.snapshot();
      const revision = getFocusedRevision(state);
      if (!revision) {
        return;
      }

      if (revision.marker === "elided") {
        void args.expandElidedRevisions(state.focusedRevisionIndex);
        return;
      }

      store.actions.openFocusedRevision();
      if (revision.filesLoaded) {
        return;
      }

      void loadRevisionFiles({
        client,
        store,
        rowId: revision.rowId,
        revisionId: revision.revisionId,
        hasConflict: revision.hasConflict,
      });
    },
    closeFocusedRevision() {
      store.actions.closeFocusedRevision();
    },
    quit() {
      args.destroy();
    },
    suspend() {
      args.suspend();
    },
    cancelOrBlur() {
      const state = store.snapshot();
      if (
        isFilesOnlyRevset(state.revsetQuery) &&
        state.commandDraft === null &&
        (state.focusMode === "revisions" || state.focusMode === "files")
      ) {
        void args.restoreLogRevsetFromFileFilter();
        return;
      }

      store.actions.cancelOrBlur();
    },
    confirm() {
      const state = store.snapshot();
      const inlineConfirmation = getInlineConfirmation(state);
      if (inlineConfirmation) {
        const commandText = getInlineConfirmationActualCommand(state)?.trim() ?? "";
        if (commandText.length === 0) {
          return;
        }

        if (inlineConfirmation.kind === "split-files") {
          // jj split can still prompt for descriptions even when files are preselected.
          void args.runInteractiveJjCommand(commandText);
          return;
        }

        void args.runInteractiveJjCommand(commandText);
        return;
      }

      if (
        state.commandDraft?.config.kind === "interdiff" ||
        state.commandDraft?.config.kind === "diff"
      ) {
        const commandText = getDisplayedCommandText(state).trim();
        const commandArgs = tokenizeCommandText(commandText);
        if (commandArgs.length === 0) {
          return;
        }
        void (async () => {
          try {
            const content = await client.loadInterdiff(commandArgs);
            store.actions.cancelCommand();
            store.actions.openDiffViewer(content.length > 0 ? content : "(no differences)");
          } catch (error) {
            reportError(store, error);
          }
        })();
        return;
      }

      if (state.commandDraft?.config.kind === "squash" && squashNeedsInteractiveShell(state)) {
        const commandText = getDisplayedCommandText(state).trim();
        if (commandText.length > 0) {
          void args.runInteractiveJjCommand(commandText);
        }
      } else {
        void args.executeCurrentCommand();
      }
    },
    focusCommandBar() {
      store.actions.focusCommandBar();
    },
    focusGitCommandBar() {
      store.actions.focusGitCommandBar();
    },
    focusShellCommandBar() {
      store.actions.focusShellCommandBar();
    },
    openFileSearch() {
      store.actions.openFileSearch();
    },
    restrictRevsetToFocusedFile() {
      const state = store.snapshot();
      const revision = getExpandedRevision(state);
      const file = revision?.files[state.focusedFileIndex];
      if (!file) {
        store.actions.pushEvent("Cannot filter by file: no file focused", "warning");
        return;
      }

      store.actions.closeFocusedRevision();
      void args.applyRevsetQuery(formatFilesRevset(file.path));
    },
    forceLastCommand() {
      const failedCommand = store.snapshot().lastFailedCommand;
      if (!failedCommand) {
        store.actions.pushEvent("No retryable command.", "error");
        return;
      }

      const retryPlan = buildForceRetryPlan({
        commandArgs: failedCommand.commandArgs,
        stderr: failedCommand.stderr || failedCommand.errorText,
      });
      if (!retryPlan) {
        store.actions.pushEvent("Last retryable command cannot be forced.", "error");
        return;
      }

      const retryCommandText = quoteCommand(retryPlan.commandArgs);
      void (async () => {
        const retrySucceeded = failedCommand.interactive
          ? await args.runInteractiveJjCommand(retryCommandText)
          : await args.runJjCommand(retryCommandText);

        if (!retrySucceeded || !failedCommand.statusMessageId) {
          return;
        }

        const toastStillVisible = store.snapshot().statusMessages.some((message) =>
          message.id === failedCommand.statusMessageId
        );
        if (toastStillVisible) {
          store.actions.dismissStatusMessage(failedCommand.statusMessageId);
        }
      })();
    },
    startSquash() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      store.actions.startCommandDraft(draftConfigs.squash);
    },
    startInterdiff() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      store.actions.startCommandDraft(draftConfigs.interdiff);
    },
    startDiff() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      store.actions.startCommandDraft(draftConfigs.diff);
    },
    startRebase() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      void (async () => {
        try {
          const descendants = await client.resolveDescendants(revision.revisionId);
          store.actions.startCommandDraft(draftConfigs.rebase, { descendantRevisionIds: descendants });
        } catch (error) {
          reportError(store, error);
        }
      })();
    },
    startRestore() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      store.actions.startCommandDraft(draftConfigs.restore);
    },
    startDuplicate() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      store.actions.startCommandDraft(draftConfigs.duplicate);
    },
    startRevert() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      store.actions.startCommandDraft(draftConfigs.revert);
    },
    diffEditRevision() {
      const revisionArg = getFocusedRevisionArg(store.snapshot());
      if (!revisionArg) {
        return;
      }

      void args.runInteractiveJjCommand(`diffedit -r ${revisionArg}`);
    },
    enterBookmarkMode() {
      store.actions.enterBookmarkLeader();
    },
    enterExtraMode() {
      store.actions.enterExtraMode();
    },
    startSetParents() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      store.actions.startSetParents();
    },
    toggleSetParentsPick() {
      store.actions.toggleSetParentsPick();
    },
    startBookmarkCreate() {
      const state = store.snapshot();
      const revision = getFocusedRevision(state);
      if (!revision) return;
      const useShort = state.useShortFlags;
      const revFlag = useShort ? "-r" : "--revision";
      const revisionArg = getRevisionArg(revision.revisionId, revision.changeIdPrefixLength);
      const prefill = `b create  ${revFlag} ${revisionArg}`;
      const cursorOffset = "b create ".length;
      store.actions.startBookmarkPrompt(prefill, cursorOffset, {
        focusedRevisionId: revision.revisionId,
        suggestions: [],
      });
    },
    startBookmarkMoveFrom() {
      store.actions.startCommandDraft(draftConfigs["bookmark-move-from"], { focusDirection: "up" });
    },
    startBookmarkMoveTo() {
      const state = store.snapshot();
      const revision = getFocusedRevision(state);
      if (!revision) return;
      const useShort = state.useShortFlags;
      const toFlag = useShort ? "-t" : "--to";
      const revisionArg = getRevisionArg(revision.revisionId, revision.changeIdPrefixLength);
      const prefill = `b move  ${toFlag} ${revisionArg}`;
      const cursorOffset = "b move ".length;
      void openBookmarkPromptWithSuggestions({
        prefill,
        cursorOffset,
        revision,
        includeCurrent: false,
        client,
        store,
      });
    },
    startBookmarkDelete() {
      void openBookmarkPromptSimple({
        keyword: "delete",
        client,
        store,
      });
    },
    startBookmarkForget() {
      void openBookmarkPromptSimple({
        keyword: "forget",
        client,
        store,
      });
    },
    startBookmarkSet() {
      const state = store.snapshot();
      const revision = getFocusedRevision(state);
      if (!revision) return;
      const useShort = state.useShortFlags;
      const revFlag = useShort ? "-r" : "--revision";
      const revisionArg = getRevisionArg(revision.revisionId, revision.changeIdPrefixLength);
      const prefill = `b set  ${revFlag} ${revisionArg}`;
      const cursorOffset = "b set ".length;
      void openBookmarkPromptWithSuggestions({
        prefill,
        cursorOffset,
        revision,
        includeCurrent: true,
        client,
        store,
      });
    },
    startBookmarkTrack() {
      void openBookmarkPromptSimple({
        keyword: "track",
        client,
        store,
      });
    },
    startBookmarkUntrack() {
      void openBookmarkPromptSimple({
        keyword: "untrack",
        client,
        store,
      });
    },
    startSplit() {
      beginSplit(false);
    },
    startSplitParallel() {
      beginSplit(true);
    },
    startNewRevision() {
      const revisionArg = getFocusedRevisionArg(store.snapshot());
      if (!revisionArg) {
        return;
      }

      void args.runJjCommand(`new ${revisionArg}`, { focusWorkingCopyAfterRefresh: true });
    },
    editRevision() {
      const revisionArg = getFocusedRevisionArg(store.snapshot());
      if (!revisionArg) {
        return;
      }

      void args.runJjCommand(`edit ${revisionArg}`);
    },
    commit() {
      void args.runInteractiveJjCommand("commit");
    },
    describe() {
      const revisionArg = getFocusedRevisionArg(store.snapshot());
      if (!revisionArg) return;
      void args.runInteractiveJjCommand(`describe -r ${revisionArg}`);
    },
    showRevisionDiff() {
      const state = store.snapshot();
      const revisionArg = getFocusedRevisionArg(state);
      if (!revisionArg) return;
      void args.runInteractiveJjCommand(`show -r ${revisionArg}`);
    },
    showFileDiff() {
      const state = store.snapshot();
      const revisionArg = getFocusedRevisionArg(state);
      if (!revisionArg) return;
      const file = getExpandedRevision(state)?.files[state.focusedFileIndex];
      if (!file) return;
      void args.runInteractiveJjCommand(
        quoteCommand(["diff", "-r", revisionArg, join(state.repoPath, file.path)]),
      );
    },
    restoreOperation() {
      const operation = getFocusedOperationLogEntry(store.snapshot());
      if (!operation) {
        return;
      }

      void args.runJjCommand(`op restore ${operation.id}`);
    },
    revertOperation() {
      const operation = getFocusedOperationLogEntry(store.snapshot());
      if (!operation) {
        return;
      }

      void args.runJjCommand(`op revert ${operation.id}`);
    },
    showOperationDiff() {
      const operation = getFocusedOperationLogEntry(store.snapshot());
      if (!operation) {
        return;
      }

      void (async () => {
        try {
          const content = await client.loadOperationDiff(operation.id);
          store.actions.openDiffViewer(content);
        } catch (error) {
          store.actions.reportError(error);
        }
      })();
    },
    scrollDiffViewer(rowDelta: number, colDelta: number) {
      args.getDiffViewport()?.scrollBy({ x: colDelta, y: rowDelta });
    },
    scrollHelpToast(rowDelta: number) {
      args.getHelpViewport()?.scrollBy({ x: 0, y: rowDelta });
    },
    toggleSelection() {
      store.actions.toggleRevisionSelection();
    },
    toggleFileSelection() {
      store.actions.toggleFileSelection();
    },
    selectAllFiles() {
      store.actions.selectAllFiles();
    },
    restoreFiles() {
      const state = store.snapshot();
      if (state.focusMode !== "files" || !state.expandedRowId) {
        return;
      }

      const revision = getExpandedRevision(state);
      if (!revision) {
        return;
      }

      const revisionArg = getRevisionArg(revision.revisionId, revision.changeIdPrefixLength);
      const focusedPath = revision.files[state.focusedFileIndex]?.path;
      const filePaths = state.selectedFilePaths.length > 0
        ? state.selectedFilePaths
        : focusedPath ? [focusedPath] : [];

      if (filePaths.length === 0) {
        return;
      }

      const absoluteFilePaths = filePaths.map((filePath) => join(state.repoPath, filePath));
      void args.runJjCommand(quoteCommand(["restore", "-c", revisionArg, ...absoluteFilePaths]));
    },
    untrackFiles() {
      const state = store.snapshot();
      if (state.focusMode !== "files" || !state.expandedRowId) {
        return;
      }

      const revision = getExpandedRevision(state);
      if (!revision) {
        return;
      }

      const focusedPath = revision.files[state.focusedFileIndex]?.path;
      const filePaths = state.selectedFilePaths.length > 0
        ? state.selectedFilePaths
        : focusedPath ? [focusedPath] : [];

      if (filePaths.length === 0) {
        return;
      }

      const absoluteFilePaths = filePaths.map((filePath) => join(state.repoPath, filePath));
      void args.runJjCommand(quoteCommand(["file", "untrack", ...absoluteFilePaths]));
    },
    selectPreviousInlineConfirmationOption() {
      store.actions.selectPreviousInlineConfirmationOption();
    },
    selectNextInlineConfirmationOption() {
      store.actions.selectNextInlineConfirmationOption();
    },
    toggleShortFlags() {
      store.actions.toggleShortFlags();
    },
    cycleLayout() {
      store.actions.cycleLayout();
      void args.persistLayout(store.snapshot().layout);
    },
    undo() {
      void args.runJjCommand("undo");
    },
    redo() {
      void args.runJjCommand("redo");
    },
    focusWorkingCopy() {
      store.actions.focusWorkingCopy();
    },
    focusLogBottom() {
      store.actions.focusLogBottom();
    },
    focusCurrentOperation() {
      store.actions.focusOperationLogEntryAt(0);
    },
    openRevsetInput(initialQuery?: string) {
      store.actions.openRevsetInput(initialQuery);
    },
    toggleShortcutPanel() {
      const before = store.snapshot().shortcutPanelExpanded;
      store.actions.toggleShortcutPanel();
      args.logShortcutPanelToggle({
        before,
        after: store.state.shortcutPanelExpanded,
        focusMode: store.state.focusMode,
      });
    },
    setRebaseSourceKind(kind: RebaseSourceKind) {
      const state = store.snapshot();
      if (state.commandDraft?.config.kind !== "rebase") {
        return;
      }

      if (kind !== "source") {
        store.actions.setRebaseSourceKind(kind);
        return;
      }

      void (async () => {
        try {
          const descendants = await client.resolveDescendants(getSelectedRevisionIds(state)[0] ?? "");
          store.actions.setRebaseSourceKind("source", descendants);
        } catch (error) {
          reportError(store, error);
        }
      })();
    },
    setRebaseTargetKind(kind: RebaseTargetKind) {
      store.actions.setRebaseTargetKind(kind);
    },
    toggleRebaseSkipEmptied() {
      store.actions.toggleRebaseSkipEmptied();
    },
    toggleInterdiffSwap() {
      store.actions.toggleInterdiffSwap();
    },
    selectAbsorbDescendants() {
      store.actions.selectAbsorbDescendants();
    },
    toggleSquashAnchor() {
      const state = store.snapshot();
      if (state.commandDraft?.config.kind !== "squash") {
        return;
      }

      const source = getSelectedRevisionIds(state)[0];
      if (!source) {
        store.actions.toggleSquashAnchor([]);
        return;
      }
      const anchor = getSquashAnchorArg(state);

      void (async () => {
        try {
          const anchorIds = await client.resolveRange(source, anchor);
          store.actions.toggleSquashAnchor(anchorIds);
        } catch (error) {
          reportError(store, error);
        }
      })();
    },
    startSquashOnto() {
      const state = store.snapshot();
      if (!getFocusedRevision(state)) {
        return;
      }
      // Selecting the branch above the focused revision is fully synchronous, so
      // there is no anchor range to resolve here.
      store.actions.startSquashOnto();
    },
    openSearch() {
      store.actions.openSearch();
    },
    openFastJump() {
      store.actions.openFastJump();
    },
    nextSearchMatch() {
      store.actions.nextSearchMatch();
    },
    prevSearchMatch() {
      store.actions.prevSearchMatch();
    },
    toggleSearchIdOnly() {
      store.actions.toggleSearchIdOnly();
    },
    reloadConfig() {
      void Promise.resolve(args.reloadConfig()).catch((error) => {
        reportError(store, error);
      });
    },
    refreshRepository() {
      void args.refreshRepository({ workingCopy: "snapshot" });
    },
    startAbsorb() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      void (async () => {
        try {
          const targets = await client.resolveAbsorbTargets(revision.revisionId);
          store.actions.startCommandDraft(draftConfigs.absorb, {
            presetRevisionIds: targets,
            absorbSourceRevisionId: revision.revisionId,
          });
        } catch (error) {
          reportError(store, error);
        }
      })();
    },
    abandonRevision() {
      const revisionArg = getFocusedRevisionArg(store.snapshot());
      if (!revisionArg) return;
      void args.runJjCommand(`abandon ${revisionArg}`);
    },
    jj(commandText, options) {
      return args.runJjCommand(commandText, {
        ...options,
        cwd: options?.cwd ?? store.snapshot().repoPath,
      }).then(() => {});
    },
    sh(commandText, options) {
      return args.runShellCommand(commandText, {
        ...options,
        cwd: options?.cwd ?? store.snapshot().repoPath,
      });
    },
    jji(commandText, options) {
      return args.runInteractiveJjCommand(commandText, {
        ...options,
        cwd: options?.cwd ?? store.snapshot().repoPath,
      }).then(() => {});
    },
    shi(commandText, options) {
      return args.runInteractiveShellCommand(commandText, {
        ...options,
        cwd: options?.cwd ?? store.snapshot().repoPath,
      }).then(() => {});
    },
    reportError(error) {
      reportError(store, error);
    },
  };
}

type RevisionFilesLoader = Pick<ControllerClient, "loadChangedFiles" | "loadConflictedFiles">;

const inFlightFileLoadsByStore = new WeakMap<AppStore, Set<string>>();

export async function loadRevisionFiles(args: Readonly<{
  client: RevisionFilesLoader;
  store: AppStore;
  rowId: string;
  revisionId: string;
  hasConflict: boolean;
}>) {
  let inFlight = inFlightFileLoadsByStore.get(args.store);
  if (!inFlight) {
    inFlight = new Set();
    inFlightFileLoadsByStore.set(args.store, inFlight);
  }
  if (inFlight.has(args.rowId)) {
    return;
  }
  inFlight.add(args.rowId);
  try {
    const [files, conflictedPaths] = await Promise.all([
      args.client.loadChangedFiles(args.revisionId),
      args.hasConflict
        ? args.client.loadConflictedFiles(args.revisionId)
        : Promise.resolve(new Set<string>()),
    ]);
    const enrichedFiles = conflictedPaths.size > 0
      ? files.map((file) => ({ ...file, hasConflict: conflictedPaths.has(file.path) }))
      : files;
    args.store.actions.setRevisionFiles(args.rowId, enrichedFiles);
  } catch (error) {
    reportError(args.store, error);
  } finally {
    inFlight.delete(args.rowId);
  }
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0] ?? "";
}

function reportError(store: AppStore, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  store.actions.pushEvent(message, "error");
}

async function openBookmarkPromptWithSuggestions(args: Readonly<{
  prefill: string;
  cursorOffset: number;
  revision: { revisionId: string };
  includeCurrent: boolean;
  client: ControllerClient;
  store: AppStore;
}>) {
  try {
    const focusedChangeId = getChangeIdFromRevisionId(args.revision.revisionId);
    const [bookmarks, ancestors, descendants] = await Promise.all([
      args.client.loadBookmarkTargets(),
      args.client.loadAncestorChangeIds(focusedChangeId),
      args.client.loadDescendantChangeIds(focusedChangeId),
    ]);
    const suggestions: readonly BookmarkSuggestion[] = buildBookmarkSuggestions(
      bookmarks,
      focusedChangeId,
      ancestors,
      descendants,
      { includeCurrent: args.includeCurrent },
    );
    args.store.actions.startBookmarkPrompt(args.prefill, args.cursorOffset, {
      focusedRevisionId: args.revision.revisionId,
      suggestions,
    });
  } catch (error) {
    reportError(args.store, error);
  }
}

async function openBookmarkPromptSimple(args: Readonly<{
  keyword: "delete" | "forget" | "track" | "untrack";
  client: ControllerClient;
  store: AppStore;
}>) {
  const state = args.store.snapshot();
  const revision = getFocusedRevision(state);
  if (!revision) return;
  const prefill = `b ${args.keyword} `;
  const cursorOffset = prefill.length;
  await openBookmarkPromptWithSuggestions({
    prefill,
    cursorOffset,
    revision,
    includeCurrent: true,
    client: args.client,
    store: args.store,
  });
}

function squashNeedsInteractiveShell(state: ReturnType<AppStore["snapshot"]>): boolean {
  const target = getFocusedRevision(state);
  if (!target || !hasUserDescription(target)) return false;
  const selectedIds = state.selectedRowIds;
  return state.revisions.some(
    (revision) => selectedIds.includes(revision.rowId) && hasUserDescription(revision),
  );
}
