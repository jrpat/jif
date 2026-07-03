# jif

`jif` is a Jujutsu porcelain — highly-tuned out of the box, but *deeply* configurable. Built to make the underlying model more accessible, not to hide it.

## Jif's Worldview

jif is meant to be lived in, kept open, reached for constantly – your home for Jujutsu in the terminal. It comes out-of-the box with thoughtful ergonomics, consistent shortcuts, creature comforts, and a polished fit and finish.

But it's also *yours*, designed from the start to be molded to how you work. The configuration system is TypeScript executed at runtime, with all the app state and internal commands exposed. Nothing is hidden or artificially restricted.

And it's not just an ergonomic porcelain – it's also a better place to write `jj` commands by hand. The command bar understands `jj`'s own help, so it can complete subcommands, flags, revisions, bookmarks, and the values each command expects.

## Prerequisites

`jif` shells out to the real `jj` binary, so `jj` must be installed and available on `PATH`.

## Install

> TODO

## Run

Launch the TUI against the current working directory:

```bash
jif
```


## Keybindings

Press `?` in jif at any time to show keybindings for the current mode.

<details>
<summary>Default Keybindings</summary>

Keybindings are per-mode. Global bindings are available in every mode and may be overridden by a mode-specific binding for the same key.

Each mode is annotated below with whether it inherits Normal-mode bindings on top of its own.

### Global

Available in every mode (mode-specific bindings can override these).

