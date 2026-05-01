import type { CommandController, CommandDefinition } from "../commands/definitions.ts";
import { createUserAppState } from "../config/keymap.ts";
import type { AppState } from "../domain/types.ts";
import {
  type Keymap,
  type Mode,
  defaultKeymap,
  getActiveMode,
  modeDefinitions,
  resolveCommand,
} from "../modes.ts";

export function dispatchGlobalKey(options: {
  normalizedKey: string;
  state: AppState;
  commands: readonly CommandDefinition[];
  controller: CommandController;
  keymap?: Keymap;
}): boolean {
  const { normalizedKey, state, commands, controller, keymap = defaultKeymap } = options;
  const mode = getActiveMode(state);
  const userState = createUserAppState(state);

  const commandId = resolveCommand(mode, normalizedKey, keymap);
  if (commandId) {
    const command = commands.find((c) => c.id === commandId);
    if (!command) {
      return false;
    }

    if (command.canExecute && !command.canExecute(userState)) {
      return false;
    }

    runCommand(command, controller, userState);
    return true;
  }

  if (modeDefinitions[mode].inputPassthrough && normalizedKey.length === 1) {
    return false;
  }

  const globalCommandId = keymap._global[normalizedKey];
  if (!globalCommandId) {
    return false;
  }

  const command = commands.find((c) => c.id === globalCommandId);
  if (!command) {
    return false;
  }

  if (command.canExecute && !command.canExecute(userState)) {
    return false;
  }

  runCommand(command, controller, userState);
  return true;
}

function runCommand(
  command: CommandDefinition,
  controller: CommandController,
  state: AppState,
) {
  try {
    void Promise.resolve(command.run(controller, state)).catch((error) => {
      controller.reportError(error);
    });
  } catch (error) {
    controller.reportError(error);
  }
}
