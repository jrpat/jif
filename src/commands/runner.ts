import type { FailedCommand, StatusLevel, StatusMessageVariant } from "../domain/types.ts";
import { tokenizeCommandText } from "../jj/client.ts";
import { buildForceRetryPlan } from "../jj/forceRetry.ts";
import { isHelpJjCommand } from "./interactive-subcommands.ts";
import { SPINNER_INTERVAL_MS, formatSpinnerText } from "../ui/spinner.ts";

export type CommandFeedbackMode = "status-toast" | "event" | "none";
export type CommandExecutor = "jj" | "shell";

export type CommandRunnerActions = Readonly<{
  clearLastFailedCommand(): void;
  cancelCommand(): void;
  pushEvent(text: string, level: StatusLevel): void;
  pushStatusMessage(id: string, text: string, level: StatusLevel): void;
  updateStatusMessage(id: string, text: string, level: StatusLevel, variant?: StatusMessageVariant): void;
  logEvent(text: string, level: StatusLevel): void;
  setLoading(loading: boolean): void;
  setLastFailedCommand(command: FailedCommand): void;
  focusWorkingCopy(): void;
}>;

type RecordHistory = (commandText: string) => void | Promise<unknown>;

type SpinnerScheduler = Readonly<{
  setInterval(callback: () => void, delayMs: number): ReturnType<typeof globalThis.setInterval>;
  clearInterval(handle: ReturnType<typeof globalThis.setInterval>): void;
}>;

const defaultSpinnerScheduler: SpinnerScheduler = {
  setInterval(callback, delayMs) {
    return globalThis.setInterval(callback, delayMs);
  },
  clearInterval(handle) {
    globalThis.clearInterval(handle);
  },
};

export type CommandRunOptions = Readonly<{
  commandText: string;
  executor?: CommandExecutor;
  interactive?: boolean;
  cwd?: string;
  canExecute?: boolean;
  cancelBeforeRun?: boolean;
  cancelOnSuccess?: boolean;
  showLoading?: boolean;
  successFeedback: CommandFeedbackMode;
  failureFeedback: CommandFeedbackMode;
  recordHistory?: RecordHistory;
  focusWorkingCopyAfterRefresh?: boolean;
}>;

export function createTrackedCommand(
  commandText: string,
  interactive: boolean,
  executor: CommandExecutor = "jj",
): FailedCommand | null {
  const normalizedText = commandText.trim();
  if (normalizedText.length === 0) {
    return null;
  }

  const commandArgs = executor === "shell"
    ? [normalizedText]
    : tokenizeCommandText(normalizedText);
  if (commandArgs.length === 0) {
    return null;
  }

  return {
    commandText: normalizedText,
    commandArgs,
    interactive,
    errorText: "",
    stderr: "",
  };
}

export function createCommandRunner(args: Readonly<{
  actions: CommandRunnerActions;
  executeCommandArgs(commandArgs: readonly string[], options?: { cwd?: string }): Promise<string>;
  executeShellCommand?(commandText: string, options?: { cwd?: string }): Promise<string>;
  executeInteractiveCommandArgs?(commandArgs: readonly string[], options?: { cwd?: string }): Promise<void>;
  executeInteractiveShellCommand?(commandText: string, options?: { cwd?: string }): Promise<void>;
  refreshRepository(): Promise<boolean>;
  createToastId?(): string;
  spinnerScheduler?: SpinnerScheduler;
}>) {
  return {
    async run(options: CommandRunOptions): Promise<boolean> {
      const executor = options.executor ?? "jj";
      const command = createTrackedCommand(
        options.commandText,
        options.interactive ?? false,
        executor,
      );
      if (!command || options.canExecute === false) {
        return false;
      }

      if (options.recordHistory) {
        void Promise.resolve(options.recordHistory(command.commandText)).catch(() => {});
      }

      if (options.cancelBeforeRun) {
        args.actions.cancelCommand();
      }

      const toastId =
        options.successFeedback === "status-toast" || options.failureFeedback === "status-toast"
          ? (args.createToastId?.() ?? `cmd-${Date.now()}`)
          : null;
      const failureToastId =
        options.failureFeedback === "none"
          ? null
          : toastId ?? args.createToastId?.() ?? `cmd-${Date.now()}`;

      const stopToastSpinner = startStatusToastSpinner(
        args.actions,
        toastId,
        command.commandText,
        args.spinnerScheduler ?? defaultSpinnerScheduler,
      );

      if (options.showLoading) {
        args.actions.setLoading(true);
      }

      try {
        const resultMessage = command.interactive
          ? await executeInteractive(args, executor, command, options.cwd)
          : await executeCommand(args, executor, command, options.cwd);
        stopToastSpinner();
        recordRetryableSuccessOrClear(args.actions, command, resultMessage, toastId ?? undefined);
        if (options.cancelOnSuccess) {
          args.actions.cancelCommand();
        }
        const successVariant: StatusMessageVariant | undefined =
          executor === "jj" && isHelpJjCommand(command.commandText) ? "help" : undefined;
        publishSuccess(args.actions, toastId, resultMessage, options.successFeedback, successVariant);
        await args.refreshRepository();
        if (options.focusWorkingCopyAfterRefresh) {
          args.actions.focusWorkingCopy();
        }
        return true;
      } catch (error) {
        stopToastSpinner();
        const message = recordFailedCommand(
          args.actions,
          command,
          error,
          failureToastId ?? undefined,
        );
        publishFailure(args.actions, failureToastId, toastId, message, options.failureFeedback);
        if (options.showLoading) {
          args.actions.setLoading(false);
        }
        return false;
      }
    },
  };
}

