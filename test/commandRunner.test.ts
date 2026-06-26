import { expect, test } from "bun:test";
import { createCommandRunner, createTrackedCommand } from "../src/commands/runner.ts";
import { isHelpJjCommand } from "../src/commands/interactive-subcommands.ts";

function createActionLog() {
  const entries: string[] = [];

  return {
    entries,
    actions: {
      clearLastFailedCommand() {
        entries.push("clearLastFailedCommand");
      },
      cancelCommand() {
        entries.push("cancelCommand");
      },
      pushEvent(text: string, level: string) {
        entries.push(`pushEvent:${level}:${text}`);
      },
      pushStatusMessage(id: string, text: string, level: string) {
        entries.push(`pushStatusMessage:${id}:${level}:${text}`);
      },
      updateStatusMessage(id: string, text: string, level: string, variant?: string) {
        entries.push(
          `updateStatusMessage:${id}:${level}:${text}${variant ? `:${variant}` : ""}`,
        );
      },
      logEvent(text: string, level: string) {
        entries.push(`logEvent:${level}:${text}`);
      },
      setLoading(loading: boolean) {
        entries.push(`setLoading:${loading}`);
      },
      setLastFailedCommand(command: {
        commandText: string;
        commandArgs: readonly string[];
        interactive: boolean;
        errorText: string;
        stderr: string;
        statusMessageId?: string;
      }) {
        entries.push(
          `setLastFailedCommand:${command.interactive}:${command.commandText}:${command.stderr}:${command.statusMessageId ?? "none"}`,
        );
      },
      focusWorkingCopy() {
        entries.push("focusWorkingCopy");
      },
    },
  };
}

test("createTrackedCommand trims and tokenizes command text", () => {
  expect(createTrackedCommand("  describe -r 'abc def'  ", false)).toEqual({
    commandText: "describe -r 'abc def'",
    commandArgs: ["describe", "-r", "abc def"],
    interactive: false,
    errorText: "",
    stderr: "",
  });

  expect(createTrackedCommand("   ", true)).toBeNull();
});

test("isHelpJjCommand recognizes the help subcommand and trailing help flags", () => {
  expect(isHelpJjCommand("help")).toBeTrue();
  expect(isHelpJjCommand("help rebase")).toBeTrue();
  expect(isHelpJjCommand("rebase --help")).toBeTrue();
  expect(isHelpJjCommand("rebase -d main -h")).toBeTrue();
  expect(isHelpJjCommand("--help")).toBeTrue();

  expect(isHelpJjCommand("rebase -d main")).toBeFalse();
  expect(isHelpJjCommand("describe -m 'helps the user'")).toBeFalse();
  expect(isHelpJjCommand("status")).toBeFalse();
  expect(isHelpJjCommand("   ")).toBeFalse();
});

test("command runner marks help output as a persistent help toast on success", async () => {
  const { entries, actions } = createActionLog();

  const runner = createCommandRunner({
    actions,
    executeCommandArgs: async () => "Usage: jj rebase [OPTIONS]",
    refreshRepository: async () => true,
    createToastId: () => "toast-1",
  });

  await runner.run({
    commandText: "rebase --help",
    canExecute: true,
    successFeedback: "status-toast",
    failureFeedback: "status-toast",
  });

  expect(entries).toContain(
    "updateStatusMessage:toast-1:success:Usage: jj rebase [OPTIONS]:help",
  );
});

test("command runner does not mark shell help output as a help toast", async () => {
  const { entries, actions } = createActionLog();

  const runner = createCommandRunner({
    actions,
    executeCommandArgs: async () => {
      throw new Error("jj path should not run");
    },
    executeShellCommand: async () => "shell usage text",
    refreshRepository: async () => true,
    createToastId: () => "toast-1",
  });

  await runner.run({
    commandText: "ls --help",
    executor: "shell",
    canExecute: true,
    successFeedback: "status-toast",
    failureFeedback: "status-toast",
  });

  expect(entries).toContain("updateStatusMessage:toast-1:success:shell usage text");
  expect(entries).not.toContain(
    "updateStatusMessage:toast-1:success:shell usage text:help",
  );
});

