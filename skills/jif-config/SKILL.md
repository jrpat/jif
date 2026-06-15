---
name: jif-config
description: Read, write, and modify a user's jif configuration — keybindings, color scheme, log settings, command bar behavior, and notifications. Use whenever the user wants to change how jif looks or behaves. Defaults to the user-level config; pass "project" to target the workspace-local config instead.
---

# Jif Config

Help the user configure [jif](https://github.com/jrpat/jif), the terminal UI for Jujutsu. Jif is configured by a TypeScript file that exports a `Jif.Config` object. This skill knows where those files live, how the config schema is shaped, and how to edit it without disturbing the rest of the file.

## Scope: user vs. project

A jif config can live in two places:

- **User-level (default)** — applies in every workspace.
  - `$XDG_CONFIG_HOME/jif/config.ts` when `XDG_CONFIG_HOME` is set
  - otherwise `~/.config/jif/config.ts`
- **Project-level** — applies only inside one workspace. Lives at `<workspace-root>/.jj/jif/config.ts`. Resolve the workspace root with `jj workspace root`.

Default to user-level. Switch to project-level only when the user says so (e.g. "for this repo", "project-only", "just here"), or when the requested setting is obviously workspace-specific (e.g. a binding that runs a script unique to the repo).

Both files load the same `Jif.Config` shape; project-level deep-merges over user-level. Either can be created with `jif init-config` (add `-p` for project), which seeds a placeholder `config.ts` and an editor-facing `jif.d.ts` for autocomplete. If the user has not yet created the file, suggest running `jif init-config` (or `jif init-config -p` for project-level) before editing — but you can also create the file yourself if it does not exist.

## Workflow

1. **Locate the file.** Resolve the right path based on user-vs-project. Check whether it exists. If it does not, either run `jif init-config[ -p]` (preferred — it also writes `jif.d.ts`) or write a minimal `config.ts` with the `Jif.Config` shape.
2. **Read the file.** Always read it before editing so you preserve unrelated keys, comments, and existing user customizations.
3. **Consult the right reference.** Each major config area has its own reference file under `references/`:
   - [Keybindings](references/keybindings.md) — `keymap` field: rebinding existing commands, inline commands, aliases, scopes, the Extra mode, and the full list of command ids.
   - [Color scheme](references/colors.md) — `colorScheme.colors`: the semantic color slots and how to override them with hex values or palette references.
   - [Log](references/log.md) — `log` field: scroll margin, revision id width.
   - [Commands](references/commands.md) — `commands` field: short vs. long flags, command-bar layout.
   - [Notifications](references/notifications.md) — `notifications` field: history limit.
4. **Edit minimally.** Add or update only the keys the user asked about. Do not reformat or reorder unrelated sections. Preserve existing commented-out examples — they are useful scaffolding for the user later.
5. **Confirm what changed.** After editing, tell the user the exact key(s) you set and which file you wrote to. If the change requires a jif restart to take effect, say so.

## Editing rules

- The file must always end with `satisfies Jif.Config`. Do not remove that.
- Keep the `/// <reference path="./jif.d.ts" />` triple-slash directive at the top if it is already there.
- Use TypeScript syntax — `as const` is fine, comments are fine, trailing commas are fine.
- Do not import anything into the config file unless the user already imports things. Jif evaluates the file at runtime, but the goal is a small, readable config.
- When adding a new top-level section that does not exist yet (e.g. the user has no `notifications` block and you are adding `historyLimit`), insert it next to related sections rather than at the very end.

## When the user asks something ambiguous

If you genuinely cannot tell whether they want user-level or project-level, default to user-level and mention it in your reply ("I added this to your user config at `~/.config/jif/config.ts` — say the word if you'd rather scope it to this workspace.").

If they ask for something that is not configurable through the config file (e.g. "change the default git remote"), say so and point at `jj` itself.
