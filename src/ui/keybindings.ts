import type { CommandController, CommandDefinition } from "../commands/definitions.ts";
import type { AppState } from "../domain/types.ts";

export function dispatchGlobalKey(options: {
  normalizedKey: string;
  state: AppState;
  visibleCommands: readonly CommandDefinition[];
  controller: CommandController;
}): boolean {
  const { normalizedKey, state, visibleCommands, controller } = options;

  if (normalizedKey === "escape") {
    controller.cancelOrBlur();
    return true;
  }

  if (state.focusMode === "command" || state.focusMode === "revset") {
    return false;
  }

  if (normalizedKey === "enter") {
    controller.confirm();
    return true;
  }

  const command = visibleCommands.find((definition) => definition.keys.includes(normalizedKey));
  if (!command) {
    return false;
  }

  command.run(controller);
  return true;
}
