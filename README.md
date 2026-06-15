# jif

`jif` is a Jujutsu porcelain — highly-tuned out of the box, but *deeply* configurable. Built to make the underlying model more accessible, not to hide it.

## Jif's Worldview

jif is meant to be lived in, kept open, reached for constantly – your home for Jujutsu in the terminal. It comes out-of-the box with thoughtful ergonomics, consistent shortcuts, creature comforts, and fit and finish you feel immediately.

But it's also *yours*, designed from the start to be molded to how you work. The configuration system is TypeScript executed at runtime, with all the app state and internal commands exposed. Nothing is hidden or artificially restricted.

## Command Composition

Every operation in jif — `rebase`, `squash`, `split`, `new`, `commit`, and the rest — composes a `jj` command. The command bar shows that command being assembled as you press keys, color-coded to match the TUI: the focused revision in blue (its highlight color), selected revisions and files in green (the selection accent), etc…

You get the ergonomics of a TUI porcelain without the CLI being hidden from you, and over time the visible command bar teaches you the underlying `jj` commands.

Press `-` while composing to flip between short and long flag names. Press `:` at any time to drop into the command bar and type a `jj` subcommand directly — if a command is already being composed, `:` preserves it and lets you edit it as text before running.

The `:` command bar has two views: your **command history**, and structured **complete-at-point**. It opens in history when you have any (otherwise it opens in complete-at-point), and you switch between them at any time with `ctrl-h`. With an empty input you can also just press `:` again — a `:` typed as the first-and-only character is treated as the toggle command rather than text, so `:` `:` drops you straight into complete-at-point.

Complete-at-point autocompletes "what is needed" wherever the cursor is: first the `jj` subcommands (and sub-subcommands for groups like `bookmark` or `git`), then a command's flags — each shown as its bold long flag, dim short alias, and `jj`'s own description — and then values when the flag or argument before the cursor expects one (revisions including `@`/`@-`, enum choices like `--color always`, and bookmark names for `jj bookmark` subcommands). The first (bottom-most) suggestion is **underlined** to show what `Tab` will insert; `Tab` accepts it and advances to the next thing to complete, and the arrows / `ctrl-n`,`ctrl-p` / `ctrl-j`,`ctrl-k` move through the list. `Enter` runs the command — but if you have moved to a suggestion, `Enter` accepts that suggestion instead (the same as `Tab`). The flag and value metadata comes straight from `jj`'s own help, so it matches your installed `jj`. The `>` shell command bar is unchanged (history only).

Most successful commands surface a short toast that fades on its own after a few seconds. Help output is different: running `help`, or any command ending in `-h` or `--help`, opens a blue-bordered toast that grows to fit the help text (up to half the terminal height) and stays until you dismiss it. It is not a mode of its own — the log keeps the keyboard, so `j`/`k` still navigate revisions while the help text is up, and `ctrl-j`/`ctrl-k` scroll the help toast itself by a line. Pressing `Esc` clears it, and so does running any other command (the next toast supersedes it).

## Prerequisites

`jif` shells out to the real `jj` binary, so `jj` must be installed and available on `PATH`.

## Install

> TODO

## Run

```bash
jif
```

This launches the TUI against the current working directory.

Print command-line usage with:

```bash
jif -h
jif --help
```

The help output lists startup options and subcommands, including `init-config`.

## Keybindings

Default keybindings, grouped by mode. Each mode is annotated below with whether it inherits Normal-mode bindings on top of its own. Global bindings are available in every mode and may be overridden by a mode-specific binding for the same key.

### Global

Available in every mode (mode-specific bindings can override these).

| Key | Command | Description |
|-----|---------|-------------|
| `ctrl-r` | refresh-repository | Refresh the revision log |
| `ctrl-z` | suspend | Suspend the application and return to the shell |
| `ctrl-n` | search-next | Jump to the next search match (no-op when no search is active) |
| `ctrl-p` | search-prev | Jump to the previous search match (no-op when no search is active) |
| `ctrl-j` | scroll-help-down | Scroll the visible help toast down one line (no-op when no help toast is shown) |
| `ctrl-k` | scroll-help-up | Scroll the visible help toast up one line (no-op when no help toast is shown) |
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
| `ctrl-o` | jump-to-next-divergent | When the focused revision is divergent (showing the `/N` suffix), cycle to the next visible sibling sharing its change-id |
| `]` | move-to-next-bookmark | Jump down to the next visible revision that has a bookmark, without wrapping |
| `[` | move-to-prev-bookmark | Jump up to the previous visible revision that has a bookmark, without wrapping |
| `}` | move-to-next-workspace | Jump down to the next visible revision that has a workspace, without wrapping |
| `{` | move-to-prev-workspace | Jump up to the previous visible revision that has a workspace, without wrapping |
| `@` | jump-to-working-copy | Jump to the working-copy revision |
| `G` | jump-to-bottom | Jump to the last revision in the log |

