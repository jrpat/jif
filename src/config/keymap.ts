import { commandDefinitions, type CommandDefinition, type UserCommandController } from "../commands/definitions.ts";
import type { AppState as BaseAppState, ChangedFile, RevisionSummary } from "../domain/types.ts";
import { getRevisionArg } from "../domain/revisionIds.ts";
import { defaultKeymap, keymapScopes, type Keymap, type KeymapBinding, type KeymapScope } from "../modes.ts";
import { getFocusedFile } from "../state/store.ts";

type MutableKeymap = {
  [Scope in KeymapScope]: Record<string, KeymapBinding>;
};

export type UserAliasBinding = Readonly<{ command: string; canonical: false }>;

export type UserKeybindingCommand = Readonly<{
  id?: string;
  title: string;
  canonical?: false;
  canExecute?: (state: UserAppState) => boolean;
  run: (controller: UserCommandController, state: UserAppState) => void | Promise<void>;
  group?: CommandDefinition["group"];
}>;

export type UserKeyBinding = string | UserAliasBinding | UserKeybindingCommand | null;

export type UserKeyMap = Partial<Record<KeymapScope, Readonly<Record<string, UserKeyBinding>>>>;

export type UserAppState = BaseAppState & Readonly<{
  // Ergonomic string shortcuts, ready to drop straight into a command:
  // `rev` is the focused revision's jj argument, `file` is the focused file's path.
  // `selectedRevs` contains the selected revisions' jj arguments in selection order.
  // Empty string / empty array values make missing focus or selection easy to guard.
  // Use `focusedRevision`/`focusedFile` for the structured objects.
  rev: string;
  file: string;
  selectedRevs: readonly string[];
  focusedRevision: RevisionSummary | null;
  focusedFile: ChangedFile | null;
}>;

export type ResolvedConfiguredKeymap = Readonly<{
  keymap: Keymap;
  commands: readonly CommandDefinition[];
}>;

const USER_COMMAND_ID_PREFIX = "user:";

export function createUserAppState(state: BaseAppState): UserAppState {
  return new Proxy(state as UserAppState, {
    get(target, property, receiver) {
      if (property === "focusedRevision") {
        return target.revisions[target.focusedRevisionIndex] ?? null;
      }
      if (property === "rev") {
        const rev = target.revisions[target.focusedRevisionIndex];
        return rev ? getRevisionArg(rev.revisionId, rev.changeIdPrefixLength) : "";
      }
      if (property === "selectedRevs") {
        return target.selectedRowIds
          .map((rowId) => target.revisions.find((revision) => revision.rowId === rowId))
          .filter((revision): revision is RevisionSummary => revision !== undefined)
          .map((revision) => getRevisionArg(revision.revisionId, revision.changeIdPrefixLength));
      }
      if (property === "focusedFile") {
        return getFocusedFile(target);
      }
      if (property === "file") {
        return getFocusedFile(target)?.path ?? "";
      }

      return Reflect.get(target, property, receiver);
    },
  });
}

export function resolveConfiguredKeymap(userKeymap?: UserKeyMap): ResolvedConfiguredKeymap {
  const keymap = cloneKeymap(defaultKeymap);
  const commandsById = new Map(commandDefinitions.map((command) => [command.id, command] as const));

  for (const scope of keymapScopes) {
    const bindings = userKeymap?.[scope];
    if (!bindings) {
      continue;
    }

    for (const [key, binding] of Object.entries(bindings)) {
      if (binding === null) {
        keymap[scope][key] = null;
        continue;
      }

      if (typeof binding === "string") {
        keymap[scope][key] = binding;
        continue;
      }

      if (isAliasBinding(binding)) {
        keymap[scope][key] = { command: binding.command, canonical: false };
        continue;
      }

      const id = toUserCommandId(binding.id ?? `${scope}:${key}`);
      commandsById.set(id, {
        id,
        title: binding.title,
        canExecute: binding.canExecute
          ? (state) => binding.canExecute!(createUserAppState(state))
          : undefined,
        run: (controller, state) => binding.run(controller, createUserAppState(state)),
        group: binding.group,
      });
      keymap[scope][key] = binding.canonical === false
        ? { command: id, canonical: false }
        : id;
    }
  }

  return {
    keymap: keymap as Keymap,
    commands: [...commandsById.values()],
  };
}

function isAliasBinding(
  binding: UserAliasBinding | UserKeybindingCommand,
): binding is UserAliasBinding {
  return "command" in binding && !("run" in binding);
}

function cloneKeymap(source: Keymap): MutableKeymap {
  return Object.fromEntries(
    Object.entries(source).map(([scope, bindings]) => [scope, { ...bindings }]),
  ) as MutableKeymap;
}

function toUserCommandId(value: string): string {
  return value.startsWith(USER_COMMAND_ID_PREFIX)
    ? value
    : `${USER_COMMAND_ID_PREFIX}${value}`;
}

