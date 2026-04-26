import { expect, test } from "bun:test";
import { createCommandRunner, createTrackedCommand } from "../src/commands/runner.ts";

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
      updateStatusMessage(id: string, text: string, level: string) {
        entries.push(`updateStatusMessage:${id}:${level}:${text}`);
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
      }) {
        entries.push(
          `setLastFailedCommand:${command.interactive}:${command.commandText}:${command.stderr}`,
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

test("command runner records history and updates a status toast on success", async () => {
  const { entries, actions } = createActionLog();
  const history: string[] = [];
  let refreshCount = 0;

  const runner = createCommandRunner({
    actions,
    executeCommandArgs: async (commandArgs) => {
      entries.push(`execute:${commandArgs.join(" ")}`);
      return "ok";
    },
    refreshRepository: async () => {
      refreshCount += 1;
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
  expect(entries).toEqual([
    "cancelCommand",
    "pushStatusMessage:toast-1:info:describe -r abc",
    "execute:describe -r abc",
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
    "setLastFailedCommand:false:undo:stderr details",
    "pushEvent:error:boom",
    "setLoading:false",
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