test("command runner records history and updates a status toast on success", async () => {
  const { entries, actions } = createActionLog();
  const history: string[] = [];
  let refreshCount = 0;
  const refreshOptions: Array<{ workingCopy?: string }> = [];

  const runner = createCommandRunner({
    actions,
    executeCommandArgs: async (commandArgs) => {
      entries.push(`execute:${commandArgs.join(" ")}`);
      return "ok";
    },
    refreshRepository: async (options) => {
      refreshCount += 1;
      refreshOptions.push(options ?? {});
      entries.push("refreshRepository");
      return true;
    },
    createToastId: () => "toast-1",
  });

  await runner.run({
    commandText: "describe -r abc",
    canExecute: true,
    cancelBeforeRun: true,
    successFeedback: "status-toast",
    failureFeedback: "status-toast",
    recordHistory: async (commandText) => {
      history.push(commandText);
    },
  });

  expect(history).toEqual(["describe -r abc"]);
  expect(refreshCount).toBe(1);
  expect(refreshOptions).toEqual([{ workingCopy: "read-only" }]);
  expect(entries).toEqual([
    "cancelCommand",
    "pushStatusMessage:toast-1:info:⠋ describe -r abc",
    "execute:describe -r abc",
    "clearLastFailedCommand",
    "updateStatusMessage:toast-1:success:ok",
    "logEvent:success:ok",
    "refreshRepository",
  ]);
});

test("command runner keeps successful file track snapshot warnings retryable", async () => {
  const { entries, actions } = createActionLog();

  const runner = createCommandRunner({
    actions,
    executeCommandArgs: async () => "Warning: Refused to snapshot some files",
    refreshRepository: async () => {
      entries.push("refreshRepository");
      return true;
    },
    createToastId: () => "toast-1",
  });

  await runner.run({
    commandText: "file track ignored.log",
    canExecute: true,
    successFeedback: "status-toast",
    failureFeedback: "status-toast",
  });

  expect(entries).toContain(
    "setLastFailedCommand:false:file track ignored.log:Warning: Refused to snapshot some files:toast-1",
  );
  expect(entries).not.toContain("clearLastFailedCommand");
});

test("command runner animates the status toast while a command is running", async () => {
  const { entries, actions } = createActionLog();
  let tickSpinner = () => {};
  let clearCount = 0;
  let resolveCommand = () => {};

  const runner = createCommandRunner({
    actions,
    executeCommandArgs: () =>
      new Promise<string>((resolve) => {
        resolveCommand = () => resolve("ok");
      }),
    refreshRepository: async () => {
      entries.push("refreshRepository");
      return true;
    },
    createToastId: () => "toast-1",
    spinnerScheduler: {
      setInterval(callback) {
        tickSpinner = callback;
        return 1 as unknown as ReturnType<typeof globalThis.setInterval>;
      },
      clearInterval() {
        clearCount += 1;
      },
    },
  });

  const runPromise = runner.run({
    commandText: "describe -r abc",
    canExecute: true,
    successFeedback: "status-toast",
    failureFeedback: "status-toast",
  });

  expect(entries).toEqual([
    "pushStatusMessage:toast-1:info:⠋ describe -r abc",
  ]);

  tickSpinner();

  expect(entries).toEqual([
    "pushStatusMessage:toast-1:info:⠋ describe -r abc",
    "updateStatusMessage:toast-1:info:⠙ describe -r abc",
  ]);

  resolveCommand();
  await runPromise;

  expect(clearCount).toBe(1);
  expect(entries).toEqual([
    "pushStatusMessage:toast-1:info:⠋ describe -r abc",
    "updateStatusMessage:toast-1:info:⠙ describe -r abc",
    "clearLastFailedCommand",
    "updateStatusMessage:toast-1:success:ok",
    "logEvent:success:ok",
    "refreshRepository",
  ]);
});