#### View

| Key | Command | Description |
|-----|---------|-------------|
| `h` / `←` | collapse | Close the focused detail view |
| `l` / `→` | expand | Open changed files for the focused revision |
| `L` | edit-revset | Change which revisions are displayed |
| `/` | search | Incremental search through the revision log |
| `_` | cycle-layout | Rotate loose, normal, and tight layouts |

#### Revision operations

| Key | Command | Description |
|-----|---------|-------------|
| `a` | abandon | Abandon the focused revision |
| `A` | absorb | Start an absorb operation, preselecting the default target revisions |
| `c` | commit | Commit the working-copy revision (`@`) |
| `d` | show-diff | Show diff for the focused revision or file |
| `ctrl-d` | diff | Show the diff between two revisions (`jj diff --from <source> --to <focused>`) |
| `D` | describe | Edit description of the focused revision |
| `e` | edit-revision | Edit the focused revision |
| `i` | interdiff | Show the interdiff between the focused revision and another |
| `n` | new-revision | Create a new revision from the focused revision |
| `r` | rebase | Start a rebase from the focused revision |
| `R` | restore-revision | Restore the focused revision from another |
| `s` | squash | Squash the focused revision into another |
| `S` | squash-onto | Keep the focused revision as the target and select the branch above it (the revision directly above and its descendants) as the source |
| `ctrl-s` | split | Split the focused revision, or use the current file selection |
| `u` | undo | Undo the last operation |
| `U` | redo | Redo the last undone operation |
| `space` | toggle-revision-selection | Add or remove the focused revision from the selection |

#### Miscellaneous

