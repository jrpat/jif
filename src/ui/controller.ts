import { join } from "node:path";
import type { ScrollBoxRenderable } from "@opentui/core";
import type {
  CommandController,
  InteractiveJjCommandOptions,
  JjCommandOptions,
  ShellCommandOptions,
} from "../commands/definitions.ts";
import type { AppLayout, ChangedFile, FocusMode, OperationLogEntry } from "../domain/types.ts";
import { getRevisionArg } from "../domain/revisionIds.ts";
import { buildForceRetryPlan } from "../jj/forceRetry.ts";
import { quoteCommand } from "../jj/process.ts";
import type { AppStore } from "../state/appStore.ts";
import {
  draftConfigs,
  getDisplayedCommandText,
  getExpandedRevision,
  getFocusedOperationLogEntry,
  getFocusedRevision,
  getFocusedRevisionArg,
  getInlineConfirmation,
  getInlineConfirmationActualCommand,
  getSelectedRevisionIds,
  isFileNavigationActive,
} from "../state/store.ts";
import { hasUserDescription } from "./revisionHeader.ts";

type ControllerClient = Readonly<{
  loadChangedFiles(revisionId: string): Promise<readonly ChangedFile[]>;
  loadConflictedFiles(revisionId: string): Promise<ReadonlySet<string>>;
  loadOperationLog(): Promise<readonly OperationLogEntry[]>;
  loadOperationDiff(operationId: string): Promise<string>;
  resolveDescendants(revisionId: string): Promise<readonly string[]>;
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

export function createJifCommandController(args: Readonly<{
  store: AppStore;
  client: ControllerClient;
  destroy(): void;
  suspend(): void;
  executeCurrentCommand: ExecuteCurrentCommand;
  runJjCommand: RunJjCommand;
  runShellCommand: RunShellCommand;
  runInteractiveJjCommand: RunInteractiveJjCommand;
  refreshRepository(): Promise<boolean>;
  expandElidedRevisions(elidedIndex: number): Promise<void>;
  persistLayout(layout: AppLayout): void | Promise<unknown>;
  getDiffViewport(): ScrollBoxRenderable | undefined;
  logShortcutPanelToggle(details: Readonly<{
    before: boolean;
    after: boolean;
    focusMode: FocusMode;
  }>): void;
}>): CommandController {
  const { store, client } = args;

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
    focusShellCommandBar() {
      store.actions.focusShellCommandBar();
    },
    forceLastCommand() {
      const failedCommand = store.snapshot().lastFailedCommand;
      if (!failedCommand) {
        store.actions.pushEvent("No retryable failed command.", "error");
        return;
      }

      const retryPlan = buildForceRetryPlan({
        commandArgs: failedCommand.commandArgs,
        stderr: failedCommand.stderr || failedCommand.errorText,
      });
      if (!retryPlan) {
        store.actions.pushEvent("Last failed command cannot be forced.", "error");
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
    startSplit() {
      const state = store.snapshot();
      const revision = getFocusedRevision(state);
      if (!revision) {
        return;
      }

      const revisionArg = getRevisionArg(revision.revisionId, revision.changeIdPrefixLength);
      const selectedFilePaths = state.focusMode === "files" && state.expandedRowId === revision.rowId
        ? state.selectedFilePaths
        : [];

      if (selectedFilePaths.length === 0) {
        void args.runInteractiveJjCommand(quoteCommand(["split", "-r", revisionArg]));
        return;
      }

      const absoluteFilePaths = selectedFilePaths.map((filePath) => join(state.repoPath, filePath));
      store.actions.openInlineConfirmation({
        kind: "split-files",
        rowId: revision.rowId,
        message: "Split only selected files?",
        options: ["yes", "interactive", "no"],
        selectedOption: "yes",
        actualCommandByOption: {
          yes: quoteCommand(["split", "-r", revisionArg, ...absoluteFilePaths]),
          interactive: quoteCommand(["split", "-i", "-r", revisionArg, ...absoluteFilePaths]),
          no: quoteCommand(["split", "-r", revisionArg]),
        },
        previewCommandByOption: {
          yes: `split -r ${revisionArg} …files…`,
          interactive: `split -i -r ${revisionArg} …files…`,
          no: `split -r ${revisionArg}`,
        },
      });
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
    showDiff() {
      const state = store.snapshot();
      const revisionArg = getFocusedRevisionArg(state);
      if (!revisionArg) return;
      if (isFileNavigationActive(state)) {
        const file = getExpandedRevision(state)?.files[state.focusedFileIndex];
        if (!file) return;
        void args.runInteractiveJjCommand(
          quoteCommand(["diff", "-r", revisionArg, join(state.repoPath, file.path)]),
        );
      } else {
        void args.runInteractiveJjCommand(`show -r ${revisionArg}`);
      }
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
    toggleSelection() {
      store.actions.toggleRevisionSelection();
    },
    toggleFileSelection() {
      store.actions.toggleFileSelection();
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
    openRevsetInput() {
      store.actions.openRevsetInput();
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
    toggleRebaseDescendants() {
      const state = store.snapshot();
      if (state.commandDraft?.config.kind !== "rebase") {
        return;
      }

      void (async () => {
        try {
          const descendants = await client.resolveDescendants(getSelectedRevisionIds(state)[0] ?? "");
          store.actions.toggleRebaseDescendants(descendants);
        } catch (error) {
          reportError(store, error);
        }
      })();
    },
    openSearch() {
      store.actions.openSearch();
    },
    nextSearchMatch() {
      store.actions.nextSearchMatch();
    },
    prevSearchMatch() {
      store.actions.prevSearchMatch();
    },
    refreshRepository() {
      void args.refreshRepository();
    },
    absorb() {
      void args.runJjCommand("absorb");
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
    reportError(error) {
      reportError(store, error);
    },
  };
}

async function loadRevisionFiles(args: Readonly<{
  client: ControllerClient;
  store: AppStore;
  rowId: string;
  revisionId: string;
  hasConflict: boolean;
}>) {
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
  }
}

function reportError(store: AppStore, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  store.actions.pushEvent(message, "error");
}

function squashNeedsInteractiveShell(state: ReturnType<AppStore["snapshot"]>): boolean {
  const target = getFocusedRevision(state);
  if (!target || !hasUserDescription(target)) return false;
  const selectedIds = state.selectedRowIds;
  return state.revisions.some(
    (revision) => selectedIds.includes(revision.rowId) && hasUserDescription(revision),
  );
}