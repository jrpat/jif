# jif

`jif` is a Jujutsu porcelain — highly-tuned out of the box, but *deeply* configurable. Built to make the underlying model more accessible, not to hide it.

> [!IMPORTANT]
> **Project Status**
> 
> I've been using jif as my daily driver for a while, but it's almost certainly tailored to me and has some blind spots to other workflows.
>
> It has a relatively coherent philosophy, but is still messy and contradictory in places.
>
> Thoughtful PRs are welcome and encouraged!

## Jif's Worldview

jif is meant to be lived in – I keep it open in a split pane all day. It comes out-of-the box with thoughtful ergonomics and creature comforts, and tries hard to always do what you expect. And—leaning into Jujtusu's philosophy—everything is undoable.

It's also designed to be moldable, so you can shape it to fit how you work. The configuration system is vim- or emacs-esque: it's TypeScript executed at runtime, with all the app state and internal commands exposed. Nothing is intentionally hidden or artificially restricted.

Even if you don’t want a TUI, it’s a pretty nice place for just writing jj commands: intelligent autocomplete of subcommands, flags, and context-sensitive argument types – while the log is visible and scrollable above.

## Prerequisites

`jif` shells out to the real `jj` binary, so `jj` must be installed and available on `PATH`.

## Install

Prebuilt binaries are available for macOS and Linux (arm64 and x64).

**Homebrew** (macOS and Linux):

```bash
brew install jrpat/jif-tap/jif
```

**Shell installer** (installs to `$XDG_BIN_HOME` or `~/.local/bin`; set `JIF_VERSION` or `JIF_INSTALL_DIR` to override):

```bash
curl -fsSL https://raw.githubusercontent.com/jrpat/jif/main/install.sh | sh
```

