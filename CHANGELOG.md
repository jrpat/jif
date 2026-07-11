# Changelog

Stable releases are recorded here, newest first. Prerelease (beta) notes live
on their GitHub Releases only.

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
