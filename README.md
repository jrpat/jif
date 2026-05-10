# jif

`jif` is a Jujutsu porcelain — highly-tuned out of the box, but *deeply* configurable. Built to make the underlying model more accessible, not to hide it.

## Jif's Worldview

jif is meant to be lived in, kept open, reached for constantly – your home for Jujutsu in the terminal. It comes out-of-the box with thoughtful ergonomics, consistent shortcuts, creature comforts, and fit and finish you feel immediately.

But it's also *yours*, designed from the start to be molded to how you work. The configuration system is TypeScript executed at runtime, with all the app state and internal commands exposed. Nothing is hidden or artificially restricted. The defaults aren't a ceiling.

## Command Composition

Every operation in jif — `rebase`, `squash`, `split`, `new`, `commit`, and the rest — composes a `jj` command. The command bar shows that command being assembled as you press keys, color-coded to match the TUI: the focused revision in blue (its highlight color), selected revisions and files in green (the selection accent), etc…

You get the ergonomics of a TUI porcelain without the CLI being hidden from you, and over time the visible command bar teaches you the underlying `jj` commands.

Press `-` while composing to flip between short and long flag names. Press `:` at any time to drop into the command bar and type a `jj` subcommand directly — if a command is already being composed, `:` preserves it and lets you edit it as text before running.

## Prerequisites

`jif` shells out to the real `jj` binary, so `jj` must be installed and available on `PATH`.

## Install

> TODO

## Run

```bash
jif
```

This launches the TUI against the current working directory.

## Keybindings

Default keybindings, grouped by mode. Each mode is annotated below with whether it inherits Normal-mode bindings on top of its own. Global bindings are available in every mode and may be overridden by a mode-specific binding for the same key.

### Global

Available in every mode (mode-specific bindings can override these).

| Key | Command | Description |
|-----|---------|-------------|
| `ctrl-r` | refresh-repository | Refresh the revision log |
| `ctrl-z` | suspend | Suspend the application and return to the shell |
| `escape` | cancel | Cancel command composition or leave input mode |
| `~` | open-notifications | Open the notifications history panel |

### Normal

Viewing and navigating the revision log.