function startStatusToastSpinner(
  actions: CommandRunnerActions,
  toastId: string | null,
  commandText: string,
  spinnerScheduler: SpinnerScheduler,
): () => void {
  if (toastId === null) {
    return () => {};
  }

  let frameIndex = 0;
  actions.pushStatusMessage(toastId, formatRunningCommandText(commandText, frameIndex), "info");
  const handle = spinnerScheduler.setInterval(() => {
    frameIndex += 1;
    actions.updateStatusMessage(toastId, formatRunningCommandText(commandText, frameIndex), "info");
  }, SPINNER_INTERVAL_MS);

  return () => {
    spinnerScheduler.clearInterval(handle);
  };
}

function formatRunningCommandText(commandText: string, frameIndex: number): string {
  return formatSpinnerText(commandText, frameIndex);
}

async function executeInteractive(
  args: Readonly<{
    executeInteractiveCommandArgs?(commandArgs: readonly string[], options?: { cwd?: string }): Promise<void>;
    executeInteractiveShellCommand?(commandText: string, options?: { cwd?: string }): Promise<void>;
  }>,
  executor: CommandExecutor,
  command: Pick<FailedCommand, "commandArgs" | "commandText">,
  cwd?: string,
): Promise<string> {
  if (executor === "shell") {
    if (!args.executeInteractiveShellCommand) {
      throw new Error("Interactive shell executor is unavailable.");
    }

    await args.executeInteractiveShellCommand(command.commandText, { cwd });
    return "";
  }

  if (!args.executeInteractiveCommandArgs) {
    throw new Error("Interactive command executor is unavailable.");
  }

  await args.executeInteractiveCommandArgs(command.commandArgs, { cwd });
  return "";
}

async function executeCommand(
  args: Readonly<{
    executeCommandArgs(commandArgs: readonly string[], options?: { cwd?: string }): Promise<string>;
    executeShellCommand?(commandText: string, options?: { cwd?: string }): Promise<string>;
  }>,
  executor: CommandExecutor,
  command: Pick<FailedCommand, "commandArgs" | "commandText">,
  cwd?: string,
): Promise<string> {
  if (executor === "shell") {
    if (!args.executeShellCommand) {
      throw new Error("Shell command executor is unavailable.");
    }

    return await args.executeShellCommand(command.commandText, { cwd });
  }

  return await args.executeCommandArgs(command.commandArgs, { cwd });
}

function recordFailedCommand(
  actions: CommandRunnerActions,
  command: FailedCommand,
  error: unknown,
  statusMessageId?: string,
): string {
  const message = error instanceof Error ? error.message : String(error);
  actions.setLastFailedCommand({
    ...command,
    errorText: message,
    stderr: error instanceof Error && "stderr" in error && typeof error.stderr === "string"
      ? error.stderr.trim()
      : message,
    statusMessageId,
  });
  return message;
}

function recordRetryableSuccessOrClear(
  actions: CommandRunnerActions,
  command: FailedCommand,
  message: string,
  statusMessageId?: string,
) {
  if (buildForceRetryPlan({ commandArgs: command.commandArgs, stderr: message }) === null) {
    actions.clearLastFailedCommand();
    return;
  }

  actions.setLastFailedCommand({
    ...command,
    errorText: message,
    stderr: message,
    statusMessageId,
  });
}

function publishSuccess(
  actions: CommandRunnerActions,
  toastId: string | null,
  message: string,
  feedback: CommandFeedbackMode,
  variant?: StatusMessageVariant,
) {
  if (feedback === "status-toast") {
    if (toastId !== null) {
      actions.updateStatusMessage(toastId, message, "success", variant);
    }
    actions.logEvent(message, "success");
    return;
  }

  if (feedback === "event") {
    actions.pushEvent(message, "success");
  }
}

function publishFailure(
  actions: CommandRunnerActions,
  failureToastId: string | null,
  spinnerToastId: string | null,
  message: string,
  feedback: CommandFeedbackMode,
) {
  if (feedback === "status-toast") {
    if (spinnerToastId !== null) {
      actions.updateStatusMessage(spinnerToastId, message, "error");
    }
    actions.logEvent(message, "error");
    return;
  }

  if (feedback === "event") {
    if (failureToastId !== null) {
      actions.pushStatusMessage(failureToastId, message, "error");
      actions.logEvent(message, "error");
    } else {
      actions.pushEvent(message, "error");
    }
  }
}