| Key | Command | Description |
|-----|---------|-------------|
| `?` | shortcut-panel | Expand or collapse the shortcut panel |
| `ctrl-r` | refresh-repository | Refresh the revision log |
| `ctrl-,` | reload-config | Reload config files and apply runtime settings |
| `ctrl-z` | suspend | Suspend the application and return to the shell |
| `ctrl-n` | search-next | Jump to the next search match (no-op when no search is active) |
| `ctrl-p` | search-prev | Jump to the previous search match (no-op when no search is active) |
| `ctrl-j` | scroll-help-down | Scroll the visible help toast down one line (in Normal, Files, Operation Log, and Evolog this scrolls the [preview](#preview) instead when it is shown) |
| `ctrl-k` | scroll-help-up | Scroll the visible help toast up one line (in Normal, Files, Operation Log, and Evolog this scrolls the [preview](#preview) instead when it is shown) |
| `escape` | cancel | Cancel command composition, leave input mode, or return from a file filter to the log |
| `~` | open-notifications | Open the notifications history panel |

### Preview

A pane beside the log that shows the diff of whatever is focused, following your navigation. Active in Normal, Files, Operation Log, and Evolog.

- **Normal** — the full diff of the focused revision (all files), with a change-id + description header.
- **Files** — the diff of the focused file only.
- **Operation Log** — the diff of the focused operation (`jj operation diff`).
- **Evolog** — the diff of the focused evolution entry.

By default the pane is placed automatically: on the right in wide terminals and below in narrow ones (narrower than `preview.narrowWidth` columns). Set `preview.whenNarrow` to `"hide"` to hide the pane on narrow terminals instead of relocating it below. See the [Preview Pane](#configuration) configuration for defaults, including whether it shows on startup and its size.

| Key | Command | Description |
|-----|---------|-------------|
| `p` | toggle-preview | Show or hide the preview pane for this session |
| `shift+p` | cycle-preview-position | Cycle the pane between auto, right, and below |
| `shift+w` | toggle-preview-word-wrap | Wrap or unwrap long preview diff lines |
| `ctrl+enter` | toggle-preview-full-file | In Files mode, toggle effectively full-file preview diffs using a large `jj --context` value |
| `ctrl+[` | expand-preview | Grow the pane by `preview.resizeStepPercent` |
| `ctrl+]` | shrink-preview | Shrink the pane by `preview.resizeStepPercent` |
| `ctrl+j` | scroll-preview-down | Scroll the preview down (falls back to the help toast when the pane is hidden) |
| `ctrl+k` | scroll-preview-up | Scroll the preview up (falls back to the help toast when the pane is hidden) |

Diff bodies are syntax-highlighted for filetypes supported by OpenTUI's parser, with token foregrounds using indexed ANSI colors from the terminal palette. When unchanged context is omitted between hunks, the preview inserts a centered separator such as `⋮⋮⋮ 37 more lines ⋮⋮⋮` so non-contiguous source regions do not read as one block. In Files mode, `ctrl+enter` toggles the focused file preview between jj's compact diff context and an effectively full-file diff (`--context 999999`). When word wrap is off, the pane also scrolls **horizontally** with the mouse wheel / trackpad when a diff line is wider than the pane.

`ctrl+[` / `ctrl+]` require a terminal that distinguishes them from other keys via the Kitty keyboard protocol (kitty, Ghostty, WezTerm, recent iTerm2, Alacritty, foot). In terminals without it, `ctrl+[` is indistinguishable from Escape.

### Normal

Viewing and navigating the revision log.

#### Navigation

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` | move-down | Move through revisions or files |
| `k` / `↑` | move-up | Move through revisions or files |
| `J` | move-parent | Follow the graph to the nearest visible parent, skipping branches |
| `K` | move-child | Follow the graph to the nearest visible child, skipping branches |
| `alt-j` | jump-to-next-divergent | When the focused revision is divergent (showing the `/N` suffix), cycle to the next visible sibling sharing its change-id |
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
| `ctrl-f` | find-file | Search jj-known files and show revisions that changed the selected file |
| `/` | search | Incremental search through the revision log |
| `f` | fast-jump | Incremental search through the revision log, clearing highlights on Enter |
| `_` | cycle-layout | Rotate loose, normal, and tight layouts |

When the active revset is only `files(...)`, the collapsed status bar shows a `file` chip at the left and starts its shortcuts with `esc log`. Pressing Escape restores the most recent saved revset that is not another pure file filter; if none exists, jif falls back to the configured `revsets.log` value or jj's default log revset.

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
| `E` | diff-edit-revision | Touch up the focused revision's changes in your configured diff editor (`jj diffedit -r <focused>`) |
| `i` | interdiff | Show the interdiff between the focused revision and another |
| `M` | set-parents | Change the focused revision's parents, toggling revisions to add or remove them as parents (megamerge) |
| `n` | new-revision | Create a new revision from the focused revision |
| `r` | rebase | Start a rebase from the focused revision |
| `R` | restore-revision | Restore the focused revision from another |
| `y` | duplicate | Copy the focused revision to another location (same target picker as rebase) |
| `alt-r` | revert | Create a new revision that undoes the focused revision (same target picker as rebase) |
| `s` | squash | Squash the focused revision into another |
| `S` | squash-onto | Keep the focused revision as the target and select the branch above it (the revision directly above and its descendants) as the source |
| `ctrl-s` | split | Split the focused revision, or use the current file selection |
| `alt-s` | split-parallel | Split the focused revision into sibling commits sharing its parent (`jj split --parallel`) |
| `u` | undo | Undo the last operation |
| `alt-u` | redo | Redo the last undone operation |
| `space` | toggle-revision-selection | Add or remove the focused revision from the selection |

#### Miscellaneous

| Key | Command | Description |
|-----|---------|-------------|
| `:` | command-bar | Run a jj subcommand |
| `g` | git-command-bar | Open the command bar prefilled with `git `, straight into complete-at-point so git subcommands complete immediately |
| `>` | shell-command-bar | Run a shell command |
| `ctrl-o` | open-operation-log | Open the repository operation log |
| `ctrl-e` | open-evolog | Open the evolution log for the focused revision |
| `q` | quit | Exit the application |
| `!` | force-last-command | Retry the latest retryable command with the override flag `jj` is asking for:<br>• `--ignore-immutable` — when the command refused because the target is immutable<br>• `--allow-backwards` — when a bookmark move was rejected as backwards/sideways<br>• `--include-ignored` — when `jj file track` warned that it refused to snapshot some files |
| `-` | toggle-flags | Toggle the command bar between short and long flag names while composing a command |
| `;` | enter-extra-mode | Enter Extra mode, a clean-slate scope for keys you define yourself in `keymap.extra` |

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
| `ctrl-f` | restrict-revset-to-focused-file | Show revisions that changed the focused file |
| `alt-s` | split-parallel | Split using the current file selection into sibling commits (`jj split --parallel`) |

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

### Duplicate

Pressing `y` from Normal mode enters Duplicate mode against the focused revision. Inherits Normal. Composes `jj duplicate <source> -d <target>`; the source is tagged with a `copy` chip and the destination with an `onto` chip. Navigate to choose the target (or select more sources with `space`), then `enter` to run. Duplicate copies the revisions to the new location without touching the originals, so it has no `--source`/`--branch` knobs — only the destination picker below.

| Key | Command | Description |
|-----|---------|-------------|
| `b` | rebase-target-before | Toggle `--insert-before` on the target |
| `a` | rebase-target-after | Toggle `--insert-after` on the target |
| `i` | rebase-target-insert-between | Pin the focused revision as `--insert-after`; navigate to pick `--insert-before` |

### Revert

Pressing `alt-r` from Normal mode enters Revert mode against the focused revision. Inherits Normal. Composes `jj revert -r <source> -d <target>`, which creates a *new* revision undoing the source's changes at the chosen location — distinct from `revert-operation`, which targets the op log. The source is tagged with a `revert` chip and the destination with an `onto` chip; navigate to choose the target, then `enter` to run. Shares the same destination picker as Rebase and Duplicate.

| Key | Command | Description |
|-----|---------|-------------|
| `b` | rebase-target-before | Toggle `--insert-before` on the target |
| `a` | rebase-target-after | Toggle `--insert-after` on the target |
| `i` | rebase-target-insert-between | Pin the focused revision as `--insert-after`; navigate to pick `--insert-before` |

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

Active while composing an absorb. Inherits Normal. The source is the revision focused when you pressed `A`, tagged with an `absorb` chip, and its mutable ancestors (the revisions `jj absorb` would consider by default) are preselected, each tagged with an `into` chip. Use `space` to toggle candidate targets — like selecting in Normal mode, the focus advances to the next revision on each toggle — then `enter` to apply, or `escape` to cancel. Leaving the preselected set unchanged runs plain `jj absorb` (with `--from <source>` when the source is not the working copy); changing it constrains the operation with `--into <selected revisions>`.

| Key | Command | Description |
|-----|---------|-------------|
| `s` | absorb-descendants | Replace the selected `--into` targets with the visible chain from the focused revision, stopping before the absorb source |

### Set Parents

Pressing `M` from Normal mode enters Set Parents mode against the focused revision — the **subject** of the operation, tagged with a `subject` chip and the command-target highlight. Inherits Normal, so navigate with the usual keys (and incremental search with `/`). Use `space` to toggle a revision into the working parent set: a revision that is already a parent of the subject is tagged `remove` and will be dropped, while any other revision is tagged `add` and will be joined in as a co-parent — this is how you build a "megamerge". The command bar previews `jj rebase -r <subject> -d <parent> …` with the resulting parent set; `enter` runs it, `escape` cancels. The preview reflects today's parents until you change something, and running is blocked while the change would leave the subject with no parents. If the rebase is refused as immutable, retry it with `!`.

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

### Search

Press `/` from the revision log, operation log, or evolog to start an incremental search. Matching text is highlighted with inverse video as you type, and focus snaps to the first match. Press `f` from the same views to start a fast jump: it uses the same incremental matching, but Enter clears the query and highlights immediately after moving focus.

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
| `f` | fast-jump | Incremental search through the operation log, clearing highlights on Enter |

### Evolog

Active while the evolog panel is open. Opened from Normal with `ctrl-e` for the focused revision. Does not inherit Normal.

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` | move-down | Focus the next evolog entry |
| `k` / `↑` | move-up | Focus the previous evolog entry |
| `G` | jump-to-bottom | Jump to the last evolog entry |
| `:` | command-bar | Run a jj subcommand |
| `/` | search | Incremental search through the evolog |
| `f` | fast-jump | Incremental search through the evolog, clearing highlights on Enter |

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

Active in the command bar (`:`), revset prompt (`L`), file search prompt (`ctrl-f`), and search prompt (`/`). Keystrokes pass through as text input; the bindings below navigate history and suggestion lists.

| Key | Description |
|-----|-------------|
| `ctrl-j` / `ctrl-n` / `↓` | Move to the next history entry or suggestion |
| `ctrl-k` / `ctrl-p` / `↑` | Move to the previous history entry or suggestion |
| `tab` | In the `:` jj command bar's complete-at-point, insert the current suggestion and advance to the next thing to complete; `shift-tab` still moves to the previous suggestion. In history-style lists (the `>` shell bar, or the `:` bar's history view) `tab` / `shift-tab` move through the list |
| `ctrl-h` | (`:` jj command bar) Toggle between command history and complete-at-point, regardless of what is typed. The bar opens in history when there is any, otherwise in complete-at-point; switching into history is a no-op when there is none. With an empty input, typing `:` (the first-and-only character) does the same toggle — the `:` is consumed as a command, not inserted as text. Complete-at-point is shown with a double border; the history view uses the default single border |
| `ctrl-x` | Delete the highlighted suggestion from saved history (no-op for suggestions from non-history sources like subcommand, flag, or revset completions) |
| `ctrl-l` | (revset prompt `L`) Toggle the suggestion list between revset-function completions and previously applied revsets. (file search prompt `ctrl-f`) Open the revset prompt seeded with the selected `files("path")` revset before applying it |
| `ctrl-'` | (`:` and `>` command bars) Insert the focused item's id at the cursor: the revision's shortest unique change-id prefix in Normal, the operation id in Op Log, the entry id in Evolog |
| `enter` | Submit the current input (run the command, apply the revset, finalize the search). In the `:` jj command bar's complete-at-point, if you have moved to a suggestion, `Enter` accepts it instead (the same as `Tab`) |

</details>

## Configuration

jif configuration is TypeScript evaluated at runtime, so settings can be simple data or code that composes with the app state and command helpers. Configuration layers start with built-in defaults, then merge user, project-local, and CLI-provided files on top.

<details>
<summary>Init config</summary>

Run `jif init-config` to create a starter user config. The command creates:

- `config.ts` with a placeholder `Jif.Config` shape and commented examples
- `jif.d.ts` with editor-facing types for autocomplete and inline docs

If a config file already exists, `jif init-config` leaves it alone and only fills in missing support files.

jif also rewrites the generated `jif.d.ts` on normal startup for your user config directory, or next to the file passed with `--config`, so editor type hints stay current after upgrades.
Startup never rewrites your `config.ts`.

To seed a project-local config instead, pass `--project` (or `-p`):

```bash
jif init-config -p          # uses the workspace containing the cwd
jif init-config -p path/to  # resolves the workspace root from a subdirectory
```

This writes `config.ts` and `jif.d.ts` into the workspace's `.jj/jif/` directory (which jif also uses to track per-workspace history). The path argument may be any directory inside a JJ workspace; jif resolves it up to the workspace root (via `jj workspace root`) and seeds the config there. Without `-p`, `init-config` seeds the user-level config described above.

</details>

<details>
<summary>User-Level Config</summary>

User config lives in the jif config directory:

- `$XDG_CONFIG_HOME/jif` when `XDG_CONFIG_HOME` is set
- otherwise `~/.config/jif`

jif loads the first existing file in this order from that directory:

- `config.ts`
- `config.js`
- `jif.config.ts`
- `jif.config.js`

</details>

<details>
<summary>Project-Local Config</summary>

If the workspace's `.jj/jif/` directory contains a `config.ts` (or `config.js`), jif loads it automatically as a layer just above your user config. This is for settings that should travel with a particular workspace — say, a tweaked keymap for one repo — without putting anything jif-specific on a tracked path.

`.jj` is jj's own untracked workspace metadata directory, so a checkout of a third-party repository can never deliver TypeScript that jif will execute. Anything in there got there because you put it there.

Workspace resolution uses `jj workspace root`, so this works from any subdirectory of the workspace and respects whatever jj considers the workspace root.

</details>

<details>
<summary>Config Layers</summary>

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

</details>

<details>
<summary>Theme Settings</summary>

The color configuration supports `light`, `dark`, and `auto` theme mode. In `auto`, startup queries the terminal background color and picks the light or dark theme accordingly. jif also re-queries when the terminal regains focus (and when it reports a color-scheme change), so switching your system between light and dark while jif is in the background takes effect as soon as you focus the terminal again.

Autocomplete suggestion focus is controlled separately from revision-row focus. Override `colorScheme.colors.promptSuggestionFocusedFill` to change the highlighted suggestion background without changing `rowFocusedFill`.

The preview pane's background defaults to the terminal foreground blended at 3% opacity against the terminal background. Override `colorScheme.colors.previewPaneFill` to tune it. The diff adapts to the terminal theme too: added and removed lines are blended from the palette's green and red against the terminal background, and syntax tokens use indexed ANSI foreground colors from the terminal palette. Override `colorScheme.colors.diffFileName`, `diffAddedFill`, `diffRemovedFill`, `diffAddedSign`, or `diffLineNumber` to tune the diff colors.

</details>

<details>
<summary>Refresh Settings</summary>

Auto-refresh is disabled by default. Set `refresh.intervalMs` to periodically reload the visible repository state:

```ts
export default {
	refresh: {
		intervalMs: 5000,
	},
} satisfies Jif.Config;
```

Set `intervalMs` to `0` to disable auto-refresh. Positive values below `1000` are clamped to `1000` ms. Interval refreshes are passive: jif runs timer-based repository reads with `--ignore-working-copy` so multiple worktrees and background agents do not get their working copies snapshotted by the timer. Regaining terminal focus and pressing `ctrl-r` snapshot and refresh the current worktree.

</details>

<details>
<summary>Revision IDs</summary>

Revision IDs default to the longest unique prefix across the visible log. You can show a few extra characters with:

```ts
export default {
	log: {
		revisionIdAdditionalChars: 0,
	},
} satisfies Jif.Config;
```

</details>

<details>
<summary>Mouse Wheel Scrolling</summary>

Mouse-wheel scrolling defaults to two lines per wheel notch. On macOS, jif also enables OpenTUI's macOS-style acceleration so quick wheel bursts move farther while slow gestures stay precise:

```ts
export default {
	scroll: {
		step: 2,
		acceleration: true,
	},
} satisfies Jif.Config;
```

`scroll.step` is floored and clamped to at least `1`. `scroll.acceleration` only changes wheel scrolling on macOS; other platforms use the configured linear step.

</details>

<details>
<summary>Preview Pane</summary>

The [preview pane](#preview) shows the diff of the focused item beside the log. These are its defaults:

```ts
export default {
	preview: {
		position: "auto",         // "auto" | "right" | "below"; auto uses right on wide terminals, below/hidden on narrow
		showByDefault: false,      // show the pane on startup (toggle in-session with `p`)
		defaultWidthPercent: 50,   // initial size as a percent of the terminal
		resizeStepPercent: 5,      // percent added/removed by ctrl+[ / ctrl+]
		minSizePercent: 15,        // clamp for the size percent
		maxSizePercent: 90,
		narrowWidth: 100,          // in "auto", terminals narrower than this are "too narrow" for the right layout
		whenNarrow: "below",       // in "auto", what to do when too narrow: "below" (relocate) or "hide"
	},
} satisfies Jif.Config;
```

Position, visibility, and size can also be changed for the current session with `p`, `shift+p`, and `ctrl+[` / `ctrl+]`; those session changes are not persisted.

</details>

## Custom Keybindings

Custom keybindings live under the top-level `keymap` field in your config. They can rebind built-in commands, define inline commands, or use Extra mode as a clean-slate space for your own shortcuts.

<details>
<summary>Syntax</summary>

User keymaps are deep-merged into the built-in defaults, so adding one binding does not replace the rest of the default map.

You can rebind an existing built-in command by id:

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
				run: (cmd, app) => {
					if (!app.rev) return;

					// app.rev is the focused revision's jj argument
					return cmd.jji(`show -r ${app.rev}`);
				},
			},
			"alt-e": {
				title: "Edit Focused Revision",
				run: (cmd, app) => {
					if (!app.rev) return;

					return cmd.jj(`edit ${app.rev}`);
				},
			},
		},
	},
} satisfies Jif.Config;
```

Pressing `;` from Normal mode enters Extra mode, a clean-slate scope for keys you define yourself in `keymap.extra`. The shortcut panel opens automatically and lists exactly the keys bound under `extra` (plus globals: `escape`, `q`, `ctrl-r`, `~`). With no bindings configured, the panel shows a placeholder pointing to the config. Press Escape to leave Extra mode.

```ts
export default {
	keymap: {
		extra: {
			d: {
				title: "Deploy",
				run: (cmd) => cmd.sh("./scripts/deploy.sh"),
			},
		},
	},
} satisfies Jif.Config;
```

Unlike most modes, Extra does not inherit Normal-mode bindings, so the entire alphabetic keyspace is yours to bind without shadowing built-in commands.

</details>

<details>
<summary>Aliases</summary>

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
	canonical: false,
	run: (cmd, app) => { /* ... */ },
},
```

</details>

<details>
<summary><code>cmd</code> API</summary>

The `cmd` argument exposes command and state-transition helpers to inline keybindings.

| Method | Description |
|--------|-------------|
| `jj(commandText, options?)` | Run a non-interactive `jj` command |
| `jji(commandText, options?)` | Run an interactive `jj` command |
| `sh(commandText, options?)` | Run a shell command through the configured shell |
| `shi(commandText, options?)` | Run an interactive shell command through the configured shell |
| `abandonRevision()` | Abandon the focused revision |
| `cancelOrBlur()` | Run the current mode's cancel action |
| `closeFocusedRevision()` | Collapse the focused revision details |
| `collapseNotification()` | Collapse the focused notification |
| `commit()` | Commit the working-copy revision |
| `confirm()` | Confirm the active command draft, prompt, or inline confirmation |
| `cycleLayout()` | Cycle the revision layout |
| `describe()` | Edit the focused revision description |
| `editFocusedNotification()` | Open the focused notification text in `$EDITOR` |
| `editRevision()` | Edit the focused revision |
| `enterBookmarkMode()` | Enter the bookmark leader mode |
| `enterExtraMode()` | Enter Extra mode |
| `expandNotification()` | Expand the focused notification |
| `focusCommandBar()` | Open the `:` jj command bar |
| `focusCurrentOperation()` | Focus the current operation in the operation log |
| `focusLogBottom()` | Focus the bottom item in the active log |
| `focusShellCommandBar()` | Open the `>` shell command bar |
| `focusWorkingCopy()` | Focus the working-copy revision |
| `forceLastCommand()` | Retry the last retryable failed command with the requested override flag |
| `moveFocus(delta)` | Move focus by `delta` rows in the active list |
| `moveFocusToBookmark(direction)` | Move to the next (`1`) or previous (`-1`) visible bookmark |
| `moveFocusToChild()` | Focus the nearest visible child revision |
| `moveFocusToNextDivergentSibling()` | Cycle to another visible divergent sibling |
| `moveFocusToParent()` | Focus the nearest visible parent revision |
| `moveFocusToWorkspace(direction)` | Move to the next (`1`) or previous (`-1`) visible workspace marker |
| `nextSearchMatch()` | Jump to the next search match |
| `openEvolog()` | Open the evolution log for the focused revision |
| `openFocusedRevision()` | Expand the focused revision details |
| `openNotifications()` | Open notification history |
| `openOperationLog()` | Open the repository operation log |
| `openFileSearch()` | Open the file search prompt |
| `openFastJump()` | Open fast jump in the current searchable view |
| `openRevsetInput(initialQuery?)` | Open the revset prompt, optionally seeded with draft text |
| `openSearch()` | Open search in the current searchable view |
| `prevSearchMatch()` | Jump to the previous search match |
| `quit()` | Exit jif |
| `redo()` | Redo the last undone repository operation |
| `refreshRepository()` | Refresh repository data |
| `restoreFiles()` | Restore the focused file or selected files |
| `restoreOperation()` | Restore the focused operation |
| `revertOperation()` | Revert the focused operation |
| `restrictRevsetToFocusedFile()` | Show revisions that changed the focused file |
| `scrollDiffViewer(rowDelta, colDelta)` | Scroll the diff viewer by rows and columns |
| `scrollHelpToast(rowDelta)` | Scroll the visible help toast |
| `selectAllFiles()` | Select all files in the expanded revision, or clear them if all are selected |
| `selectNextInlineConfirmationOption()` | Move to the next inline confirmation option |
| `selectPreviousInlineConfirmationOption()` | Move to the previous inline confirmation option |
| `selectAbsorbDescendants()` | Select absorb targets from the focused revision, stopping before the absorb source |
| `setRebaseSourceKind(kind)` | Set rebase source kind: `"revisions"`, `"source"`, or `"branch"` |
| `setRebaseTargetKind(kind)` | Set rebase target kind: `"destination"`, `"insert-before"`, `"insert-after"`, or `"insert-between"` |
| `showFileDiff()` | Show the focused file diff |
| `showOperationDiff()` | Show the focused operation diff |
| `showRevisionDiff()` | Show the focused revision diff |
| `startAbsorb()` | Start an absorb operation |
| `startBookmarkCreate()` | Open the bookmark create prompt for the focused revision |
| `startBookmarkDelete()` | Open the bookmark delete prompt |
| `startBookmarkForget()` | Open the bookmark forget prompt |
| `startBookmarkMoveFrom()` | Start moving a bookmark from the focused revision |
| `startBookmarkMoveTo()` | Open the bookmark move-to prompt for the focused revision |
| `startBookmarkSet()` | Open the bookmark set prompt for the focused revision |
| `startBookmarkTrack()` | Open the bookmark track prompt |
| `startBookmarkUntrack()` | Open the bookmark untrack prompt |
| `startDiff()` | Start composing a diff between two revisions |
| `startInterdiff()` | Start composing an interdiff |
| `startNewRevision()` | Create a new revision from the focused revision |
| `startRebase()` | Start composing a rebase from the focused revision |
| `startRestore()` | Start composing a restore from the focused revision |
| `startSplit()` | Start a split operation |
| `startSquash()` | Start composing a squash from the focused revision |
| `startSquashOnto()` | Start squash-onto with the focused revision as the target |
| `suspend()` | Suspend jif and return to the shell |
| `toggleFileSelection()` | Toggle the focused file selection |
| `toggleInterdiffSwap()` | Swap interdiff `--from` and `--to` roles |
| `togglePreviewFullFile()` | Toggle effectively full-file context for file preview diffs |
| `togglePreviewWordWrap()` | Wrap or unwrap long preview diff lines |
| `toggleRebaseSkipEmptied()` | Toggle `--skip-emptied` on a rebase draft |
| `toggleSearchIdOnly()` | Toggle ID-only search |
| `toggleSelection()` | Toggle the focused revision selection |
| `toggleShortcutPanel()` | Expand or collapse the shortcut panel |
| `toggleShortFlags()` | Toggle composed commands between short and long flags |
| `toggleSquashAnchor()` | Toggle squash source anchoring |
| `undo()` | Undo the last repository operation |
| `untrackFiles()` | Stop tracking the focused file or selected files |

For `jj` and `sh`, `options` may include `cwd` and `focusWorkingCopyAfterRefresh`. For `jji` and `shi`, `options` may include `cwd`.

</details>

<details>
<summary><code>app</code> API</summary>

The `app` argument is a read-only snapshot of jif state, plus the ergonomic `rev`, `selectedRevs`, and `file` shortcuts.

`rev`, `selectedRevs`, and `file` are ready to drop straight into commands — `cmd.jj(`edit ${app.rev}`)` works directly. `rev` is the focused revision's `jj` argument (the minimal unique change-id prefix, or the full id for a divergent revision), `selectedRevs` is the selected revisions' `jj` arguments in selection order, and `file` is the focused file's path. `rev` and `file` are `""` when nothing is focused, while `selectedRevs` is `[]` when nothing is selected, so guards stay simple. When you need the structured object, use `focusedRevision` / `focusedFile` (e.g. `app.focusedRevision?.commitId`).

| Property | Type | Description |
|----------|------|-------------|
| `rev` | `string` | Focused revision's `jj` argument, or `""` if nothing is focused |
| `file` | `string` | Focused file's path, or `""` if nothing is focused |
| `selectedRevs` | `readonly string[]` | Selected revisions' `jj` arguments, in selection order |
| `focusedRevision` | `RevisionSummary \| null` | Focused revision object, or `null` |
| `focusedFile` | `ChangedFile \| null` | Focused changed file object, or `null` |
| `commandBar` | `CommandBarState` | Current command bar state |
| `commandBarBookmark` | `CommandBarBookmarkContext \| null` | Bookmark autocomplete context for command prompts |
| `commandDraft` | `CommandDraft \| null` | Active command draft |
| `diffViewer` | `DiffViewerState \| null` | Active diff viewer state |
| `eventLog` | `readonly EventLogEntry[]` | Notification/event history |
| `evologEntries` | `readonly OperationLogEntry[]` | Loaded evolog entries |
| `evologLoading` | `boolean` | Whether the evolog is loading |
| `evologRevisionLabel` | `string` | Revision label for the active evolog |
| `expandedNotificationIds` | `readonly string[]` | Expanded notification ids |
| `expandedRowId` | `string \| null` | Row id of the expanded revision, if any |
| `focusMode` | `FocusMode` | Current focus mode |
| `focusModeStack` | `readonly FocusMode[]` | Browse/overlay mode stack |
| `focusedEvologIndex` | `number` | Index of the focused evolog entry |
| `focusedFileIndex` | `number` | Index of the focused file inside the expanded revision |
| `focusedNotificationIndex` | `number` | Index of the focused notification |
| `focusedOperationLogIndex` | `number` | Index of the focused operation log entry |
| `focusedRevisionIndex` | `number` | Index of the focused revision in `revisions` |
| `inlineConfirmation` | `InlineConfirmation \| null \| undefined` | Active inline confirmation, when present |
| `lastFailedCommand` | `FailedCommand \| null` | Last retryable failed command |
| `lastRefreshedAt` | `number` | Timestamp of the last repository refresh |
| `layout` | `AppLayout` | Active revision layout |
| `loading` | `boolean` | Whether a repository operation is loading |
| `markedRowIds` | `readonly string[]` | Marked row ids for active command previews |
| `notificationHistoryLimit` | `number` | Maximum stored notification count |
| `operationLogEntries` | `readonly OperationLogEntry[]` | Loaded operation log entries |
| `operationLogLoading` | `boolean` | Whether the operation log is loading |
| `previewFullFile` | `boolean` | Whether preview diffs use effectively full-file context for this session |
| `previewWordWrap` | `boolean` | Whether preview diff word wrap is enabled for this session |
| `repoPath` | `string` | Repository path jif is operating on |
| `revisions` | `readonly RevisionSummary[]` | Visible revision rows |
| `revsetQuery` | `string` | Current applied revset |
| `revsetInputQuery` | `string \| null` | Seed text for the active revset prompt, or `null` |
| `searchIdOnly` | `boolean` | Whether search is restricted to revision ids |
| `searchMode` | `"search" \| "fast-jump"` | Search prompt variant currently active |
| `searchQuery` | `string` | Current search query |
| `searchScope` | `SearchScopeId \| null` | Active search scope |
| `searchStartIndex` | `number \| null` | Search start index for cancellation/restoration |
| `selectedFilePaths` | `readonly string[]` | Selected file paths |
| `selectedRowIds` | `readonly string[]` | Selected revision row ids |
| `shortcutPanelExpanded` | `boolean` | Whether the shortcut panel is expanded |
| `statusMessages` | `readonly StatusMessage[]` | Visible status messages |
| `useShortFlags` | `boolean` | Whether composed commands prefer short flags |

</details>

## Miscellaneous

<details>
<summary>Help</summary>

Most successful commands surface a short toast that fades on its own after a few seconds. Help output is different: running `help`, or any command ending in `-h` or `--help`, opens a blue-bordered toast that grows to fit the help text (up to half the terminal height) and stays until you dismiss it. It is not a mode of its own — the log keeps the keyboard, so `j`/`k` still navigate revisions while the help text is up, and `ctrl-j`/`ctrl-k` scroll the help toast itself by a line. Pressing `Esc` clears it, and so does running any other command (the next toast supersedes it).

</details>

<details>
<summary>Shell Commands</summary>

Shell commands invoked via `>` run in your login shell (`$SHELL -lc`) with the cwd jif was launched from. `cmd.sh()` and `cmd.shi()` from custom keybindings use the repository path by default, or `options.cwd` when provided. Login shells source `.zprofile` / `.bash_profile` / `.profile`, but **not** `.zshrc` / `.bashrc`, so aliases and functions defined only in your interactive rc files will not be available.

If you want an alias to work from `>`, define it somewhere a non-interactive shell will see it — for zsh, that's `.zshenv` (sourced for every invocation) or `.zprofile` (sourced for login shells); for bash, `.bash_profile` or `.profile`.

</details>

<details>
<summary>Command Composition</summary>

Every operation in jif — `rebase`, `squash`, `split`, `new`, `commit`, and the rest — composes a `jj` command. The command bar shows that command being assembled as you press keys, color-coded to match the TUI: the focused revision in magenta (its highlight color), selected revisions and files in green (the selection accent), etc…

You get the ergonomics of a TUI porcelain without the CLI being hidden from you, and over time the visible command bar teaches you the underlying `jj` commands.

Press `-` while composing to flip between short and long flag names. Press `:` at any time to drop into the command bar and type a `jj` subcommand directly — if a command is already being composed, `:` preserves it and lets you edit it as text before running.

The `:` command bar has two views: your **command history**, and structured **complete-at-point**. It opens in history when you have any (otherwise it opens in complete-at-point), and you switch between them at any time with `ctrl-h`. With an empty input you can also just press `:` again — a `:` typed as the first-and-only character is treated as the toggle command rather than text, so `:` `:` drops you straight into complete-at-point.

Complete-at-point suggests the next thing a `jj` command needs: subcommands, configured command aliases, flags, revisions, enum values, and bookmark names. `tab` inserts the current suggestion and advances to the next thing to complete; the arrows / `ctrl-n`,`ctrl-p` / `ctrl-j`,`ctrl-k` move through the list. `enter` runs the command, unless you have moved to a suggestion, in which case it accepts that suggestion. The flag and value metadata comes straight from `jj`'s own help, so it matches your installed `jj`; command aliases come from `jj config list aliases`, excluding aliases that start with `util`. The `>` shell command bar is unchanged (history only).

</details>

## Developing

Workspace tooling uses [Bun](https://bun.sh/) for running, building, and testing. Install dependencies with `bun install` before using the source commands below.

<details>
<summary>Run from source</summary>

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

</details>

<details>
<summary>Build</summary>

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

</details>

<details>
<summary>Test</summary>

Run the test suite:

```bash
bun test
```

Run typechecking:

```bash
bunx tsc --noEmit
```

</details>