| Key | Command | Description |
|-----|---------|-------------|
| `:` | command-bar | Run a jj subcommand |
| `>` | shell-command-bar | Run a shell command |
| `o` / `O` | open-operation-log | Open the repository operation log |
| `E` | open-evolog | Open the evolution log for the focused revision |
| `q` | quit | Exit the application |
| `?` | shortcut-panel | Expand or collapse the shortcut panel |
| `!` | force-last-command | Retry the last failed command with the override flag `jj` is asking for:<br>• `--ignore-immutable` — when the command refused because the target is immutable<br>• `--allow-backwards` — when a bookmark move was rejected as backwards/sideways |
| `-` | toggle-flags | Toggle the command bar between short and long flag names while composing a command |
| `;` | enter-extras-mode | Enter Extras mode, a clean-slate scope for keys you define yourself (see [Extras](#extras)) |

### Files

Active when a revision is expanded and a file is focused. Self-contained — it does **not** inherit Normal, so revision-level operations (rebase, squash, new, …) are unavailable here; collapse back with `h` to reach them. Only `_global` shortcuts (quit, escape, refresh, …) remain.

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` | move-down | Focus the next file |
| `k` / `↑` | move-up | Focus the previous file |
| `h` / `←` | collapse | Collapse the file list and return to the revision |
| `space` | toggle-file-selection | Add or remove the focused file from the selection |
| `a` | select-all-files | Select every changed file, or clear the selection if all are already selected |
| `d` | show-file-diff | Show the diff for the focused file |
| `r` | restore | Restore selected files to their state before this change |
| `ctrl-u` | untrack | Stop tracking the focused file, or all selected files (`jj file untrack <paths>`) |
| `ctrl-s` | split | Split using the current file selection |
| `?` | shortcut-panel | Expand or collapse the shortcut panel |

### Rebase

Active while previewing a rebase. Inherits Normal. The default composition is `jj rebase -r <source> -d <target>`; each key below switches one knob of that composition and can be pressed again to toggle back to the default.

| Key | Command | Description |
|-----|---------|-------------|
| `s` | rebase-descendants | Toggle `--source` (move the focused revision and its descendants) |
| `B` | rebase-source-branch | Toggle `--branch` (rebase the whole branch containing the focused revision) |
| `b` | rebase-target-before | Toggle `--insert-before` on the target |
| `a` | rebase-target-after | Toggle `--insert-after` on the target |
| `i` | rebase-target-insert-between | Pin the focused revision as `--insert-after`; navigate to pick `--insert-before` |
| `e` | rebase-toggle-skip-emptied | Toggle `--skip-emptied` |
| `alt-enter` | rebase-confirm-force | Run the composed rebase with `--ignore-immutable` |

### Squash

Active while previewing a squash. Inherits Normal. Composes `jj squash -f <source> -t <focused>`; navigate to choose the target revision, then `enter` to run.

Two keys from Normal mode enter squash mode:

- `s` (squash) selects the focused revision as the source and moves focus down to its parent, which becomes the target — squash the focused revision into the one below it.
- `S` (squash-onto) keeps the focused revision as the target and selects the whole branch above it as the source: the revision directly above plus every descendant of it shown in the log. When revisions are already selected, the lowest selected revision anchors the branch instead. Each source revision is a real selection, so they all show as selected — squash the revisions above into the focused one.

| Key | Command | Description |
|-----|---------|-------------|
| `s` | squash-from-anchor | Toggle whether the source extends to a range `<source>::<anchor>`, where `<anchor>` is `@` if the working copy is non-empty, otherwise `@-`. `S` is an alias here, so you can keep toggling with either case |

### Restore

Active while previewing a restore. Inherits Normal. Composes `jj restore -f <source> -t <focused>`; navigate to choose the target revision, then `enter` to run.

### Interdiff

Active while previewing an interdiff. Inherits Normal. Composes `jj interdiff -f <source> -t <focused>`; navigate to choose the target revision, then `enter` to run. The output opens in the diff viewer.

| Key | Command | Description |
|-----|---------|-------------|
| `=` | interdiff-swap | Swap which side is `--from` and which is `--to`: the selected revision becomes `--to` and the focused revision becomes `--from`. Press again to swap back |

### Diff

Active while previewing a diff between two revisions. Inherits Normal. Composes `jj diff -f <source> -t <focused>`; navigate to choose the target revision, then `enter` to run. The output opens in the diff viewer.

### Absorb

Active while composing an absorb. Inherits Normal. The source is the revision focused when you pressed `A`, and its mutable ancestors (the revisions `jj absorb` would consider by default) are preselected, each tagged with an `into` chip. Use `space` to toggle candidate targets — like selecting in Normal mode, the focus advances to the next revision on each toggle — then `enter` to apply, or `escape` to cancel. Leaving the preselected set unchanged runs plain `jj absorb` (with `--from <source>` when the source is not the working copy); changing it constrains the operation with `--into <selected revisions>`.

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

### Extras

Pressing `;` from Normal mode enters Extras mode — a clean-slate scope for keys you define yourself in `keymap.extras`. The shortcut panel opens automatically and lists exactly the keys bound under `extras` (plus globals: `escape`, `q`, `ctrl-r`, `~`). With no bindings configured, the panel shows a placeholder pointing to the config. Press Escape to leave Extras mode.

```ts
export default {
	keymap: {
		extras: {
			d: {
				title: "Deploy",
				description: "Run the deploy script",
				run: (cmd) => cmd.sh("./scripts/deploy.sh"),
			},
		},
	},
} satisfies Jif.Config;
```

Unlike most modes, Extras does not inherit Normal-mode bindings — the entire alphabetic keyspace is yours to bind without shadowing built-in commands.

### Search

Press `/` from the revision log, operation log, or evolog to start an incremental search. Matching text is highlighted with inverse video as you type, and focus snaps to the first match.

- **Enter** dismisses the search input but leaves the highlights live. You stay in whatever mode you were in (Normal, Rebase, Squash, Op Log, …), so you can compose commands or multi-select against the matched revision.
- **Escape (first press)** clears the highlights and the query. **Escape (second press)** runs whatever cancel that mode would normally do — for example, cancelling an in-flight rebase.
- **`Ctrl+n` / `Ctrl+p`** (global) advance to the next / previous match as long as highlights are live.
- Pressing `/` again while highlights are live re-opens the input pre-filled with the last query (and preserves the ID-only toggle below).

While the search input is focused:

| Key | Description |
|-----|-------------|
| `tab` / `ctrl-i` | Toggle ID-only mode — restricts matching to the revision-id field using case-insensitive prefix semantics (mirrors how `jj` disambiguates short change IDs). The prompt prefix switches from `/` to `id`. |

Note: in terminals without enhanced keyboard support, `ctrl-i` and `tab` are indistinguishable and both fire this binding.

### Operation Log

Active while the operation log panel is open. Does not inherit Normal.

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` | move-down | Focus the next operation |
| `k` / `↑` | move-up | Focus the previous operation |
| `G` | jump-to-bottom | Jump to the last operation in the log |
| `@` | jump-to-current-operation | Jump to the current operation (top of the log) |
| `r` | restore-operation | Restore the focused operation |
| `R` | revert-operation | Revert the focused operation |
| `d` | show-operation-diff | Show repository changes for the focused operation |
| `:` | command-bar | Run a jj subcommand |
| `/` | search | Incremental search through the operation log |
| `?` | shortcut-panel | Expand or collapse the shortcut panel |

### Evolog

Active while the evolog panel is open. Opened from Normal with `E` for the focused revision. Does not inherit Normal.

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` | move-down | Focus the next evolog entry |
| `k` / `↑` | move-up | Focus the previous evolog entry |
| `G` | jump-to-bottom | Jump to the last evolog entry |
| `:` | command-bar | Run a jj subcommand |
| `/` | search | Incremental search through the evolog |
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
| `ctrl-g` | edit-notification | Open the focused notification's text in `$EDITOR` (falls back to `vi`) |
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
| `tab` | In the `:` jj command bar's complete-at-point, accept the underlined default suggestion — or, if you have moved to one, the focused suggestion — inserting it and advancing to the next thing to complete; `shift-tab` still moves to the previous suggestion. In history-style lists (the `>` shell bar, or the `:` bar's history view) `tab` / `shift-tab` move through the list |
| `ctrl-h` | (`:` jj command bar) Toggle between command history and complete-at-point, regardless of what is typed. The bar opens in history when there is any, otherwise in complete-at-point; switching into history is a no-op when there is none. With an empty input, typing `:` (the first-and-only character) does the same toggle — the `:` is consumed as a command, not inserted as text. Complete-at-point is shown with a double border; the history view uses the default single border |
| `ctrl-x` | Delete the highlighted suggestion from saved history (no-op for suggestions from non-history sources like subcommand, flag, or revset completions) |
| `ctrl-l` | (revset prompt `L`) Toggle the suggestion list between revset-function completions and previously applied revsets (double-tap `l` while holding `ctrl`, since that prompt opens on `ctrl-l`). The completions view (complete-at-point) is shown with a double border; history uses the default single border, and toggling into it is a no-op when there is no history. Selecting a history entry replaces the whole input; the revset you switch away from is saved as the most recent entry and pre-focused (the active revset is hidden), so re-applying toggles between two revsets |
| `ctrl-'` | (`:` and `>` command bars) Insert the focused item's id at the cursor: the revision's shortest unique change-id prefix in Normal, the operation id in Op Log, the entry id in Evolog |
| `enter` | Submit the current input (run the command, apply the revset, finalize the search). In the `:` jj command bar's complete-at-point, if you have moved to a suggestion, `Enter` accepts it instead (the same as `Tab`) |

## Mouse

Left-clicking an entry in any of the list-style views — the revision log, the operation log, and the notifications panel — moves focus to that entry. Mouse wheel scrolling and scrollbar dragging continue to work as before.

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

The color configuration supports `light`, `dark`, and `auto` theme mode. In `auto`, startup queries the terminal background color and picks the light or dark theme accordingly. jif also re-queries when the terminal regains focus (and when it reports a color-scheme change), so switching your system between light and dark while jif is in the background takes effect as soon as you focus the terminal again.

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

Every binding shows up in the shortcut panel by default. To bind an alias key that should *not* appear in the panel, write the binding as an object with `canonical: false`:

```ts
export default {
	keymap: {
		normal: {
			// alias for `move-down`; works but stays out of the shortcut panel
			x: { command: "move-down", canonical: false },
		},
	},
} satisfies Jif.Config;
```

Inline commands accept the same flag:

```ts
"ctrl-q": {
	title: "Quick Action",
	description: "Hidden from the shortcut panel",
	canonical: false,
	run: (cmd, app) => { /* … */ },
},
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