**mise** (via the [ubi](https://mise.jdx.dev/dev-tools/backends/ubi.html) backend):

```bash
mise use -g ubi:jrpat/jif
```

**Manual**: download an archive for your platform from the [releases page](https://github.com/jrpat/jif/releases) and put `jif` on your `PATH`. Checksums are published in `SHA256SUMS`, and every asset carries build provenance you can check with `gh attestation verify <asset> --repo jrpat/jif`.

To build from source instead, see [Developing](#developing).

## Run

Launch the TUI against the current working directory:

```bash
jif
```

Print the installed version:

```bash
jif --version
```

## Keybindings

Press `?` in jif to show keybindings for the current mode, then press `?` again
while the panel is visible to focus its fuzzy filter. While editing the filter,
`?` is ordinary input and inserts a literal question mark. The filter searches
shortcut keys, command names, descriptions, ids, and mechanical key aliases
such as `option`, `control`, and `left arrow`. Space-separated terms narrow the
results independently, so their order does not matter and different terms can
match different fields. Each term must fuzzy-match within one word; a match
cannot stitch letters across spaces. Nonmatches are removed. Matches are ranked
by fzy relevance and laid out in reading order, left-to-right and then
top-to-bottom.

Bindings you define yourself in `keymap` get their own section at the top of the
panel, above the built-in ones, separated by a divider. Rebinding a built-in key
moves it into that section too. The section is omitted when your config has no
bindings for the current mode. See [Custom Keybindings](#custom-keybindings).

Press `enter` to apply a nonempty filter. The results and filter text remain
visible, but the underlying mode regains focus so every displayed shortcut can
be invoked immediately. Press `?` again to edit the applied filter. The first
`escape` (or `ctrl-c`) clears a filter and keeps the panel open; a second
`escape` closes the panel. Closing the panel also clears its filter.

<details>
<summary>Default Keybindings</summary>

Keybindings are per-mode. Global bindings are available in every mode and may be overridden by a mode-specific binding for the same key.

Log-oriented modes share a common **Log** binding set: linear movement, viewport positioning, the command bar, search, fast jump, help, preview, retry, and flag controls. Revision-backed modes additionally inherit **Revision Log Navigation**: graph movement (`J`/`K`), divergent sibling cycling (`alt-j`), bookmark and workspace jumps (`[`/`]`, `{`/`}`), and the working-copy jump (`@`). Normal and Bookmark inherit Revision Log Navigation; revision operation composers such as Rebase and Squash inherit it through an abstract **Revision Draft** mode, which adds `enter` to confirm and `space` to select revisions without inheriting revision-log-only commands from Normal. Operation Log and Evolog inherit only Log. Each mode is annotated below with what, if anything, it inherits.

When the shortcut panel is expanded, Revision Log Navigation commands keep it open so the inherited and mode-specific bindings remain visible in separate sections while focus moves.

### Global

Available in every mode (mode-specific bindings can override these).

| Key | Command | Description |
|-----|---------|-------------|
| `?` | shortcut-panel | Open the shortcut panel, or focus its filter while visible |
| `ctrl-r` | refresh-repository | Refresh the revision log |
| `ctrl+alt+r` | restart | Replace the current process image with a fresh plain `jif` invocation |
| `ctrl-,` | reload-config | Reload config files and apply runtime settings |
| `ctrl-\` | toggle-dry-run | Toggle dry-run mode for direct jj commands |
| `ctrl-z` | suspend | Suspend the application and return to the shell |
| `ctrl-n` | search-next | Jump to the next search match (no-op when no search is active) |
| `ctrl-p` | search-prev | Jump to the previous search match (no-op when no search is active) |
| `ctrl-j` | scroll-help-down | Scroll the visible help toast down one line (in Normal, Files, Operation Log, and Evolog this scrolls the [preview](#preview-pane) instead when it is shown) |
| `ctrl-k` | scroll-help-up | Scroll the visible help toast up one line (in Normal, Files, Operation Log, and Evolog this scrolls the [preview](#preview-pane) instead when it is shown) |
| `escape` | cancel | Cancel command composition, leave input mode, or return from a file filter to the log |
| `` ` `` | open-notifications | Open the notifications history panel |
| `` alt-` `` | open-releases | Open the [jif releases page](https://github.com/jrpat/jif/releases) on GitHub in your default browser |

`ctrl+alt+r` atomically replaces the running process image with a fresh plain `jif` invocation. The PID and terminal job stay the same, but no application or Bun runtime state survives; startup flags from the old process are intentionally not repeated.

### Preview

Controls for the [preview pane](#preview-pane). Available in Normal, secondary revision modes, Operation Log, and Evolog through the shared Log bindings; Files defines the same controls directly.

| Key | Command | Description |
|-----|---------|-------------|
| `p` | toggle-preview | Show or hide the preview pane for this session |
| `d` | show-diff | Enter Preview mode with the pane taking over the whole screen |
| `alt+p` | cycle-preview-position | Cycle the pane between auto, right, and below |
| `shift+w` | toggle-preview-word-wrap | Wrap or unwrap long preview diff lines |
| `ctrl+enter` | toggle-preview-full-file | In Files mode, toggle effectively full-file preview diffs using a large `jj --context` value |
| `ctrl+[` | expand-preview | Grow the pane by `preview.resizeStepPercent` |
| `ctrl+]` | shrink-preview | Shrink the pane by `preview.resizeStepPercent` |
| `ctrl+j` | scroll-preview-down | Scroll the preview down (falls back to the help toast when the pane is hidden) |
| `ctrl+k` | scroll-preview-up | Scroll the preview up (falls back to the help toast when the pane is hidden) |

`ctrl+[` / `ctrl+]` require a terminal that distinguishes them from other keys via the Kitty keyboard protocol (kitty, Ghostty, WezTerm, recent iTerm2, Alacritty, foot). In terminals without it, `ctrl+[` is indistinguishable from Escape.

Preview mode is entered with `d`. Its full-screen takeover leaves the shortcut
panel collapsed so the diff gets all available space; press `?` whenever you
want to see its controls. Press `?` again to filter those controls. `escape`
clears the filter first, then dismisses the panel, and only then exits Preview
mode:

| Key | Description |
|-----|-------------|
| `j` / `k` | Scroll down / up one line |
| `shift+j` / `shift+k` | Scroll down / up ten lines |
| `ctrl+d` / `ctrl+u` | Scroll down / up half a page |
| `ctrl+f` / `ctrl+b` | Scroll down / up a whole page |
| `alt+p` | Cycle the pane between auto, right, and below |
| `w` | Toggle word wrap |
| `ctrl+enter` | In Files, toggle effectively full-file preview context |
| `space` | Toggle between the full-screen preview and the split pane |
| `escape` / `q` | Exit Preview mode |

Every key but `escape` and `q` keeps Preview mode active. Preview mode does not resize the pane — `space` picks between the two layouts, and `ctrl+[` / `ctrl+]` size the split from the log, where the space it is taking from is visible.

#### Full-screen preview

`d` enters Preview mode with the pane taking over the whole screen — the same content, controls, and mode the split pane offers, just without the log beside it. It works in Normal, Files, and Evolog, and it does not need the split pane to be on screen first: the takeover is independent of `p` and of the narrow-terminal rules in [`preview.whenNarrow`](#configuration). `space` switches to the split layout from there, so one key reaches both.

Leaving the takeover with `space` always lands on a visible split pane: if the pane was hidden for this session it is shown, and if the `auto` layout would still hide it on this terminal, its position is pinned to the side that layout resolves to (announced with the usual position toast).

`escape` or `q` exits Preview mode entirely, dropping both the takeover and any pinned diff. The composers `ctrl+d` and `i` pin their result here rather than in the [diff viewer](#diff-viewer); while a diff is pinned the pane shows it instead of following the cursor, and the header carries the exact `jj` command that produced it.

### Normal

Viewing and navigating the revision log.

#### Navigation

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` | move-down | Move through revisions or files |
| `k` / `↑` | move-up | Move through revisions or files |
| `)` / `(` | scroll-log-down-half-page / scroll-log-up-half-page | Scroll the main log down / up by half a page |
| `z` | center-focused-row | Center the focused revision in the viewport |
| `J` | move-parent | Follow the graph to the nearest visible parent, skipping branches |
| `K` | move-child | Follow the graph to the nearest visible child, skipping branches |
| `alt-j` | jump-to-next-divergent | When the focused revision is divergent (showing the `/N` suffix), cycle to the next visible sibling sharing its change-id |
| `]` | move-to-next-bookmark | Jump down to the next visible revision that has a bookmark, without wrapping |
| `[` | move-to-prev-bookmark | Jump up to the previous visible revision that has a bookmark, falling back to `@` when there is none |
| `}` | move-to-next-workspace | Jump down to the next visible revision that has a workspace, without wrapping |
| `{` | move-to-prev-workspace | Jump up to the previous visible revision that has a workspace, falling back to `@` when there is none |
| `tab` | switch-active-workspace | Make the focused workspace marker the active workspace |
| `@` | jump-to-working-copy | Jump to the working-copy revision |
| `G` | jump-to-bottom | Jump to the last revision in the log |

`J`/`K`, `alt-j`, `[`/`]`, `{`/`}`, and `@` come from the shared Revision Log Navigation bindings, so they remain available while composing revision operations such as Rebase or Squash. `tab` is Normal-only because it changes the active workspace rather than merely moving revision focus.

When the focused revision has multiple workspace chips, `tab` switches to the first one if none is active; otherwise it moves to the chip after the active workspace, wrapping to the first.

#### View

| Key | Command | Description |
|-----|---------|-------------|
| `h` / `←` | collapse | Close the focused detail view |
| `l` / `→` | expand | Open changed files for the focused revision |
| `L` | edit-revset | Change which revisions are displayed |
| `ctrl-f` | find-file | Search jj-known files and show revisions that changed the selected file |
| `/` | search | Incremental search through the revision log |
| `f` | fast-jump | Incremental jump by revision ID, bookmark, or workspace name, clearing highlights on Enter |
| `_` | cycle-layout | Rotate loose, normal, and tight layouts |
| `ctrl-enter` | expand-diff-context | Note that extra diff context is available only when viewing a single file's diff — expand a revision and focus a file, where `ctrl-enter` toggles full-file context |

When the active revset is only `files(...)`, the collapsed status bar shows a `file` chip at the left and starts its shortcuts with `esc log`. Pressing Escape restores the most recent saved revset that is not another pure file filter; if none exists, jif falls back to the configured `revsets.log` value or jj's default log revset.

#### Revision operations

| Key | Command | Description |
|-----|---------|-------------|
| `a` | abandon | Abandon the selected revisions, or the focused revision when nothing is selected |
| `A` | absorb | Start an absorb operation, preselecting the default target revisions |
| `c` | commit | Commit the working-copy revision (`@`) |
| `d` | show-diff | Show the focused revision's or file's diff as a [full-screen preview](#full-screen-preview) |
| `ctrl-d` | diff | Show the combined diff of a range of revisions (`jj diff -r <first>::<last>`) |
| `D` | describe | Edit description of the focused revision |
| `e` | edit-revision | Edit the focused revision |
| `E` | diff-edit-revision | Touch up the focused revision's changes in your configured diff editor (`jj diffedit -r <focused>`) |
| `i` | interdiff | Show the interdiff between the focused revision and another |
| `M` | set-parents | Change the focused revision's parents, toggling revisions to add or remove them as parents (megamerge) |
| `n` | new-revision | Create a new revision from the focused revision |
| `alt-n` | new-between | Create a new revision inserted between revisions (`jj new -A <selected> -B <focused>`) |
| `r` | rebase | Start a rebase from the focused revision |
| `R` | restore-revision | Restore the focused revision from another |
| `y` | duplicate | Copy the focused revision to another location (same target picker as rebase) |
| `alt-r` | revert | Create a new revision that undoes the focused revision (same target picker as rebase) |
| `s` | squash | Squash the focused revision into another |
| `S` | squash-onto | Keep the focused revision as the target and select the branch above it (the revision directly above and its descendants) as the source |
| `ctrl-s` | split | Split the focused revision |
| `alt-s` | split-parallel | Split the focused revision into sibling commits sharing its parent (`jj split --parallel`) |
| `u` | undo | Undo the last operation |
| `alt-u` | redo | Redo the last undone operation |
| `space` | toggle-revision-selection | Add or remove the focused revision from the selection |

After the first selection, focus moves down. Later selections move focus in the
same direction as the step from the previously selected revision to the newly
selected one, so selecting upward continues upward and selecting downward
continues downward. Removing a revision from the selection leaves focus in
place.

The revision-level split bindings are available only in the revision log, not while composing another operation. Files mode has its own `s` binding for splitting the current file selection.

#### Miscellaneous

| Key | Command | Description |
|-----|---------|-------------|
| `:` / `ctrl-;` | command-bar | Run a jj subcommand |
| `g` | git-command-bar | Open the command bar prefilled with `git ` so git subcommands complete immediately |
| `>` | shell-command-bar | Run a shell command |
| `ctrl-o` | open-operation-log | Open the repository operation log |
| `ctrl-e` | open-evolog | Open the evolution log for the focused revision |
| `q` | quit | Exit the application |
| `!` | force-last-command | Retry the latest retryable command with the override flag `jj` is asking for:<br>• `--ignore-immutable` — when the command refused because the target is immutable<br>• `--allow-backwards` — when a bookmark move was rejected as backwards/sideways<br>• `--include-ignored` — when `jj file track` warned that it refused to snapshot some files |
| `-` | toggle-flags | Toggle the command bar between short and long flag names while composing a command |
| `;` | enter-extra-mode | Enter Extra mode, a clean-slate scope for keys you define yourself in `keymap.extra` |

### Files

Active when a revision is expanded and a file is focused. Self-contained — it does **not** inherit Normal, so revision-level operations (rebase, squash, new, …) are unavailable here; collapse back with `h` to reach them. Undo and redo retain their Normal bindings, and `_global` shortcuts (quit, escape, refresh, …) remain available.

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` / `l` | move-down | Focus the next file |
| `k` / `↑` | move-up | Focus the previous file |
| `h` / `←` | collapse | Collapse the file list and return to the revision |
| `space` | toggle-file-selection | Add or remove the focused file from the selection |
| `a` | select-all-files | Select every changed file, or clear the selection if all are already selected |
| `s` | split | Split the selected files, or the focused file when nothing is selected |
| `d` | show-diff | Show the focused file's diff as a [full-screen preview](#full-screen-preview) |
| `r` | restore | Restore selected files to their state before this change |
| `ctrl-u` | untrack | Stop tracking the focused file, or all selected files (`jj file untrack <paths>`) |
| `u` | undo | Undo the last operation |
| `alt-u` | redo | Redo the last undone operation |
| `ctrl-f` | restrict-revset-to-focused-file | Show revisions that changed the focused file |
| `/` | filter-files | Narrow the changed-file list to paths matching what you type |
| `:` | command-bar | Run a jj subcommand |
| `>` / `ctrl-.` | shell-command-bar | Run a shell command |

`a` (select-all-files) is scoped to the files currently visible, so while a filter is active it selects — or clears — only the matching files and leaves selections made under an earlier query alone.

### Filter Files

Press `/` in Files mode to filter the changed-file list. A `/ ` prompt appears at the top of the list and narrows it to files whose path contains what you type, matched case-insensitively; the matching part of each path is highlighted with inverse video. Renames match on either side of their `src/{old => new}.ext` display form.

Self-contained and input-first: every printable key is filter text, so none of the Files actions are bound here. Only the keys a text input cannot produce stay live — `escape`/`ctrl-c` and the arrows below, plus the `_global` shortcuts.

| Key | Command | Description |
|-----|---------|-------------|
| `↓` | move-down | Focus the next matching file |
| `↑` | move-up | Focus the previous matching file |

- **Enter** dismisses the input but keeps the filter applied. You return to Files mode with the list still narrowed, so `space`, `r`, `ctrl-u`, and the rest operate on the matches.
- **Escape (first press)** clears the filter and restores the full list. From Files mode a committed filter is cleared the same way, before a second Escape collapses the revision.
- File selections survive filtering, including selections on files the query hides — the composed command still names every selected file.
- Collapsing the revision, or moving to another one, drops the filter.

### Rebase

Active while previewing a rebase. Inherits Revision Draft, not Normal revision operations. The default composition is `jj rebase -r <source> -d <target>`; each key below switches one knob of that composition and can be pressed again to toggle back to the default.

`space` selects either additional **subjects** (more `-r` sources, the Normal-mode behavior) or additional **targets** (more destinations, e.g. `-d a -d b` to rebase onto a merge). The default follows the source kind: plain `-r` selects subjects, while `--source`/`--branch` — whose subjects are already fixed — select targets; `ctrl-space` toggles between the two behaviors (switching the source kind resets the toggle). Pinned targets keep their `onto`/`before`/`after` chips wherever the cursor goes, and the cursor-following default target is disabled until every pin is toggled off again. Pinned rows are tinted blue (chip, row background, and border — `rowPinnedTargetAccent`/`rowPinnedTargetFill`/`rowBorderPinnedTarget`). A row's background always follows its chip — so the focused row stays magenta while it carries the magenta `onto` chip, whatever `space` is set to do — and the focus highlight only turns blue in target-picking mode once pins exist and the cursor-following chip is gone, previewing the pin `space` would add.

| Key | Command | Description |
|-----|---------|-------------|
| `s` | rebase-descendants | Toggle `--source` (move the focused revision and its descendants) |
| `B` | rebase-source-branch | Toggle `--branch` (rebase the whole branch containing the focused revision) |
| `b` | rebase-target-before | Toggle `--insert-before` on the target |
| `a` | rebase-target-after | Toggle `--insert-after` on the target |
| `i` | rebase-target-insert-between | Pin the focused revision as `--insert-after`; navigate to pick `--insert-before` |
| `e` | rebase-toggle-skip-emptied | Toggle `--skip-emptied` |
| `space` | rebase-toggle-selection | Select an additional rebase subject or target, per the current spacebar behavior |
| `ctrl-space` | rebase-toggle-selection-kind | Toggle whether `space` selects additional subjects or additional targets |

### Duplicate

Pressing `y` from Normal mode enters Duplicate mode against the focused revision. Inherits Revision Draft, not Normal. Composes `jj duplicate <source> -d <target>`; the source is tagged with a `copy` chip and the destination with an `onto` chip. Navigate to choose the target (or select more sources with `space`), then `enter` to run. Duplicate copies the revisions to the new location without touching the originals, so it has no `--source`/`--branch` knobs — only the destination picker below.

| Key | Command | Description |
|-----|---------|-------------|
| `b` | rebase-target-before | Toggle `--insert-before` on the target |
| `a` | rebase-target-after | Toggle `--insert-after` on the target |
| `i` | rebase-target-insert-between | Pin the focused revision as `--insert-after`; navigate to pick `--insert-before` |

### Revert

Pressing `alt-r` from Normal mode enters Revert mode against the focused revision. Inherits Revision Draft, not Normal. Composes `jj revert -r <source> -d <target>`, which creates a *new* revision undoing the source's changes at the chosen location — distinct from `revert-operation`, which targets the op log. The source is tagged with a `revert` chip and the destination with an `onto` chip; navigate to choose the target, then `enter` to run. Shares the same destination picker as Rebase and Duplicate.

| Key | Command | Description |
|-----|---------|-------------|
| `b` | rebase-target-before | Toggle `--insert-before` on the target |
| `a` | rebase-target-after | Toggle `--insert-after` on the target |
| `i` | rebase-target-insert-between | Pin the focused revision as `--insert-after`; navigate to pick `--insert-before` |

### Squash

Active while previewing a squash. Inherits Revision Draft, not Normal. Composes `jj squash -f <source> -t <focused>`; navigate to choose the target revision, then `enter` to run.

Two keys from Normal mode enter squash mode:

- `s` (squash) selects the focused revision as the source and moves focus down to its parent, which becomes the target — squash the focused revision into the one below it.
- `S` (squash-onto) keeps the focused revision as the target and selects the whole branch above it as the source: the revision directly above plus every descendant of it shown in the log. When revisions are already selected, the lowest selected revision anchors the branch instead. Each source revision is a real selection, so they all show as selected — squash the revisions above into the focused one.

| Key | Command | Description |
|-----|---------|-------------|
| `s` | squash-from-anchor | Toggle whether the source extends to a range `<source>::<anchor>`, where `<anchor>` is `@` if the working copy is non-empty, otherwise `@-`. `S` is an alias here, so you can keep toggling with either case |

### Restore

Active while previewing a restore. Inherits Revision Draft, not Normal. Composes `jj restore -f <source> -t <focused>`; navigate to choose the target revision, then `enter` to run.

### Interdiff

Active while previewing an interdiff. Inherits Revision Draft, not Normal. Composes `jj interdiff -f <source> -t <focused>`; navigate to choose the target revision, then `enter` to run. The output is pinned into a [full-screen preview](#full-screen-preview).

| Key | Command | Description |
|-----|---------|-------------|
| `=` | interdiff-swap | Swap which side is `--from` and which is `--to`: the selected revision becomes `--to` and the focused revision becomes `--from`. Press again to swap back |

### Diff

Active while previewing the diff of a range of revisions. Inherits Revision Draft, not Normal.

Pressing `ctrl-d` makes the focused revision the **first** revision of the range and moves the cursor to its child, since a range only reads forward through the graph; navigate to choose the **last** revision, then `enter` to run. The default composition is `jj diff -r <first>::<last>`, whose endpoints are *both* part of the result — the chips say `first` and `last` to make that readable at a glance. The output is pinned into a [full-screen preview](#full-screen-preview).

| Key | Command | Description |
|-----|---------|-------------|
| `=` | diff-cycle-range-kind | Switch between the inclusive range and `jj diff -f <source> -t <focused>`, which compares the two trees and so leaves out the source's own change (chips become `from` and `to`) |
| `s` | diff-descendants | Stretch the range over every descendant of the first revision (`jj diff -r <first>::`), dropping the `last` chip and marking every revision the range folds together |

A range is empty unless the last revision descends from the first, and an empty range produces an empty diff rather than an error — press `=` to compare two revisions that are not related that way. `s` handles a fan-out too: when the descendants have several heads, jj merges them into a single diff rather than refusing.

### Absorb

Active while composing an absorb. Inherits Revision Draft, not Normal. The source is the revision focused when you pressed `A`, tagged with an `absorb` chip, and its mutable ancestors (the revisions `jj absorb` would consider by default) are preselected, each tagged with an `into` chip. Use `space` to toggle candidate targets — like selecting in Normal mode, the focus advances to the next revision on each toggle — then `enter` to apply, or `escape` to cancel. Leaving the preselected set unchanged runs plain `jj absorb` (with `--from <source>` when the source is not the working copy); changing it constrains the operation with `--into <selected revisions>`.

| Key | Command | Description |
|-----|---------|-------------|
| `s` | absorb-descendants | Replace the selected `--into` targets with the visible chain from the focused revision, stopping before the absorb source |

### Set Parents

Pressing `M` from Normal mode enters Set Parents mode against the focused revision — the **subject** of the operation, tagged with a `subject` chip and the command-target highlight. Inherits Revision Draft, not Normal, so navigate with the shared Log and Revision Log Navigation keys (and incremental search with `/`). Use `space` to toggle a revision into the working parent set: a revision that is already a parent of the subject is tagged `remove` and will be dropped, while any other revision is tagged `add` and will be joined in as a co-parent — this is how you build a "megamerge". The command bar previews `jj rebase -r <subject> -d <parent> …` with the resulting parent set; `enter` runs it, `escape` cancels. The preview reflects today's parents until you change something, and running is blocked while the change would leave the subject with no parents. If the rebase is refused as immutable, retry it with `!`.

### New Between

Pressing `alt-n` from Normal mode enters New Between mode. The revisions selected when you enter (or the focused revision if nothing is selected) become the `--insert-after` sources, each tagged with an `after` chip. The `--insert-before` target defaults to the focused revision — tagged `before` — and follows the cursor; navigate to place the new revision, then `enter` to run. Inherits Revision Draft, not Normal.

Use `space` to pin one or more explicit `--insert-before` targets: pinned revisions keep their `before` chips wherever the cursor goes, and the cursor-following default is disabled until every pin is toggled off again. The composed command is `jj new -A <source>… -B <target>…`. When one revision would be both the insert-after and insert-before target — the initial state, since focus starts on the sole source — the insertion degenerates to creating a plain child, and jif falls back to `jj new <revision>`.

### Bookmark

Pressing `b` from Normal mode enters Bookmark mode and waits for the next keystroke. It inherits Revision Log Navigation, not Normal. Each sub-key opens a `jj bookmark` flow scoped to the focused revision. Press Escape to leave Bookmark mode without doing anything.

| Key | Command | Description |
|-----|---------|-------------|
| `c` | bookmark-create | Open the command bar with `b create  -r <focused>` and the cursor positioned to type a new bookmark name |
| `m` | bookmark-move-from | Begin a bookmark move from the focused revision; navigate to pick the destination, then `enter` to run `b move -f <from> -t <to>` |
| `M` | bookmark-move-to | Open the command bar with `b move  -t <focused>` and bookmark-name autocomplete sorted by graph distance to the focused revision |
| `d` | bookmark-delete | Open the command bar with `b delete ` and bookmark-name autocomplete |
| `f` | bookmark-forget | Open the command bar with `b forget ` and bookmark-name autocomplete |
| `s` | bookmark-set | Open the command bar with `b set  -r <focused>` and bookmark-name autocomplete |
| `t` | bookmark-track | Open the command bar with `b track ` and autocomplete for local names plus every exact `name@remote` bookmark symbol |
| `u` | bookmark-untrack | Open the command bar with `b untrack ` and bookmark-name autocomplete |
| `C` | bookmark-copy-name | Copy the focused revision's bookmark name to the system clipboard |

Copy takes the focused revision's own bookmarks, without jj's sync (`*`) or conflict (`??`) markers. A single bookmark goes straight to the clipboard and reports as a toast. When the revision carries several, the shell command bar opens instead with `printf %s  | pbcopy` (the platform's clipboard writer: `pbcopy`, `clip`, `wl-copy`, or `xclip -selection clipboard`), the cursor in the name slot, and those bookmarks as the suggestion list.

Bookmark autocomplete is sorted with the closest ancestor bookmark first (visually at the bottom of the suggestion list), then more distant ancestors, then descendants by ascending distance, then any unrelated bookmarks. For Move-to, bookmarks already pointing at the focused revision are excluded; for the other prompts they appear at the highest priority (closest to the cursor). Track puts exact remote bookmark symbols first and includes tracked and untracked bookmarks from every remote.

### Search

Press `/` from the revision log, operation log, or evolog to start an incremental search. Matching text is highlighted with inverse video as you type, and focus snaps to the first match. Press `f` from the same views to start a fast jump: in the revision log it matches only revision IDs, bookmark names, and workspace names, excluding commit descriptions. Enter clears the query and highlights immediately after moving focus.

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

Active while the operation log panel is open. Inherits the shared **Log** bindings (movement, `:`, `>`, `/`, `f`, `?`, and the preview controls); it does **not** inherit Normal, so revision operations are unavailable. Only the operation-specific keys below are its own.

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` | move-down | Focus the next operation |
| `k` / `↑` | move-up | Focus the previous operation |
| `z` | center-focused-row | Center the focused operation in the viewport |
| `G` | jump-to-bottom | Jump to the last operation in the log |
| `@` | jump-to-current-operation | Jump to the current operation (top of the log) |
| `r` | restore-operation | Restore the focused operation |
| `R` | revert-operation | Revert the focused operation |
| `d` | show-operation-diff | Show repository changes for the focused operation |
| `:` | command-bar | Run a jj subcommand |
| `>` | shell-command-bar | Run a shell command |
| `/` | search | Incremental search through the operation log |
| `f` | fast-jump | Incremental search through the operation log, clearing highlights on Enter |

### Evolog

Active while the evolog panel is open. Opened from Normal with `ctrl-e` for the focused revision. Inherits the shared **Log** bindings (movement, `:`, `>`, `/`, `f`, `?`, and the preview controls); it does **not** inherit Normal. Apart from `d`, every key below comes from the shared Log set.

| Key | Command | Description |
|-----|---------|-------------|
| `d` | show-diff | Show the focused entry's diff as a [full-screen preview](#full-screen-preview) |
| `j` / `↓` | move-down | Focus the next evolog entry |
| `k` / `↑` | move-up | Focus the previous evolog entry |
| `z` | center-focused-row | Center the focused evolog entry in the viewport |
| `G` | jump-to-bottom | Jump to the last evolog entry |
| `:` | command-bar | Run a jj subcommand |
| `>` | shell-command-bar | Run a shell command |
| `/` | search | Incremental search through the evolog |
| `f` | fast-jump | Incremental search through the evolog, clearing highlights on Enter |

### Notifications

Active while the notifications history panel is open. Does not inherit Normal.
Command-generated toasts and notification cards show `❯` followed by the executed command immediately above its output, styled in the matching status color. Every notification card leaves a blank line below its status header.

| Key | Command | Description |
|-----|---------|-------------|
| `j` / `↓` | move-down | Focus the next notification |
| `k` / `↑` | move-up | Focus the previous notification |
| `G` | jump-to-bottom | Jump to the last notification |
| `l` / `→` | expand-notification | Show all lines of the focused notification |
| `h` / `←` | collapse-notification | Truncate the focused notification |
| `alt-enter` | rerun-notification-command | Re-run the command that created the focused notification |
| `ctrl-g` | edit-notification | Open the focused notification's text in `$EDITOR` (falls back to `vi`) |
| `` ` `` | cancel | Close the notifications panel |

### Diff Viewer

Active while the full-screen diff viewer is open. Does not inherit Normal. The operation log's `d` opens it, so that `jj op diff` keeps the "Changed commits" annotations wrapped around its patches — every other diff now renders in the [full-screen preview](#full-screen-preview) instead.

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
| `ctrl-h` | (`:` jj command bar) Toggle between complete-at-point and command history, regardless of what is typed. The bar always opens in complete-at-point; switching into history is a no-op when there is none. With an empty input, typing `:` (the first-and-only character) does the same toggle — the `:` is consumed as a command, not inserted as text. The alternate view (history) is shown with a double border; the default view (complete-at-point) uses the plain single border |
| `ctrl-x` | Delete the highlighted suggestion from saved history (no-op for suggestions from non-history sources like subcommand, flag, or revset completions) |
| `ctrl-l` | (revset prompt `L`) Toggle the suggestion list between revset-function completions (the default view, single border) and previously applied revsets (the alternate view, double border). (file search prompt `ctrl-f`) Open the revset prompt seeded with the selected `files("path")` revset before applying it |
| `ctrl-'` | (`:` and `>` command bars) Insert the focused item's id at the cursor: the revision's shortest unique change-id prefix in Normal, the operation id in Op Log, the entry id in Evolog |
| `enter` | Submit the current input (run the command, apply the revset, finalize the search). In the `:` jj command bar's complete-at-point, if you have moved to a suggestion, `Enter` accepts it instead (the same as `Tab`) |
| `ctrl-c` | Cancel the active prompt, same as Escape |

</details>

## Configuration

jif configuration is TypeScript evaluated at runtime, so settings can be simple data or code that composes with the app state and command helpers, the API for which is installed as a `.d.ts` file alongside your user config.

Configuration layers start with built-in defaults, then merge user, project-local, and CLI-provided files on top.

<details>
<summary>Init config</summary>

Run `jif init-config` to create a starter user config. The command creates:

- `config.ts` with a placeholder `Jif.Config` shape and commented examples
- `jif.d.ts` with editor-facing types for autocomplete and inline docs, updated in the background after jif starts

If a config file already exists, `jif init-config` leaves it alone and only fills in missing support files.

jif updates the generated `jif.d.ts` in the background after the initial UI is ready for your user config directory, or next to the file passed with `--config`, so editor type hints stay current after upgrades.
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

In a workspace created with `jj workspace add`, jif first loads the default workspace's `.jj/jif/` config, then merges the current workspace's config on top if it has one. Put shared repository settings in the default workspace and keep only workspace-specific overrides in the other workspaces.

`.jj` is jj's own untracked workspace metadata directory, so a checkout of a third-party repository can never deliver TypeScript that jif will execute. Anything in there got there because you put it there.

Workspace resolution uses `jj workspace root`, so this works from any subdirectory of the workspace and respects whatever jj considers the workspace root. Jif follows the current workspace's `.jj/repo` pointer to locate the default workspace.

</details>

<details>
<summary>Config Layers</summary>

Configuration is assembled as a stack of layers, deep-merged from bottom to top. Later layers win on conflicting keys; values left `undefined` by a later layer do not clobber the earlier value.

The stack, from lowest to highest precedence:

1. Built-in defaults
2. `--config-base FILE` layers, in the order they appear on the command line
3. The user config (the file discovered in the jif config directory, or the file passed to `--config`)
4. The default workspace's project config at `<default-workspace>/.jj/jif/config.{ts,js}`, if the current workspace is not the default
5. The current workspace's project config at `<workspace>/.jj/jif/config.{ts,js}`, if present
6. `--config-override FILE` layers, in the order they appear on the command line

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

Palette detection waits 50ms after the last color answer before falling back for anything the terminal left unanswered. jif keeps listening for the terminal's default-background answer after that startup deadline and reapplies its colors if the answer arrives late, so a slow response may cause a brief color change but will not leave the fallback theme in place. To avoid that change by waiting longer before the first frame (for example over a slow SSH connection), set the `OTUI_PALETTE_IDLE_TIMEOUT_MS` environment variable to a higher value.

Autocomplete suggestion focus is controlled separately from revision-row focus. Override `colorScheme.colors.promptSuggestionFocusedFill` to change the highlighted suggestion background without changing `rowFocusedFill`. The revision-row `rowFocusedFill` value is the anchor used by the most compact (`tight`) layout; `normal` and `loose` use 75% of its intensity against the terminal background (6.75% foreground opacity with the default theme).

When navigating an expanded revision's files, the whole file group uses the subtle `fileGroupFocusedFill`, while the focused file row uses the stronger `fileFocusedFill`. A selected focused file keeps `rowSelectedFill`, so selection remains visible under the file cursor.

While composing a command, any row carrying a command chip tints its background and border with a dim version of the chip color — magenta for the cursor-following target (`revsetPrefix` paired with `rowDraftFocusedFill`/`rowBorderDraftFocus`), green for selected sources (`rowSelectedAccent`/`rowSelectedFill`/`rowBorderSelected`), blue for pinned targets (`rowPinnedTargetAccent`/`rowPinnedTargetFill`/`rowBorderPinnedTarget`) — so a chip and its row background can never disagree. The focus highlight itself is contextual and applies only to a chip-less focused row: a neutral grey while browsing (`rowFocusedFill`/`rowBorderFocus`, foreground-derived), the draft accent while composing (`rowDraftFocusedFill`/`rowBorderDraftFocus`), and the pinned-target blue in rebase's target-picking spacebar mode to preview the pin that `space` would add.

The preview pane's background defaults to the terminal foreground blended at 3% opacity against the terminal background. Override `colorScheme.colors.previewPaneFill` to tune it. The diff adapts to the terminal theme too: added and removed lines are blended from the palette's green and red against the terminal background, and syntax tokens use indexed ANSI foreground colors from the terminal palette. Override `colorScheme.colors.diffFileName`, `diffAddedFill`, `diffRemovedFill`, `diffAddedSign`, or `diffLineNumber` to tune the diff colors.

</details>

<details>
<summary>Refresh Settings</summary>

jif watches the repository's operation store (`.jj/repo/op_heads/heads`) and reloads the visible repository state whenever a jj operation completes — including operations run from another terminal or by a background agent. Watching uses filesystem events, so it costs nothing while the repository is untouched. Set `refresh.watch` to `false` to disable it:

```ts
export default {
  refresh: {
    watch: false,
    intervalMs: 5000,
  },
} satisfies Jif.Config;
```

Interval-based auto-refresh is disabled by default; the watcher usually makes it unnecessary. Set `refresh.intervalMs` to also reload on a timer — useful on filesystems where watching is unreliable (e.g. some network mounts). Set `intervalMs` to `0` to disable it. Positive values below `1000` are clamped to `1000` ms.

Watcher and interval refreshes are passive: jif reads the repository at a concrete operation head, which neither snapshots a working copy nor merges divergent operation heads. This keeps multiple jif instances from creating more operations while background agents are active. Watch events are coalesced into one refresh once the repository has been quiet for about a second, and consecutive watcher refreshes are spaced at least five seconds apart. Each delay also carries a small random offset so multiple instances do not all reload together. Passive refreshes also skip the UI update entirely when the loaded data is unchanged. Startup, regaining terminal focus, and pressing `ctrl-r` are full refreshes: they snapshot the current worktree and always re-apply, even when nothing changed.

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
<summary>Revision Descriptions</summary>

The loose layout wraps revision descriptions onto at most two lines by default.
Change that limit with `log.looseDescriptionMaxLines`:

```ts
export default {
  log: {
    looseDescriptionMaxLines: 3,
  },
} satisfies Jif.Config;
```

The value is floored and clamped to at least `1`. Normal and tight layouts keep
descriptions on one line.

</details>

<details>
<summary>Revision Chip Labels</summary>

Bookmark and workspace chip labels are untruncated by default. Set one maximum
length for every revision layout, or give each layout its own value:

```ts
export default {
  log: {
    bookmarkLabelMaxLength: 24,
    workspaceLabelMaxLength: {
      loose: null,
      normal: 18,
      tight: 12,
    },
  },
} satisfies Jif.Config;
```

A number limits the chip's content to that many characters and uses OpenTUI's
built-in truncation. `null` disables truncation, including for an individual
layout; layouts omitted from a per-layout object also default to `null`.

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

The [preview pane](#preview-pane) shows the diff of the focused item beside the log. These are its defaults:

```ts
export default {
  preview: {
    position: "auto",         // "auto" | "right" | "below"; auto uses right on wide terminals, below/hidden on narrow
    showByDefault: false,      // show the pane on startup (toggle in-session with `p`)
    defaultWidthPercent: 50,   // initial size as a percent of the terminal
    resizeStepPercent: 5,      // percent added/removed by ctrl+[ / ctrl+] and Preview mode H / L
    minSizePercent: 15,        // clamp for the size percent
    maxSizePercent: 90,
    narrowWidth: 100,          // in "auto", terminals narrower than this are "too narrow" for the right layout
    whenNarrow: "below",       // in "auto", what to do when too narrow: "below" (relocate) or "hide"
    wordWrap: true,            // wrap long preview diff lines by default
    splitViewWidth: 160,       // pane width at which diffs go side-by-side; 0 always keeps them unified
  },
} satisfies Jif.Config;
```

Diffs render unified in a narrow pane and side-by-side once it is at least `preview.splitViewWidth` columns wide — side-by-side gives each half of a diff only half the pane, so it needs roughly twice the room to stay readable. The threshold follows the pane, not the terminal, so growing the pane with `ctrl+[` or opening a diff [full-screen](#full-screen-preview) can switch a diff to side-by-side on its own. Set `splitViewWidth: 0` to keep every diff unified at any width.

Long diff lines wrap by default. Use `shift+w` to turn wrapping off for the current session; unwrapped unified diffs scroll horizontally, while unwrapped side-by-side diffs truncate because each half stays pinned to half the pane.

Position, visibility, size, and word wrap can also be changed for the current session with `p`, `alt+p`, `ctrl+[` / `ctrl+]`, and `shift+w`; `d` opens the pane's dedicated Preview mode [full-screen](#full-screen-preview), and `space` switches that to the split layout. Those session changes are not persisted.

</details>

## Custom Keybindings

Custom keybindings live under the top-level `keymap` field in your config. They can rebind built-in commands or run arbitrary code against the live app state. The shortcut panel lists them in their own section above the built-in bindings, so `?` always answers what you bound yourself first.

<details>
<summary>Syntax</summary>

User keymaps are deep-merged into the built-in defaults, so adding one binding does not replace the rest of the default map.

You can rebind an existing built-in command by id:

```ts
export default {
  keymap: {
    "revision-log": {
      J: "move-down",
    },
  },
} satisfies Jif.Config;
```

Set a binding to `null` to disable that key in a scope. A null binding overrides inherited and global bindings and is omitted from the shortcut panel:

```ts
export default {
  keymap: {
    "revision-log": {
      "ctrl-o": null,
    },
  },
} satisfies Jif.Config;
```

Besides the concrete per-mode scopes (`revision-log`, `revision-files`, `op-log`, `evolog`, …) and `_global`, there are three shared scopes. `log` contains behavior common to scrollable history surfaces. `revision-log-nav` inherits `log` and adds revision-specific focus movement; Normal and Bookmark inherit it directly. `revision-draft` inherits `revision-log-nav` and is itself inherited by operation composers such as Rebase and Squash. Binding a key under a shared scope rebinds it for every descendant; a same-key binding in a child mode still overrides the inherited binding there.

The default revision graph, bookmark, workspace, divergent-sibling, and working-copy navigation bindings live in `revision-log-nav`. The jj command bindings (`:` / `ctrl-;`) and shell command bindings (`>` / `ctrl-.`) live in `log`. Opening a prompt preserves the current log surface behind it. The global `ctrl-\` binding toggles dry-run mode.

When dry-run mode is enabled, an action that would run a jj command directly opens the jj command prompt with that command prefilled instead. You can edit the command or press `enter` to submit it. Commands submitted from the prompt, internal repository reads, and shell commands continue normally. A bold `#` chip remains visible in the status area while the mode is enabled.

Or define an inline command directly in the keymap:

```ts
export default {
  keymap: {
    "revision-log": {
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
</details>

<details>
  <summary>‘Extra’ Mode</summary>

Pressing `;` enters Extra mode, a clean-slate scope for keys you define yourself in `keymap.extra`. The shortcut panel opens automatically and lists these bindings in the same fashion as it does the built-in app bindings.

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

Extra inherits neither Log nor Normal bindings, so the entire alphabetic keyspace is yours to bind without shadowing built-in commands.

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
| `abandonRevision()` | Abandon the selected revisions, or the focused revision when nothing is selected |
| `cancelOrBlur()` | Run the current mode's cancel action |
| `closeFocusedRevision()` | Collapse the focused revision details |
| `collapseNotification()` | Collapse the focused notification |
| `commit()` | Commit the working-copy revision |
| `confirm()` | Confirm the active command draft, prompt, or inline confirmation |
| `copyBookmarkName()` | Copy the focused revision's bookmark name, or open a shell copy prompt when it has several |
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
| `moveFocusToBookmark(direction)` | Move to the next (`1`) or previous (`-1`) visible bookmark; previous falls back to the working copy |
| `moveFocusToChild()` | Focus the nearest visible child revision |
| `moveFocusToNextDivergentSibling()` | Cycle to another visible divergent sibling |
| `moveFocusToParent()` | Focus the nearest visible parent revision |
| `moveFocusToWorkspace(direction)` | Move to the next (`1`) or previous (`-1`) visible workspace marker; previous falls back to the working copy |
| `switchWorkspace(workspaceName)` | Switch to any known JJ workspace by name, for example `cmd.switchWorkspace("review")` |
| `switchToFocusedWorkspace()` | Switch the active workspace to the focused workspace marker |
| `nextSearchMatch()` | Jump to the next search match |
| `openEvolog()` | Open the evolution log for the focused revision |
| `openFocusedRevision()` | Expand the focused revision details |
| `openNotifications()` | Open notification history |
| `openOperationLog()` | Open the repository operation log |
| `openReleasesPage()` | Open the jif releases page on GitHub in the default browser |
| `openFileSearch()` | Open the file search prompt |
| `openFastJump()` | Open fast jump in the current searchable view |
| `openRevsetInput(initialQuery?)` | Open the revset prompt, optionally seeded with draft text |
| `openSearch()` | Open search in the current searchable view |
| `prevSearchMatch()` | Jump to the previous search match |
| `quit()` | Exit jif |
| `redo()` | Redo the last undone repository operation |
| `refreshRepository()` | Refresh repository data |
| `rerunFocusedNotification()` | Re-run the command that created the focused notification |
| `restart()` | Replace the current process image with a fresh plain `jif` invocation |
| `restoreFiles()` | Restore the focused file or selected files |
| `restoreOperation()` | Restore the focused operation |
| `revertOperation()` | Revert the focused operation |
| `restrictRevsetToFocusedFile()` | Show revisions that changed the focused file |
| `scrollDiffViewer(rowDelta, colDelta)` | Scroll the diff viewer by rows and columns |
| `scrollLogPage(pageDelta)` | Scroll the main log by a fraction of its viewport (`0.5` is half a page) |
| `centerFocusedLogRow()` | Center the focused revision, operation, or evolog entry in the main log viewport |
| `scrollHelpToast(rowDelta)` | Scroll the visible help toast |
| `selectAllFiles()` | Select all files in the expanded revision, or clear them if all are selected |
| `selectNextInlineConfirmationOption()` | Move to the next inline confirmation option |
| `selectPreviousInlineConfirmationOption()` | Move to the previous inline confirmation option |
| `selectAbsorbDescendants()` | Select absorb targets from the focused revision, stopping before the absorb source |
| `setRebaseSourceKind(kind)` | Set rebase source kind: `"revisions"`, `"source"`, or `"branch"` |
| `setRebaseTargetKind(kind)` | Set rebase target kind: `"destination"`, `"insert-before"`, `"insert-after"`, or `"insert-between"` |
| `showDiff()` | Show the focused item's diff as a full-screen preview |
| `showOperationDiff()` | Show the focused operation diff |
| `startAbsorb()` | Start an absorb operation |
| `startBookmarkCreate()` | Open the bookmark create prompt for the focused revision |
| `startBookmarkDelete()` | Open the bookmark delete prompt |
| `startBookmarkForget()` | Open the bookmark forget prompt |
| `startBookmarkMoveFrom()` | Start moving a bookmark from the focused revision |
| `startBookmarkMoveTo()` | Open the bookmark move-to prompt for the focused revision |
| `startBookmarkSet()` | Open the bookmark set prompt for the focused revision |
| `startBookmarkTrack()` | Open the bookmark track prompt |
| `startBookmarkUntrack()` | Open the bookmark untrack prompt |
| `startDiff()` | Start composing the diff of a range of revisions |
| `startInterdiff()` | Start composing an interdiff |
| `startNewRevision()` | Create a new revision from the focused revision |
| `startRebase()` | Start composing a rebase from the focused revision |
| `startRestore()` | Start composing a restore from the focused revision |
| `startSplit()` | Start a split operation |
| `startSquash()` | Start composing a squash from the focused revision |
| `startSquashOnto()` | Start squash-onto with the focused revision as the target |
| `suspend()` | Suspend jif and return to the shell |
| `toggleFileSelection()` | Toggle the focused file selection |
| `toggleDryRun()` | Toggle previewing direct jj commands in the command prompt before execution |
| `toggleInterdiffSwap()` | Swap interdiff `--from` and `--to` roles |
| `cycleDiffRangeKind()` | Switch a diff draft between the inclusive `A::B` range and the `--from`/`--to` comparison |
| `toggleDiffDescendants()` | Stretch a diff draft's range over every descendant of its first revision |
| `togglePreviewFullFile()` | Toggle effectively full-file context for file preview diffs |
| `togglePreviewFullScreen()` | Toggle the preview between the full-screen takeover and the split pane |
| `togglePreviewWordWrap()` | Wrap or unwrap long preview diff lines |
| `toggleRebaseSelection()` | Toggle the focused revision as a rebase subject or additional target, per the current spacebar behavior |
| `toggleRebaseSelectionKind()` | Toggle whether rebase selection adds subjects or additional targets |
| `toggleRebaseSkipEmptied()` | Toggle `--skip-emptied` on a rebase draft |
| `toggleSearchIdOnly()` | Toggle ID-only search |
| `toggleSelection()` | Toggle the focused revision selection |
| `openShortcutFilter()` | Open the shortcut panel and focus its fuzzy filter |
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
| `dryRun` | `boolean` | Whether direct jj commands open in the command prompt before execution |
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
| `previewFullScreen` | `boolean` | Whether the preview pane has taken over the whole screen |
| `previewWordWrap` | `boolean` | Whether preview diff word wrap is enabled for this session |
| `repoPath` | `string` | Active workspace root jif is operating on |
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
| `shortcutFilterQuery` | `string` | Current shortcut-panel filter, or `""` when inactive |
| `shortcutPanelExpanded` | `boolean` | Whether the shortcut panel is expanded |
| `statusMessages` | `readonly StatusMessage[]` | Visible status messages |
| `useShortFlags` | `boolean` | Whether composed commands prefer short flags |
| `workspaceRefs` | `readonly WorkspaceRef[]` | Known workspaces and their root paths |

</details>


<details>
<summary>Aliases</summary>

Every binding shows up in the shortcut panel by default. To bind an alias key that should *not* appear in the panel, write the binding as an object with `canonical: false`:

```ts
export default {
  keymap: {
    "revision-log": {
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


## Preview Pane

A resizable pane beside the log shows the diff of whatever is focused, following your navigation.

<details>
<summary>What It Shows</summary>

The pane is active in Normal, Files, Operation Log, and Evolog:

- **Normal** — the full diff of the focused revision (all files), with change/commit IDs and author/committer signatures separated from the full description by a divider.
- **Files** — the diff of the focused file only.
- **Operation Log** — the diff of the focused operation (`jj operation diff`).
- **Evolog** — the diff of the focused evolution entry.

After a file heading scrolls past the top of a multi-file diff, its name remains pinned until the next file reaches the top.

In Files mode, `ctrl+enter` toggles the focused file preview between jj's compact diff context and a full-file diff. The same binding remains available after entering Preview mode.

</details>

<details>
<summary>Visibility and Placement</summary>

Press `p` to show or hide the pane; whether it shows on startup is controlled by `preview.showByDefault`.

By default the pane is placed automatically: on the right in wide terminals and below the log in narrow ones (narrower than `preview.narrowWidth` columns). Set `preview.whenNarrow` to `"hide"` to hide the pane on narrow terminals instead of relocating it below.

</details>

<details>
<summary>Line Wrapping</summary>

Line wrapping can be toggled in-app with `shift+w`, with `w` in Preview mode, and in config via `preview.wordWrap`. If not wrapped, the diff is horizontally scrollable via the mouse.

</details>


## Miscellaneous

<details>
<summary>Help</summary>

Most successful commands surface a short toast that fades on its own after a few seconds. Help output is different: running `help`, or any command ending in `-h` or `--help`, opens a blue-bordered toast that grows to fit the help text (up to half the terminal height) and stays until you dismiss it. It is not a mode of its own — the log keeps the keyboard, so `j`/`k` still navigate revisions while the help text is up, and `ctrl-j`/`ctrl-k` scroll the help toast itself by a line. Pressing `Esc` clears it, and so does running any other command (the next toast supersedes it).

</details>

<details>
<summary>Shell Commands</summary>

Shell commands invoked via `>` run in your login shell (`$SHELL -lc`) with the active workspace root as cwd. `cmd.sh()` and `cmd.shi()` from custom keybindings use the active workspace root by default, or `options.cwd` when provided. Login shells source `.zprofile` / `.bash_profile` / `.profile`, but **not** `.zshrc` / `.bashrc`, so aliases and functions defined only in your interactive rc files will not be available.

If you want an alias to work from `>`, define it somewhere a non-interactive shell will see it — for zsh, that's `.zshenv` (sourced for every invocation) or `.zprofile` (sourced for login shells); for bash, `.bash_profile` or `.profile`.

</details>

<details>
<summary>Command Composition</summary>

Every operation in jif — `rebase`, `squash`, `split`, `new`, `commit`, and the rest — composes a `jj` command. The command bar shows that command being assembled as you press keys, color-coded to match the TUI: the focused revision in magenta (its highlight color), selected revisions and files in green (the selection accent), etc…

You get the ergonomics of a TUI porcelain without the CLI being hidden from you, and over time the visible command bar teaches you the underlying `jj` commands.

Press `-` while composing to flip between short and long flag names. Press `:` at any time to drop into the command bar and type a `jj` subcommand directly — if a command is already being composed, `:` preserves it and lets you edit it as text before running.

The `:` command bar has two views: structured **complete-at-point**, and your **command history**. It always opens in complete-at-point, and you switch to history at any time with `ctrl-h`. With an empty input you can also just press `:` again — a `:` typed as the first-and-only character is treated as the toggle command rather than text, so `:` `:` drops you straight into history. History is the alternate view, so it is drawn with a double border; complete-at-point uses the plain single border. Switching into history is a no-op when you have none.

Complete-at-point suggests the next thing a `jj` command needs: subcommands, configured command aliases, flags, revisions, enum values, and bookmark names. For `bookmark track`, it supplements local names with every tracked and untracked remote bookmark as an exact `name@remote` symbol. `tab` inserts the current suggestion and advances to the next thing to complete; the arrows / `ctrl-n`,`ctrl-p` / `ctrl-j`,`ctrl-k` move through the list. `enter` runs the command, unless you have moved to a suggestion, in which case it accepts that suggestion. The flag and value metadata comes straight from `jj`'s own help, so it matches your installed `jj`; command aliases come from `jj config list aliases`, excluding aliases that start with `util`. The `>` shell command bar is unchanged (history only).

Both command bars wrap long commands and grow to half the terminal height before scrolling, so the full command stays visible without crowding out the log.

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
XDG_BIN_HOME=/some/bin bun run bin
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

<details>
<summary>Benchmark</summary>

Benchmark layout changes and the operation-log return path against the current repository:

```bash
bun run bench:revision-render
```

Use `--repo`, `--iterations`, `--warmup`, `--width`, and `--height` to control the run. `--scenario layout` or `--scenario oplog` narrows it, and `--json` emits machine-readable results. Optional `--median-budget-ms` and `--p95-budget-ms` limits make the command exit nonzero when either budget is exceeded, providing a path to enforce stable performance budgets in CI.

The benchmark uses OpenTUI's test renderer and Bun's built-in clock. For a sampling profile without adding a dependency or production instrumentation, run the benchmark entrypoint with Bun's `--cpu-prof` and `--cpu-prof-md` flags.

</details>

<details>
<summary>Distribute</summary>

Releases are tag-driven with curated notes, cut with the `jif-release` skill (`.agents/skills/jif-release/SKILL.md`): run `bun run release:preflight`, agree on a version (`0.MINOR.PATCH`, betas `-beta.N`), draft notes from `jj log`, update `CHANGELOG.md` for stable cuts, push `main`, create a **draft** GitHub Release, and dispatch `.github/workflows/release.yml`, which builds every platform binary, verifies and checksums the assets, and publishes the draft; publishing creates the tag. Stable releases also bump the Homebrew tap (`jrpat/homebrew-jif-tap`).

</details>