test("command runner records failures and clears loading for event-driven commands", async () => {
  const { entries, actions } = createActionLog();

  const runner = createCommandRunner({
    actions,
    executeCommandArgs: async () => {
      throw Object.assign(new Error("boom"), {
        stderr: "stderr details\n",
      });
    },
    refreshRepository: async () => true,
    createToastId: () => "failure-toast",
  });

  await runner.run({
    commandText: "undo",
    canExecute: true,
    showLoading: true,
    cancelOnSuccess: true,
    successFeedback: "event",
    failureFeedback: "event",
  });

  expect(entries).toEqual([
    "setLoading:true",
    "setLastFailedCommand:false:undo:stderr details:failure-toast",
    "pushStatusMessage:failure-toast:error:boom",
    "logEvent:error:boom",
    "setLoading:false",
  ]);
});

test("command runner records the failure toast id for retryable status-toast failures", async () => {
  const { entries, actions } = createActionLog();

  const runner = createCommandRunner({
    actions,
    executeCommandArgs: async () => {
      throw Object.assign(new Error("boom"), {
        stderr: "stderr details\n",
      });
    },
    refreshRepository: async () => true,
    createToastId: () => "toast-1",
  });

  await runner.run({
    commandText: "undo",
    canExecute: true,
    successFeedback: "status-toast",
    failureFeedback: "status-toast",
  });

  expect(entries).toEqual([
    "pushStatusMessage:toast-1:info:⠋ undo",
    "setLastFailedCommand:false:undo:stderr details:toast-1",
    "updateStatusMessage:toast-1:error:boom",
    "logEvent:error:boom",
  ]);
});

test("shell command runner passes the raw command text to the shell executor", async () => {
  const { entries, actions } = createActionLog();

  const runner = createCommandRunner({
    actions,
    executeCommandArgs: async () => {
      throw new Error("jj path should not run");
    },
    executeShellCommand: async (commandText) => {
      entries.push(`shell:${commandText}`);
      return "shell ok";
    },
    refreshRepository: async () => {
      entries.push("refreshRepository");
      return true;
    },
  });

  await runner.run({
    commandText: "printf '%s' \"$PWD\" | cat",
    executor: "shell",
    canExecute: true,
    successFeedback: "event",
    failureFeedback: "event",
  });

  expect(entries).toEqual([
    "shell:printf '%s' \"$PWD\" | cat",
    "clearLastFailedCommand",
    "pushEvent:success:shell ok",
    "refreshRepository",
  ]);
});

test("interactive command runner uses the interactive executor and can focus working copy after refresh", async () => {
  const { entries, actions } = createActionLog();

  const runner = createCommandRunner({
    actions,
    executeCommandArgs: async () => {
      throw new Error("sync path should not run");
    },
    executeInteractiveCommandArgs: async (commandArgs) => {
      entries.push(`interactive:${commandArgs.join(" ")}`);
    },
    refreshRepository: async () => {
      entries.push("refreshRepository");
      return true;
    },
  });

  await runner.run({
    commandText: "commit",
    interactive: true,
    canExecute: true,
    cancelOnSuccess: true,
    successFeedback: "none",
    failureFeedback: "event",
    focusWorkingCopyAfterRefresh: true,
  });

  expect(entries).toEqual([
    "interactive:commit",
    "clearLastFailedCommand",
    "cancelCommand",
    "refreshRepository",
    "focusWorkingCopy",
  ]);
});

test("interactive shell command runner passes raw text to the interactive shell executor", async () => {
  const { entries, actions } = createActionLog();

  const runner = createCommandRunner({
    actions,
    executeCommandArgs: async () => {
      throw new Error("jj path should not run");
    },
    executeInteractiveShellCommand: async (commandText, options) => {
      entries.push(`interactive-shell:${commandText}:${options?.cwd ?? ""}`);
    },
    refreshRepository: async () => {
      entries.push("refreshRepository");
      return true;
    },
  });

  await runner.run({
    commandText: "vim 'file with spaces'",
    executor: "shell",
    interactive: true,
    cwd: "/tmp/repo",
    canExecute: true,
    cancelOnSuccess: true,
    successFeedback: "none",
    failureFeedback: "event",
  });

  expect(entries).toEqual([
    "interactive-shell:vim 'file with spaces':/tmp/repo",
    "clearLastFailedCommand",
    "cancelCommand",
    "refreshRepository",
  ]);
});