#### Navigation

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` | move-down | Move through revisions or files |
| `k` / `↑` | move-up | Move through revisions or files |
| `J` | move-parent | Follow the graph to the nearest visible parent, skipping branches |
| `K` | move-child | Follow the graph to the nearest visible child, skipping branches |
| `@` | jump-to-working-copy | Jump to the working-copy revision |
| `G` | jump-to-bottom | Jump to the last revision in the log |

#### View

| Key | Command | Description |
|-----|---------|-------------|
| `h` / `←` | collapse | Close the focused detail view |
| `l` / `→` | expand | Open changed files for the focused revision |
| `L` | edit-revset | Change which revisions are displayed |
| `/` | search | Incremental search through the revision log |
| `_` | cycle-layout | Rotate expanded, condensed, and super-condensed layouts |

#### Revision operations

| Key | Command | Description |
|-----|---------|-------------|
| `a` | abandon | Abandon the focused revision |
| `A` | absorb | Run `jj absorb` |
| `c` | commit | Commit the working-copy revision (`@`) |
| `d` | show-diff | Show diff for the focused revision or file |
| `D` | describe | Edit description of the focused revision |
| `e` | edit-revision | Edit the focused revision |
| `n` | new-revision | Create a new revision from the focused revision |
| `r` | rebase | Start a rebase from the focused revision |
| `s` | split | Split the focused revision, or use the current file selection |
| `S` | squash | Squash the focused revision into another |
| `u` | undo | Undo the last operation |
| `U` | redo | Redo the last undone operation |
| `space` | toggle-revision-selection | Add or remove the focused revision from the selection |

#### Miscellaneous

| Key | Command | Description |
|-----|---------|-------------|
| `:` | command-bar | Run a jj subcommand |
| `>` | shell-command-bar | Run a shell command |
| `o` / `O` | open-operation-log | Open the repository operation log |
| `q` | quit | Exit the application |
| `?` | shortcut-panel | Expand or collapse the shortcut panel |
| `!` | force-last-command | Retry the last failed command with the override flag `jj` is asking for:<br>• `--ignore-immutable` — when the command refused because the target is immutable<br>• `--allow-backwards` — when a bookmark move was rejected as backwards/sideways |
| `-` | toggle-flags | Toggle the command bar between short and long flag names while composing a command |

### Files

Active when a revision is expanded and a file is focused. Inherits Normal.

| Key | Command | Description |
|-----|---------|-------------|
| `r` | restore | Restore selected files to their state before this change |
| `s` | split | Split using the current file selection |
| `space` | toggle-file-selection | Add or remove the focused file from the selection |

### Rebase

Active while previewing a rebase. Inherits Normal.

| Key | Command | Description |
|-----|---------|-------------|
| `s` | rebase-descendants | Toggle whether descendants are included in the rebase |

### Bookmark

Pressing `b` from Normal mode enters Bookmark mode and waits for the next keystroke. Each sub-key opens a `jj bookmark` flow scoped to the focused revision. Press Escape to leave Bookmark mode without doing anything.

| Key | Command | Description |
|-----|---------|-------------|
| `c` | bookmark-create | Open the command bar with `b create  -r <focused>` and the cursor positioned to type a new bookmark name |
| `m` | bookmark-move-from | Begin a bookmark move from the focused revision; navigate to pick the destination, then `enter` to run `b move -f <from> -t <to>` |
| `M` | bookmark-move-to | Open the command bar with `b move  -t <focused>` and bookmark-name autocomplete sorted by graph distance to the focused revision |
| `d` | bookmark-delete | Open the command bar with `b delete ` and bookmark-name autocomplete |
| `f` | bookmark-forget | Open the command bar with `b forget ` and bookmark-name autocomplete |
| `s` | bookmark-set | Open the command bar with `b set  -r <focused>` and bookmark-name autocomplete |
| `t` | bookmark-track | Open the command bar with `b track ` and bookmark-name autocomplete |
| `u` | bookmark-untrack | Open the command bar with `b untrack ` and bookmark-name autocomplete |

Bookmark autocomplete is sorted with the closest ancestor bookmark first (visually at the bottom of the suggestion list), then more distant ancestors, then descendants by ascending distance, then any unrelated bookmarks. For Move-to, bookmarks already pointing at the focused revision are excluded; for the other prompts they appear at the highest priority (closest to the cursor).

### Search Results

Active after running a search in a searchable view. Search updates incrementally as you type and highlights visible matching text with inverse video. The revision log and operation log are searchable; `n` and `p` move between matching revisions or operation log entries until the search is cleared. Pressing Enter keeps the focused match; pressing Escape cancels the search and restores the focus from before search started.

| Key | Command | Description |
|-----|---------|-------------|
| `n` | search-next | Jump to the next search match |
| `p` | search-prev | Jump to the previous search match |

### Operation Log

Active while the operation log panel is open. Does not inherit Normal.

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` | move-down | Focus the next operation |
| `k` / `↑` | move-up | Focus the previous operation |
| `G` | jump-to-bottom | Jump to the last operation in the log |
| `r` | restore-operation | Restore the focused operation |
| `R` | revert-operation | Revert the focused operation |
| `d` | show-operation-diff | Show repository changes for the focused operation |
| `/` | search | Incremental search through the operation log |
| `?` | shortcut-panel | Expand or collapse the shortcut panel |

### Notifications

