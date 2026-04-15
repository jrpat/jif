import type { CommandController, CommandDefinition } from "../commands/definitions.ts";
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

  const globalCommandId = keymap._global[normalizedKey];
  if (globalCommandId) {
    const command = commands.find((c) => c.id === globalCommandId);
    if (command) {
      command.run(controller);
      return true;
    }
  }

  if (modeDefinitions[mode].inputPassthrough) {
    return false;
  }

  const commandId = resolveCommand(mode, normalizedKey, keymap);
  if (!commandId) {
    return false;
  }

  const command = commands.find((c) => c.id === commandId);
  if (!command) {
    return false;
  }

  if (command.canExecute && !command.canExecute(state)) {
    return false;
  }

  command.run(controller);
  return true;
}
