import type { CommandExecutor, CommandRunOptions } from "../commands/runner.ts";
import type {
  InteractiveShellCommandOptions,
  InteractiveJjCommandOptions,
  JjCommandOptions,
  ShellCommandOptions,
} from "../commands/definitions.ts";
import { isAlwaysInteractiveJjCommand } from "../commands/interactive-subcommands.ts";
import { resolveElidedExpansion } from "../domain/elidedRevisions.ts";
import type { JjClient, WorkingCopyRefreshOptions } from "../jj/client.ts";
import type { PersistenceService } from "../persistence/service.ts";
import { isFilesOnlyRevset } from "../revset/files.ts";
import type { AppStore } from "../state/appStore.ts";
import { commandCanExecute, getDisplayedCommandText } from "../state/store.ts";

type CommandRunnerLike = Readonly<{
  run(options: CommandRunOptions): Promise<boolean>;
}>;

type RuntimeClient = Pick<JjClient, "loadDefaultRevset" | "loadElidedRevisions">;

type RuntimePersistence = Pick<
  PersistenceService,
  | "loadRevsetHistory"
  | "recordCommandHistory"
  | "recordShellHistory"
  | "recordRevsetHistory"
  | "saveActiveRevset"
>;

export function createJifRuntime(args: Readonly<{
  store: AppStore;
  client: RuntimeClient;
  commandRunner: CommandRunnerLike;
  persistence: RuntimePersistence;
  getWorkspaceRoot(): string | null;
  getShellCwd(): string;
  refreshRepository(revset?: string, options?: WorkingCopyRefreshOptions): Promise<boolean>;
}>) {
  const { store, client, commandRunner, persistence } = args;

  const applyRevsetQuery = async (query: string): Promise<void> => {
    const previousQuery = store.snapshot().revsetQuery;
    const previousRevealedCommitIds = store.snapshot().revealedCommitIds;
    store.actions.setRevsetQuery(query);
    store.actions.closeRevsetInput();

    const success = await args.refreshRepository(query || undefined, { workingCopy: "read-only" });
    if (success) {
      const workspaceRoot = args.getWorkspaceRoot();
      if (workspaceRoot) {
        // Record the revset we switched *away from* as the most recent entry
        // so the previous revset is one keystroke away for quick toggling.
        if (previousQuery.trim().length > 0 && previousQuery !== query) {
          await persistence.recordRevsetHistory(workspaceRoot, previousQuery);
        }
        await persistence.saveActiveRevset(workspaceRoot, query);
      }
      return;
    }

    store.actions.setRevsetQuery(previousQuery);
    // Rolling back a failed apply keeps the effective revset unchanged, so
    // restore the revealed expansions the query switch cleared.
    store.actions.revealRevisions(previousRevealedCommitIds);
    void args.refreshRepository(previousQuery || undefined, { workingCopy: "read-only" });
  };

  return {
    async executeCurrentCommand(
      commandOverride?: string,
      options?: { recordHistory?: boolean },
    ): Promise<void> {
      const state = store.snapshot();
      const commandText = (commandOverride ?? getDisplayedCommandText(state)).trim();
      const workspaceRoot = args.getWorkspaceRoot();
      const executor: CommandExecutor = state.commandBar.kind === "shell" ? "shell" : "jj";
      const submissionOptions = executor === "jj"
        ? state.commandBar.submissionOptions
        : undefined;
      const recordHistory = options?.recordHistory && workspaceRoot
        ? (value: string) => executor === "shell"
          ? persistence.recordShellHistory(workspaceRoot, value)
          : persistence.recordCommandHistory(workspaceRoot, value)
        : undefined;
      const interactive = executor === "jj" &&
        (submissionOptions?.interactive ?? isAlwaysInteractiveJjCommand(commandText));

      await commandRunner.run({
        commandText,
        executor,
        interactive,
        cwd: executor === "shell" ? args.getShellCwd() : submissionOptions?.cwd,
        canExecute: commandCanExecute(state),
        cancelBeforeRun: true,
        successFeedback: interactive ? "none" : "status-toast",
        failureFeedback: interactive ? "event" : "status-toast",
        focusWorkingCopyAfterRefresh: submissionOptions?.focusWorkingCopyAfterRefresh,
        recordHistory,
      });
    },

    async runJjCommand(
      commandText: string,
      options?: JjCommandOptions,
    ): Promise<boolean> {
      if (store.snapshot().dryRun) {
        store.actions.previewJjCommand(commandText, {
          interactive: false,
          cwd: options?.cwd,
          focusWorkingCopyAfterRefresh: options?.focusWorkingCopyAfterRefresh,
        });
        return false;
      }

      return await commandRunner.run({
        commandText,
        canExecute: true,
        cancelOnSuccess: true,
        successFeedback: "status-toast",
        failureFeedback: "status-toast",
        focusWorkingCopyAfterRefresh: options?.focusWorkingCopyAfterRefresh,
        cwd: options?.cwd,
      });
    },

    async runShellCommand(
      commandText: string,
      options?: ShellCommandOptions,
    ): Promise<void> {
      await commandRunner.run({
        commandText,
        executor: "shell",
        canExecute: true,
        cancelOnSuccess: true,
        successFeedback: "status-toast",
        failureFeedback: "status-toast",
        focusWorkingCopyAfterRefresh: options?.focusWorkingCopyAfterRefresh,
        cwd: options?.cwd,
      });
    },

    async runInteractiveJjCommand(
      commandText: string,
      options?: InteractiveJjCommandOptions,
    ): Promise<boolean> {
      const cwd = options?.cwd ?? args.getWorkspaceRoot();
      if (!cwd) {
        return false;
      }

      if (store.snapshot().dryRun) {
        store.actions.previewJjCommand(commandText, {
          interactive: true,
          cwd,
        });
        return false;
      }

      return await commandRunner.run({
        commandText,
        interactive: true,
        canExecute: true,
        cancelOnSuccess: true,
        successFeedback: "none",
        failureFeedback: "event",
        cwd,
      });
    },

    async runInteractiveShellCommand(
      commandText: string,
      options?: InteractiveShellCommandOptions,
    ): Promise<boolean> {
      return await commandRunner.run({
        commandText,
        executor: "shell",
        interactive: true,
        canExecute: true,
        cancelOnSuccess: true,
        successFeedback: "none",
        failureFeedback: "event",
        cwd: options?.cwd ?? args.getShellCwd(),
      });
    },

    async expandElidedRevisions(elidedIndex: number): Promise<void> {
      const expansion = resolveElidedExpansion(store.snapshot().revisions, elidedIndex);
      if (!expansion) {
        return;
      }

      try {
        const revisions = await client.loadElidedRevisions(
          expansion.descendantArg,
          expansion.excludeArgs,
          20,
        );
        const commitIds = revisions
          .filter((revision) => revision.marker !== "elided")
          .map((revision) => revision.commitId);
        if (commitIds.length === 0) {
          store.actions.pushEvent("No hidden revisions to expand", "info");
          return;
        }

        // Revealing goes through a full refresh instead of splicing rows in:
        // the refresher unions revealed commits into the log revset, so jj
        // renders real graph rows, recomputes the elided markers, and the
        // expansion survives later refreshes until the revset changes.
        store.actions.revealRevisions(commitIds);
        await args.refreshRepository(undefined, { workingCopy: "read-only" });

        const focusIndex = store.snapshot().revisions
          .findIndex((revision) => revision.commitId === commitIds[0]);
        if (focusIndex >= 0) {
          store.actions.focusRevisionAt(focusIndex);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        store.actions.pushEvent(message, "error");
      }
    },

    applyRevsetQuery,

    async restoreLogRevsetFromFileFilter(): Promise<void> {
      if (!isFilesOnlyRevset(store.snapshot().revsetQuery)) {
        return;
      }

      const workspaceRoot = args.getWorkspaceRoot();
      const history = workspaceRoot
        ? await persistence.loadRevsetHistory(workspaceRoot)
        : [];
      const previousLogRevset = history.find((entry) => !isFilesOnlyRevset(entry));
      const fallbackRevset = previousLogRevset ?? await client.loadDefaultRevset();
      await applyRevsetQuery(fallbackRevset);
    },
  };
}
