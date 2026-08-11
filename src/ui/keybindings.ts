import type { CommandController, CommandDefinition } from "../commands/definitions.ts";
import { createUserAppState } from "../config/keymap.ts";
import type { AppState } from "../domain/types.ts";
import {
  type Keymap,
  type Mode,
  bindingCommand,
  defaultKeymap,
  getActiveMode,
  isKeyExplicitlyUnbound,
  modeDefinitions,
  resolveCommand,
  revisionLogNavCommandIds,
} from "../modes.ts";

export type CommandDispatchDetails = Readonly<{
  commandId: string;
  mode: Mode;
}>;

// Revision navigation only moves focus, so it keeps an expanded shortcut panel
// open instead of dismissing it mid-traversal.
export type ShortcutFilterKeyAction =
  | "inactive"
  | "activate"
  | "cancel"
  | "input";

const SHORTCUT_CONTEXT_PRESERVING_COMMAND_IDS = new Set([
  "cancel",
  "enter-preview-mode",
  // Preview mode binds escape directly, so leaving it must unwind exactly as
  // the global cancel it shadows did — without also closing a panel the user
  // opened for the log underneath.
  "exit-preview-mode",
  "reload-config",
  "shortcut-panel",
  ...revisionLogNavCommandIds,
  "filter-shortcuts",
]);

export function getShortcutFilterKeyAction(
  normalizedKey: string,
  state: AppState,
  keymap: Keymap = defaultKeymap,
  shortcutPanelVisible = state.shortcutPanelExpanded,
): ShortcutFilterKeyAction {
  const filterEditing = state.focusMode === "shortcut-filter";
  if (filterEditing && normalizedKey === "?") {
    return "input";
  }

  if (shortcutPanelVisible && normalizedKey === "?") {
    return "activate";
  }

  if (
    shortcutPanelVisible &&
    (normalizedKey === "escape" || normalizedKey === "ctrl-c")
  ) {
    return "cancel";
  }

  const filterActive = filterEditing || state.shortcutFilterQuery !== "";
  if (!filterActive) {
    return "inactive";
  }

  const mode = getActiveMode(state);
  const modeCommandId = resolveCommand(mode, normalizedKey, keymap);
  const globalBinding = keymap._global[normalizedKey];
  const commandId = modeCommandId ??
    (!isKeyExplicitlyUnbound(mode, normalizedKey, keymap) && globalBinding != null
      ? bindingCommand(globalBinding)
      : null);

  if (commandId === "filter-shortcuts") {
    return "activate";
  }

  if (normalizedKey === "escape" || normalizedKey === "ctrl-c") {
    return "cancel";
  }

  return filterEditing ? "input" : "inactive";
}

export function shouldDismissShortcutContextBeforeCommand(
  details: CommandDispatchDetails,
): boolean {
  return !SHORTCUT_CONTEXT_PRESERVING_COMMAND_IDS.has(details.commandId);
}

export function dispatchGlobalKey(options: {
  normalizedKey: string;
  state: AppState;
  commands: readonly CommandDefinition[];
  controller: CommandController;
  keymap?: Keymap;
  onBeforeCommandRun?: (details: CommandDispatchDetails) => void;
}): boolean {
  const { normalizedKey, state, commands, controller, keymap = defaultKeymap, onBeforeCommandRun } = options;
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

    onBeforeCommandRun?.({ commandId, mode });
    runCommand(command, controller, userState);
    return true;
  }

  if (isKeyExplicitlyUnbound(mode, normalizedKey, keymap)) {
    return false;
  }

  if (modeDefinitions[mode].inputPassthrough && normalizedKey.length === 1) {
    return false;
  }

  const globalBinding = keymap._global[normalizedKey];
  if (!globalBinding) {
    return false;
  }
  const rawGlobalCommandId = bindingCommand(globalBinding);
  const globalCommandId = mode !== "revision-log" && rawGlobalCommandId === "quit" ? "cancel" : rawGlobalCommandId;

  const command = commands.find((c) => c.id === globalCommandId);
  if (!command) {
    return false;
  }

  if (command.canExecute && !command.canExecute(userState)) {
    return false;
  }

  onBeforeCommandRun?.({ commandId: globalCommandId, mode });
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
