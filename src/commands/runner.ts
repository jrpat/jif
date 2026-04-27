import type { FailedCommand, StatusLevel } from "../domain/types.ts";
import { tokenizeCommandText } from "../jj/client.ts";

export type CommandFeedbackMode = "status-toast" | "event" | "none";

const COMMAND_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const COMMAND_SPINNER_INTERVAL_MS = 80;

export type CommandRunnerActions = Readonly<{
  clearLastFailedCommand(): void;
  cancelCommand(): void;
  pushEvent(text: string, level: StatusLevel): void;
  pushStatusMessage(id: string, text: string, level: StatusLevel): void;
  updateStatusMessage(id: string, text: string, level: StatusLevel): void;
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
  interactive?: boolean;
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
): FailedCommand | null {
  const normalizedText = commandText.trim();
  const commandArgs = tokenizeCommandText(normalizedText);
  if (normalizedText.length === 0 || commandArgs.length === 0) {
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
  executeCommandArgs(commandArgs: readonly string[]): Promise<string>;
  executeInteractiveCommandArgs?(commandArgs: readonly string[]): Promise<void>;
  refreshRepository(): Promise<boolean>;
  createToastId?(): string;
  spinnerScheduler?: SpinnerScheduler;
}>) {
  return {
    async run(options: CommandRunOptions): Promise<boolean> {
      const command = createTrackedCommand(options.commandText, options.interactive ?? false);
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
          ? await executeInteractive(args, command.commandArgs)
          : await args.executeCommandArgs(command.commandArgs);
        stopToastSpinner();
        args.actions.clearLastFailedCommand();
        if (options.cancelOnSuccess) {
          args.actions.cancelCommand();
        }
        publishSuccess(args.actions, toastId, resultMessage, options.successFeedback);
        await args.refreshRepository();
        if (options.focusWorkingCopyAfterRefresh) {
          args.actions.focusWorkingCopy();
        }
        return true;
      } catch (error) {
        stopToastSpinner();
        const message = recordFailedCommand(args.actions, command, error);
        publishFailure(args.actions, toastId, message, options.failureFeedback);
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
    frameIndex = (frameIndex + 1) % COMMAND_SPINNER_FRAMES.length;
    actions.updateStatusMessage(toastId, formatRunningCommandText(commandText, frameIndex), "info");
  }, COMMAND_SPINNER_INTERVAL_MS);

  return () => {
    spinnerScheduler.clearInterval(handle);
  };
}

function formatRunningCommandText(commandText: string, frameIndex: number): string {
  return `${COMMAND_SPINNER_FRAMES[frameIndex]} ${commandText}`;
}

async function executeInteractive(
  args: Readonly<{
    executeInteractiveCommandArgs?(commandArgs: readonly string[]): Promise<void>;
  }>,
  commandArgs: readonly string[],
): Promise<string> {
  if (!args.executeInteractiveCommandArgs) {
    throw new Error("Interactive command executor is unavailable.");
  }

  await args.executeInteractiveCommandArgs(commandArgs);
  return "";
}

function recordFailedCommand(
  actions: CommandRunnerActions,
  command: FailedCommand,
  error: unknown,
): string {
  const message = error instanceof Error ? error.message : String(error);
  actions.setLastFailedCommand({
    ...command,
    errorText: message,
    stderr: error instanceof Error && "stderr" in error && typeof error.stderr === "string"
      ? error.stderr.trim()
      : message,
  });
  return message;
}

function publishSuccess(
  actions: CommandRunnerActions,
  toastId: string | null,
  message: string,
  feedback: CommandFeedbackMode,
) {
  if (feedback === "status-toast") {
    if (toastId !== null) {
      actions.updateStatusMessage(toastId, message, "success");
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
  toastId: string | null,
  message: string,
  feedback: CommandFeedbackMode,
) {
  if (feedback === "status-toast") {
    if (toastId !== null) {
      actions.updateStatusMessage(toastId, message, "error");
    }
    actions.logEvent(message, "error");
    return;
  }

  if (feedback === "event") {
    actions.pushEvent(message, "error");
  }
}