Active while the notifications history panel is open. Does not inherit Normal.

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` | move-down | Focus the next notification |
| `k` / `↑` | move-up | Focus the previous notification |
| `G` | jump-to-bottom | Jump to the last notification |
| `l` / `→` | expand-notification | Show all lines of the focused notification |
| `h` / `←` | collapse-notification | Truncate the focused notification |
| `~` | cancel | Close the notifications panel |
| `?` | shortcut-panel | Expand or collapse the shortcut panel |

### Diff Viewer

Active while the full-screen diff viewer is open. Does not inherit Normal.

| Key | Command | Description |
|-----|---------|-------------|
| `j` | scroll-down | Scroll down one line |
| `k` | scroll-up | Scroll up one line |
| `h` | scroll-left | Scroll left one column |
| `l` | scroll-right | Scroll right one column |
| `J` | scroll-down-large | Scroll down ten lines |
| `K` | scroll-up-large | Scroll up ten lines |
| `H` | scroll-left-large | Scroll left ten columns |
| `L` | scroll-right-large | Scroll right ten columns |

### Inline Confirmation

Active in inline confirmation prompts.

| Key | Command | Description |
|-----|---------|-------------|
| `enter` | confirm | Confirm the selected option |
| `h` / `←` | inline-confirmation-prev-option | Select the previous option |
| `l` / `→` | inline-confirmation-next-option | Select the next option |

### Text Input Modes

Active in the command bar (`:`), revset prompt (`L`), and search prompt (`/`). Keystrokes pass through as text input; the bindings below navigate history and suggestion lists.

| Key | Description |
|-----|-------------|
| `ctrl-j` / `ctrl-n` / `↓` | Move to the next history entry or suggestion |
| `ctrl-k` / `ctrl-p` / `↑` | Move to the previous history entry or suggestion |
| `enter` | Submit the current input (run the command, apply the revset, finalize the search) |
| `tab` / `shift-tab` | Move to the next / previous suggestion |

## Shell commands

Shell commands invoked via `>` (or `cmd.sh()` from a custom keybinding) run in your login shell (`$SHELL -lc`) with the cwd jif was launched from. Login shells source `.zprofile` / `.bash_profile` / `.profile`, but **not** `.zshrc` / `.bashrc`, so aliases and functions defined only in your interactive rc files will not be available.

If you want an alias to work from `>`, define it somewhere a non-interactive shell will see it — for zsh, that's `.zshenv` (sourced for every invocation) or `.zprofile` (sourced for login shells); for bash, `.bash_profile` or `.profile`.

## Configuration

Run `jif init-config` to create a starter user config. The command creates:

- `config.ts` with a placeholder `Jif.Config` shape and commented examples
- `jif.d.ts` with editor-facing types for autocomplete and inline docs

If a config file already exists, `jif init-config` leaves it alone and only fills in missing support files.

To seed a project-local config instead, pass `--project` (or `-p`):

```bash
jif init-config -p          # uses the workspace containing the cwd
jif init-config -p path/to  # resolves the workspace root from a subdirectory
```

This writes `config.ts` and `jif.d.ts` into the workspace's `.jj/jif/` directory (which jif also uses to track per-workspace history). The path argument may be any directory inside a JJ workspace; jif resolves it up to the workspace root (via `jj workspace root`) and seeds the config there. Without `-p`, `init-config` seeds the user-level config described above.

### Config location

User config lives in the jif config directory:

- `$XDG_CONFIG_HOME/jif` when `XDG_CONFIG_HOME` is set
- otherwise `~/.config/jif`

jif loads the first existing file in this order from that directory:

- `config.ts`
- `config.js`
- `jif.config.ts`
- `jif.config.js`

### Project-local config

If the workspace's `.jj/jif/` directory contains a `config.ts` (or `config.js`), jif loads it automatically as a layer just above your user config. This is for settings that should travel with a particular workspace — say, a tweaked keymap for one repo — without putting anything jif-specific on a tracked path.

`.jj` is jj's own untracked workspace metadata directory, so a checkout of a third-party repository can never deliver TypeScript that jif will execute. Anything in there got there because you put it there.

Workspace resolution uses `jj workspace root`, so this works from any subdirectory of the workspace and respects whatever jj considers the workspace root.

### Layered config

Configuration is assembled as a stack of layers, deep-merged from bottom to top. Later layers win on conflicting keys; values left `undefined` by a later layer do not clobber the earlier value.

The stack, from lowest to highest precedence:

1. Built-in defaults
2. `--config-base FILE` layers, in the order they appear on the command line
3. The user config (the file discovered in the jif config directory, or the file passed to `--config`)
4. The project-local config at `<workspace>/.jj/jif.config.{ts,js}`, if present
5. `--config-override FILE` layers, in the order they appear on the command line

The merge is recursive for plain objects, but arrays and any object that contains a function value (most notably an inline keymap binding with `run` or `canExecute`) are replaced wholesale rather than merged. This keeps a layer that redefines a single key from producing a Frankenstein binding spliced together from two layers.

The relevant flags:

- `--config FILE` — replace the discovered user config entirely with `FILE`. Cannot be combined with another `--config`. Use this when you want a one-off run with a different user config without moving files around.
- `--config-base FILE` — add `FILE` as a layer below the user config. Repeatable.
- `--config-override FILE` — add `FILE` as a layer above the user config. Repeatable.

A typical use is keeping a shared team config as a base layer and a personal override on top:

```bash
jif --config-base ~/work/team.jif.ts --config-override ~/.config/jif/personal-overrides.ts
```

### Theme

The color configuration supports `light`, `dark`, and `auto` theme mode. In `auto`, startup queries the terminal background color and picks the light or dark theme accordingly.

### Revision IDs

Revision IDs default to the longest unique prefix across the visible log. You can show a few extra characters with:

```ts
export default {
	log: {
		revisionIdAdditionalChars: 0,
	},
} satisfies Jif.Config;
```

### Keybindings

Key bindings live under the top-level `keymap` field. User keymaps are deep-merged into the built-in defaults, so adding one binding does not replace the rest of the default map.

You can either rebind an existing built-in command by id:

```ts
export default {
	keymap: {
		normal: {
			J: "move-down",
		},
	},
} satisfies Jif.Config;
```

Or define an inline command directly in the keymap:

```ts
export default {
	keymap: {
		normal: {
			"ctrl-g": {
				id: "show-focused",  // command ids are optional
				title: "Show Focused Revision",
				description: "Open jj show for the focused revision",
				run: (cmd, app) => {
					const revision = app.rev;
					if (!revision) return;

					return cmd.jji(`show -r ${revision.revisionId}`);
				},
			},
			"ctrl-e": {
				title: "Edit Focused Revision",
				description: "Run jj edit on the focused revision",
				run: (cmd, app) => {
					const revision = app.rev;
					if (!revision) return;

					return cmd.jj(`edit ${revision.revisionId}`);
				},
			},
		},
	},
} satisfies Jif.Config;
```

Inline handlers receive as arguments:

- `cmd` — the command controller. See [TODO](TODO) for full documentation, but the most useful methods are:
	- `cmd.jj("...")` to run a jj command
	- `cmd.sh("...")` to run a shell command
- `app` — the full `AppState`, plus a few ergonomic shortcuts:
	- `app.rev` holds the currently-focused revision id

## Developing

Workspace tooling uses [Bun](https://bun.sh/). Install dependencies with:

```bash
bun install
```

### Run from source

Run against the current working directory:

```bash
bun run start
```

Run against a freshly materialized deterministic sample repo:

```bash
bun run sample
```

Run in watch mode against a freshly materialized sample repo:

```bash
bun run dev
```

You can also run the entrypoint directly:

```bash
bun run index.ts
```

### Build

Compile a single `jif` executable into `${XDG_BIN_HOME:-$HOME/.local/bin}`:

```bash
bun run bin
```

To install into a different location for one run:

```bash
XDG_BIN_HOME=/some/bin bun run install:bin
```

Build a standalone executable into `dist/`:

```bash
bun run build
```

On macOS Apple Silicon, the output currently looks like:

```bash
./dist/jif-bun-darwin-arm64
```

You can smoke-test the built binary with:

```bash
./dist/jif-bun-darwin-arm64 --sample
```

### Test

Run the test suite:

```bash
bun test
```

Run typechecking:

```bash
bunx tsc --noEmit
```
