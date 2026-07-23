# Changelog

Stable releases are recorded here, newest first. Prerelease (beta) notes live
on their GitHub Releases only.

## v0.3.0 — 2026-07-22

### Highlights

- **Elided revision rows can now be expanded.** Pressing `l` / `→` on an `(elided revisions)` marker reveals the nearest hidden commits as real graph rows. Expansions survive refreshes and last until you change the revset or restart jif — previously the marker usually just vanished without showing anything.
- **Abandon respects your selection.** `a` now abandons every selected revision, falling back to the focused revision only when nothing is selected.
- **Breaking: keymap scopes renamed.** The `normal` and `files` keymap scopes are now `revision-log` and `revision-files`. If your config scopes bindings under the old names, update them to the new names.
- Launching jif outside a Jujutsu repository now restores the terminal and exits with a clear error instead of leaving the screen in a bad state.
- Pressing `ctrl-enter` in the revision log now shows a hint explaining that extra diff context is available when viewing a single file's diff, instead of doing nothing.

### All changes

- Give the sample repo elided revisions under the default log revset
- Make elided-revision expansion work and survive refreshes
- Add ctrl-enter diff-context hint in the revision-log view
- Rename normal and files modes to revision-log and revision-files
- Abandon selected revisions before focused revision
- Exit cleanly when launched outside a repository
- Bump actions/checkout to v5 in CI and release workflows

## v0.2.0 — 2026-07-17

### Highlights

- **Rebase onto merges.** Rebase mode can now pick multiple destinations, not just multiple sources. `Ctrl-Space` toggles the spacebar between selecting additional revisions to move and additional targets to land on, so you can rebase onto a merge. Pinned targets show in blue.
- **Switch workspaces from the log.** Press `Tab` on a workspace row to switch jif to that workspace. Previews and the shell follow along, and your session preferences and status history carry over.
- **Bookmark name completion.** `git push` and `bookmark track`/`untrack`/`rename` now complete your local bookmark names.
- **Context-aware focus colors.** The focused row now changes color to match what you're doing: neutral grey while browsing, magenta while composing a command, and blue while picking a rebase target.
- **Unbind keys with `null`.** Setting a keybinding to `null` now explicitly unbinds an inherited or global key and hides it from the shortcut panel.
- **Reverse navigation reaches the working copy.** `previous-bookmark` and `previous-workspace` now jump to the working copy when there's no earlier match, instead of stopping at the boundary.

### All changes

- Preserve spacing before oversized revision chips
- Switch active workspaces from workspace rows
- Tie command chip colors to row backgrounds via one role triple
- Introduce a shared revision draft mode
- Support null keybindings for mode-specific unbinding
- Fall back to working copy in reverse marker navigation
- Add dual spacebar selection of subjects or targets in rebase mode
- Complete bookmark arguments from structured JJ data

## v0.1.1 — 2026-07-14

### Highlights

This release is all about startup speed and polish:

- **Much faster startup.** The repository now loads concurrently with terminal palette detection instead of queuing behind it, and jif caps the palette idle wait at 50ms. Warm startup to visible log content drops from roughly 700–850ms to about 410ms — with no fallback-color flash on the first frame.
- **Leaner first paint.** UI that isn't needed for the first frame (diff viewer, preview pane, prompts, overlays) now loads lazily and is preloaded right after the UI is ready, trimming more module evaluation off the critical path.
- **Renamed files preview correctly.** Renames print as `src/{old => new}.ext`, which jj rejects as a fileset — previewing a renamed file showed nothing, and the diff shortcut, restore, and untrack were similarly broken. jif now resolves the concrete post-rename path while still displaying the compressed form in the file list.
- **No more stale expanded rows.** Focusing a revision directly (e.g. by mouse click) now collapses another row's open file list instead of leaving the app focused on one revision with a different row expanded.

### All changes

- Defer non-first-paint UI components behind lazy imports
- Load the repository concurrently with terminal palette detection
- Resolve renamed file paths for single-file preview
- Collapse expanded revisions on direct focus
- Add project status to readme

## v0.1.0 — 2026-07-10

### Highlights

The first release of **jif** — a keyboard-first terminal UI for browsing and operating on [Jujutsu](https://github.com/jj-vcs/jj) history. jif is log-first: you navigate the graph, inspect changes in place, and compose `jj` commands progressively without leaving the view. It shells out to your real `jj` binary, so behavior always matches your installed `jj`.

- **Log-first navigation.** Browse the revision graph with `j`/`k`, jump to the working copy with `@`, fast-jump search to move quickly, and multi-select revisions and files for batch operations.
- **Inline preview pane.** Read diffs alongside the log with ANSI syntax highlighting, word wrap, a full-file context toggle, and a pane position that cycles auto / right / below (`shift+p`) — with a graceful fallback on narrow terminals.
- **Progressive command bar.** Compose `jj` commands with colored revset segments, short/long flag toggling, and complete-at-point suggestions sourced from your own `jj` help and aliases. Built-in operations include squash, absorb, restore, rebase, and undo/redo, plus a `g` binding that composes `jj git` commands.
- **Configurable and scriptable.** User-defined keybindings, `jj` command aliases, interactive shell command bindings, and configs that reload live without leaving your current context.
- **Operation log & evolog.** Browse the op log with its own graph view, inspect a revision's evolution, and undo/redo from anywhere.
- **Semantic theming.** Colors derive from your terminal's ANSI palette, with automatic light/dark switching when the terminal regains focus.
- **Live updates.** jif watches `jj` op-heads and refreshes when the repository changes, with configurable passive auto-refresh.
- **Easy, verifiable install.** Prebuilt binaries for macOS and Linux (arm64 and x64) via a checksum-verifying installer, Homebrew tap, or `mise` — each carrying build provenance you can attest.

Built on [OpenTUI](https://github.com/sst/opentui) and Solid.

### Notable changes

Since this is the first release, this is a curated list of user-facing capabilities rather than the full commit history.

- Log graph browsing with staggered entries matching graph topology, focus/selection styling, and scroll-to-follow navigation
- `@` jump to the working-copy revision
- Fast jump search mode
- Independent revision and file multi-select
- Preview pane for diffs: ANSI syntax colors, word wrap, omitted-context display, full-file context toggle, configurable position (auto/right/below), and narrow-terminal fallback
- Command bar for composing `jj` commands: colored revset segments, short/long flag toggle, history, and complete-at-point (subcommands, aliases, flags, revisions, enum values, bookmarks)
- Built-in operations: squash, absorb, restore, rebase, split, set-parents, new-between (`alt-n`), undo, and redo (`Alt+U`)
- Operation log and evolog views with graph rendering and `@` jump to the current operation
- Bookmark mode covering the full set of `jj bookmark` sub-commands
- In-app diff viewer (`ctrl-d`) and interdiff mode for comparing two revisions
- File-driven log filtering
- Interactive shell keybinding commands and the `>` shell command bar
- User-configurable keybindings, `jj` command aliases, wheel scrolling, and preview options
- Live config reload without leaving the current shortcut context
- Semantic theming derived from the terminal's ANSI palette, with light/dark auto-switch on terminal focus
- Passive auto-refresh; repository changes detected by watching `jj` op-heads
