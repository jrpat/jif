import type { CommandExecutor, CommandRunOptions } from "../commands/runner.ts";
import type {
  InteractiveJjCommandOptions,
  JjCommandOptions,
  ShellCommandOptions,
} from "../commands/definitions.ts";
import { isAlwaysInteractiveJjCommand } from "../commands/interactive-subcommands.ts";
import type { RevisionSummary } from "../domain/types.ts";
import type { JjClient } from "../jj/client.ts";
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
  refreshRepository(revset?: string): Promise<boolean>;
}>) {
  const { store, client, commandRunner, persistence } = args;

  const applyRevsetQuery = async (query: string): Promise<void> => {
    const previousQuery = store.snapshot().revsetQuery;
    store.actions.setRevsetQuery(query);
    store.actions.closeRevsetInput();

    const success = await args.refreshRepository(query || undefined);
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
    void args.refreshRepository(previousQuery || undefined);
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
      const recordHistory = options?.recordHistory && workspaceRoot
        ? (value: string) => executor === "shell"
          ? persistence.recordShellHistory(workspaceRoot, value)
          : persistence.recordCommandHistory(workspaceRoot, value)
        : undefined;
      const interactive = executor === "jj" && isAlwaysInteractiveJjCommand(commandText);

      await commandRunner.run({
        commandText,
        executor,
        interactive,
        cwd: executor === "shell" ? args.getShellCwd() : undefined,
        canExecute: commandCanExecute(state),
        cancelBeforeRun: true,
        successFeedback: interactive ? "none" : "status-toast",
        failureFeedback: interactive ? "event" : "status-toast",
        recordHistory,
      });
    },

    async runJjCommand(
      commandText: string,
      options?: JjCommandOptions,
    ): Promise<boolean> {
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

    async expandElidedRevisions(elidedIndex: number): Promise<void> {
      const state = store.snapshot();
      const afterRevision = state.revisions[elidedIndex + 1];
      const beforeRevision = state.revisions[elidedIndex - 1];
      if (!afterRevision) {
        return;
      }

      try {
        const revisions = await client.loadElidedRevisions(
          afterRevision.revisionId,
          beforeRevision?.revisionId ?? null,
          20,
        );
        store.actions.expandElidedRevision(elidedIndex, revisions);
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
