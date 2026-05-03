import { commandDefinitions, type CommandDefinition, type UserCommandController } from "../commands/definitions.ts";
import type { AppState as BaseAppState } from "../domain/types.ts";
import { defaultKeymap, type Keymap, type Mode } from "../modes.ts";

type KeymapScope = "_global" | Mode;
type MutableKeymap = {
  [Scope in KeymapScope]: Record<string, string>;
};

export type UserKeybindingCommand = Readonly<{
  id?: string;
  title: string;
  description: string;
  canExecute?: (state: UserAppState) => boolean;
  run: (controller: UserCommandController, state: UserAppState) => void | Promise<void>;
  group?: CommandDefinition["group"];
}>;

export type UserKeyBinding = string | UserKeybindingCommand;

export type UserKeyMap = Partial<Record<KeymapScope, Readonly<Record<string, UserKeyBinding>>>>;

export type UserAppState = BaseAppState & Readonly<{
  rev: BaseAppState["revisions"][number] | null;
}>;

export type ResolvedConfiguredKeymap = Readonly<{
  keymap: Keymap;
  commands: readonly CommandDefinition[];
}>;

const USER_COMMAND_ID_PREFIX = "user:";

export function createUserAppState(state: BaseAppState): UserAppState {
  return new Proxy(state as UserAppState, {
    get(target, property, receiver) {
      if (property === "rev") {
        return target.revisions[target.focusedRevisionIndex] ?? null;
      }

      return Reflect.get(target, property, receiver);
    },
  });
}

export function resolveConfiguredKeymap(userKeymap?: UserKeyMap): ResolvedConfiguredKeymap {
  const keymap = cloneKeymap(defaultKeymap);
  const commandsById = new Map(commandDefinitions.map((command) => [command.id, command] as const));

  for (const scope of KEYMAP_SCOPES) {
    const bindings = userKeymap?.[scope];
    if (!bindings) {
      continue;
    }

    for (const [key, binding] of Object.entries(bindings)) {
      if (typeof binding === "string") {
        keymap[scope][key] = binding;
        continue;
      }

      const id = toUserCommandId(binding.id ?? `${scope}:${key}`);
      const existing = commandsById.get(id);
      const canonicalKeys = mergeCanonicalKeys(existing?.canonicalKeys, key);

      commandsById.set(id, {
        id,
        title: binding.title,
        description: binding.description,
        canonicalKeys,
        canExecute: binding.canExecute
          ? (state) => binding.canExecute!(createUserAppState(state))
          : undefined,
        run: (controller, state) => binding.run(controller, createUserAppState(state)),
        group: binding.group,
      });
      keymap[scope][key] = id;
    }
  }

  return {
    keymap: keymap as Keymap,
    commands: [...commandsById.values()],
  };
}

function cloneKeymap(source: Keymap): MutableKeymap {
  return {
    _global: { ...source._global },
    normal: { ...source.normal },
    files: { ...source.files },
    "op-log": { ...source["op-log"] },
    "inline-confirmation": { ...source["inline-confirmation"] },
    rebase: { ...source.rebase },
    squash: { ...source.squash },
    command: { ...source.command },
    revset: { ...source.revset },
    search: { ...source.search },
    "search-results": { ...source["search-results"] },
    "diff-viewer": { ...source["diff-viewer"] },
    notifications: { ...source.notifications },
  };
}

function toUserCommandId(value: string): string {
  return value.startsWith(USER_COMMAND_ID_PREFIX)
    ? value
    : `${USER_COMMAND_ID_PREFIX}${value}`;
}

function mergeCanonicalKeys(existing: readonly string[] | undefined, key: string): readonly string[] {
  if (!existing || existing.length === 0) {
    return [key];
  }

  return existing.includes(key) ? existing : [...existing, key];
}

const KEYMAP_SCOPES: readonly KeymapScope[] = [
  "_global",
  "normal",
  "files",
  "op-log",
  "inline-confirmation",
  "rebase",
  "squash",
  "command",
  "revset",
  "search",
  "search-results",
  "diff-viewer",
  "notifications",
];