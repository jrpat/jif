import type { AppState } from "../domain/types.ts";

export type CommandController = Readonly<{
  moveFocus: (delta: number) => void;
  openFocusedRevision: () => void;
  closeFocusedRevision: () => void;
  quit: () => void;
  cancelOrBlur: () => void;
  confirm: () => void;
  focusCommandBar: () => void;
  startRebase: () => void;
  toggleRebaseDescendants: () => void;
}>;

export type CommandDefinition = Readonly<{
  id: string;
  title: string;
  description: string;
  canonicalKeys: readonly string[];
  keys: readonly string[];
  when?: (state: AppState) => boolean;
  run: (controller: CommandController) => void;
  group?: "global" | "mode" | "cancel";
}>;

export const commandDefinitions: readonly CommandDefinition[] = [
  {
    id: "move-down",
    title: "Move Down",
    description: "Move through revisions or files",
    canonicalKeys: ["j"],
    keys: ["j", "down"],
    when: (state) => state.focusMode !== "command",
    run: (controller) => controller.moveFocus(1),
  },
  {
    id: "move-up",
    title: "Move Up",
    description: "Move through revisions or files",
    canonicalKeys: ["k"],
    keys: ["k", "up"],
    when: (state) => state.focusMode !== "command",
    run: (controller) => controller.moveFocus(-1),
  },
  {
    id: "expand",
    title: "Expand Revision",
    description: "Open changed files for the focused revision",
    canonicalKeys: ["l"],
    keys: ["l", "right"],
    when: (state) => state.focusMode !== "command",
    run: (controller) => controller.openFocusedRevision(),
  },
  {
    id: "collapse",
    title: "Collapse Revision",
    description: "Close the focused detail view",
    canonicalKeys: ["h"],
    keys: ["h", "left"],
    when: (state) => state.focusMode !== "command",
    run: (controller) => controller.closeFocusedRevision(),
  },
  {
    id: "command-bar",
    title: "Command Bar",
    description: "Focus the command bar",
    canonicalKeys: [":"],
    keys: [":"],
    when: (state) => state.focusMode !== "command",
    run: (controller) => controller.focusCommandBar(),
    group: "global",
  },
  {
    id: "quit",
    title: "Quit",
    description: "Exit the application",
    canonicalKeys: ["q"],
    keys: ["q"],
    when: (state) => state.focusMode !== "command",
    run: (controller) => controller.quit(),
    group: "global",
  },
  {
    id: "confirm",
    title: "Confirm",
    description: "Run the current command",
    canonicalKeys: ["enter"],
    keys: ["enter"],
    run: (controller) => controller.confirm(),
    group: "mode",
  },
  {
    id: "cancel",
    title: "Cancel",
    description: "Cancel command composition or leave input mode",
    canonicalKeys: ["escape"],
    keys: ["escape"],
    run: (controller) => controller.cancelOrBlur(),
    group: "cancel",
  },
  {
    id: "rebase",
    title: "Rebase",
    description: "Start a rebase command from the focused revision",
    canonicalKeys: ["r"],
    keys: ["r"],
    when: (state) => state.focusMode !== "command",
    run: (controller) => controller.startRebase(),
    group: "global",
  },
  {
    id: "rebase-descendants",
    title: "Toggle Descendants",
    description: "Include descendants in the rebase preview",
    canonicalKeys: ["s"],
    keys: ["s"],
    when: (state) => state.commandDraft?.kind === "rebase" && state.focusMode !== "command",
    run: (controller) => controller.toggleRebaseDescendants(),
    group: "mode",
  },
];

export function getTextCommand(
  text: string,
  state: AppState,
): CommandDefinition | null {
  return (
    commandDefinitions.find(
      (definition) =>
        definition.keys.includes(text) &&
        definition.when?.(state) !== false,
    ) ?? null
  );
}

export function getVisibleCommands(state: AppState): readonly CommandDefinition[] {
  return commandDefinitions.filter((definition) => definition.when?.(state) ?? true);
}
