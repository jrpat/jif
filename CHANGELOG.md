# Changelog

Stable releases are recorded here, newest first. Prerelease (beta) notes live
on their GitHub Releases only.

## v0.12.0 — 2026-08-28

### Highlights

- Press `C` to enter Copy mode and copy the focused revision's jj ID, full Git commit ID, description summary, full description, or bookmark.
- Jump to the previous or next visible immutable revision with `alt-[` and `alt-]`, including while composing revision operations.

### All changes

- Add revision metadata copy mode
- Add immutable revision navigation bindings

## v0.11.0 — 2026-08-25

### Highlights

- Revision previews now show the bookmarks pointing at the focused revision in their metadata.
- `bookmark track` completion now suggests every tracked and untracked remote bookmark as an exact `name@remote` symbol.
- Press `z` to center the focused revision, operation, or evolog entry in the viewport.

### All changes

- Show bookmarks in revision preview metadata
- Autosuggest remote bookmarks when composing 'bookmark track'
- Add command to center focused log rows

## v0.10.1 — 2026-08-14

### Highlights

No new features in this patch release.

### All changes

- Keep focus fill inside boxed revision rows

## v0.10.0 — 2026-08-14

### Highlights

- Press `C` in Bookmark mode to copy the focused revision's bookmark name to the system clipboard.

### All changes

- Swap revision previews atomically
- Add a Bookmark-mode shortcut for copying a bookmark name

## v0.9.1 — 2026-08-11

### Highlights

No new features in this patch release.

### All changes

- Isolate focused revision boxes from neighboring rows
- Polish full-screen preview shortcut behavior.

## v0.9.0 — 2026-08-11

### Highlights

- Press `)` or `(` to scroll the main log down or up by half a page.
- Long revision descriptions in the loose layout now wrap to two lines by default; set `log.looseDescriptionMaxLines` to choose the limit.

### All changes

- Add half-page log scrolling
- Wrap loose-layout descriptions across configurable lines
- Reduce idle revision border opacity to fifteen percent
- Connect focused revision borders at shared junctions
- Keep graph lines gray beside colored revision markers
- Scale revision focus fill by layout
- Stop loose-layout chips from bleeding into descriptions
- Upgrade OpenTUI to 0.5.1
- Prevent preview refreshes during Extra mode

## v0.8.1 — 2026-08-07

### Highlights

- Bookmark and workspace chip labels can now be truncated to configurable maximum lengths with `log.bookmarkLabelMaxLength` and `log.workspaceLabelMaxLength`, either globally or per layout.

### All changes

- Configure revision chip label truncation

## v0.8.0 — 2026-08-07

### Highlights

- The `:` command bar now opens in complete-at-point; use `ctrl-h` or a second bare `:` to switch to command history.
- Press backtick to open and close notification history.
- Press `alt-enter` on a notification to rerun the command that produced it.
- Preview diffs now wrap long lines by default; use `shift+w` or set `preview.wordWrap: false` to opt out.

### All changes

- Use backtick for the notification log
- Use the focused file for unselected file splits
- Restore file-selection splitting in Files mode
- Rerun commands from the notification log
- Prevent notification log expansion jitter.
- Open the jj command bar in complete-at-point by default
- Respect late terminal background responses
- Enable preview diff word wrap by default

## v0.7.2 — 2026-08-06

### Highlights

- Command-generated toasts and notification history now show the executed command above its output.
- Loose revision rows now place bookmark, workspace, and conflict chips beside the change ID, leaving the description its own row.

### All changes

- Move revision chips onto the id row in the loose layout
- Show commands in notification feedback

## v0.7.1 — 2026-08-05

### Highlights

No new features in this patch release.

### All changes

- Preserve the terminal palette when detection is incomplete

## v0.7.0 — 2026-07-31

### Highlights

- Press `d` on a revision, file, or evolog entry to read its diff in full-screen Preview mode.
- Wide preview panes now render diffs side by side; set `preview.splitViewWidth` to choose the threshold, or `0` to keep unified diffs.
- Press `ctrl-d` to compose an inclusive diff across a revision range, with `=` for a tree-to-tree comparison and `s` to include every descendant.
- The `?` shortcut panel now lists your configured keybindings in their own section above the built-in bindings.
- Scrolling through a multi-file diff now keeps the current filename pinned at the top of the preview.

### All changes

- Render diffs in the preview pane instead of a pager
- Pin the preview pane's current filename to the top row
- Give user-defined keybindings their own shortcut panel section
- Preserve revision file context across repository reloads

## v0.6.0 — 2026-07-31

### Highlights

- Press `?` while the shortcuts panel is visible to fuzzy-filter commands by key, name, description, or alias.
- Press `shift+p` while the preview pane is visible to enter Preview mode and access scrolling, resizing, wrapping, positioning, and full-file context controls.
- Press `/` in Files mode to narrow the expanded revision's changed-file list by path.
- Project config in the default Jujutsu workspace now applies automatically to linked workspaces, with per-workspace overrides layered on top.

### All changes

- Add fuzzy filtering to the shortcuts panel
- Keep scrollbar thumbs proportional to visible content
- Add a dedicated preview control mode
- Share project config across Jujutsu workspaces
- Add a / filter for the expanded revision's changed-file list
- Refine focus fills in revision file lists
- Pluralize omitted diff line labels
- Follow revision selection direction when advancing focus

## v0.5.2 — 2026-07-29

### All changes

- Add a shortcut to restart jif
- Use # for the dry-run status chip
- Bind l to next-file navigation in files mode
- Align shortcut columns across panel sections
- Keep inherited navigation visible in draft shortcut panels
- Share revision navigation across command drafts
- Enable undo and redo in revision files
- Rate-limit repository refreshes under heavy churn

## v0.5.1 — 2026-07-24

### Highlights

jif 0.5.1 is a small bugfix release.

- Background refreshes (the file watcher and the refresh interval) no longer merge divergent JJ operation heads, so an idle jif instance can no longer create operations that re-trigger every other running instance.
- `alt-j` now jumps between visible divergent siblings while composing rebase, squash, or interdiff.

### All changes

- Prevent passive refreshes from merging JJ operations
- Enable divergent jumps in draft modes
- Style the diff-context hint as an error
- Keep clamped log navigation visible

## v0.5.0 — 2026-07-24

### Highlights

- Major rendering performance improvements in the revision log.
- Diff previews now show revision metadata above the description: full change and commit IDs, plus author and committer names, emails, and timestamps.
- Press `` alt-` `` to open jif's GitHub releases page in your browser.
- Fast jump now matches only revision IDs, bookmark names, and workspace names.

### All changes

- Normalize revision rendering around stable slots
- Show revision metadata in diff previews
- Add alt+` shortcut to open the GitHub releases page
- Limit fast jump to revision reference fields

## v0.4.0 — 2026-07-23

### Highlights

- **Editable dry-run mode.** Toggle it with `ctrl-\` to route jj actions into the command prompt, where you can review and edit the exact command before it runs.
- **Wrapping command bar.** Long jj/shell commands now word-wrap and grow vertically — up to half the terminal height — instead of scrolling off the right edge, keeping the full command visible while you type.

### All changes

- Wrap long command-bar input instead of scrolling off-screen
- Add editable dry-run mode for jj commands
- Allow command prompts from all log surfaces

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
