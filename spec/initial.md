# JJ TUI App Prompt

Build a keyboard-first terminal UI application for navigating and operating on a Jujutsu (`jj`) repository.

Use TypeScript and the OpenTUI terminal UI library. Use OpenTUI idiomatically, but do not invent APIs. If any OpenTUI behavior is uncertain, inspect its real docs/source first and then implement against the actual library.

## Product Goal

The app should feel conceptually similar to JJUI:

- the primary mental model is a log you move through with the keyboard
- one revision is focused at a time
- commands are built progressively
- the interface should make complex multi-step `jj` operations feel legible and incremental rather than modal in a confusing way

## Core Interaction Model

- Show the repository log newest-first, top to bottom.
- Support `j` and `k` as the canonical navigation keys.
- Also support Up and Down arrows as behavior aliases, but canonical help text should still show `j` and `k`.
- Support `l` to expand/open the focused revision’s details in place.
- Support `h` to collapse/close the focused revision’s details.
- Also support Right and Left arrows as behavior aliases, while canonical help still shows `l` and `h`.
- Pressing `:` focuses the command bar at the top.
- Pressing `Escape` cancels the current in-progress command or exits command-bar focus.
- While the command bar has focus, keystrokes should go to the command bar and should not act on the revision list.

## Layout

- Put a full-width command bar at the very top of the terminal UI.
- The command bar should show the command being built, and also allow direct typing/editing.
- The command bar should show only the `jj` subcommand text, not a leading `jj`.
- Below the command bar, render the revision log.
- Each revision entry should have a clear selected/focused state.
- When the detail view for one revision is open, other visible revisions should dim, and the dimming should animate if the framework allows it.

## Revision Entry Design

This is a terminal UI, so do not mimic macOS cards literally, but preserve the information hierarchy:

- left side: graph gutter showing the commit graph and JJ-style node marker
- right side: revision content block
- top line of the content block:
  - short change/rev identifier using the minimal unique prefix needed, but with a floor like 8 chars when useful for readability
  - bookmarks and workspace names visually distinguished from each other
- body:
  - revision description
- focused revision:
  - clearly highlighted
- revisions actively selected for an operation:
  - distinct operation highlight
- if an operation includes descendants:
  - all affected revisions should show operation highlighting
  - only the directly focused revision should get the stronger “current focus” treatment

## Graph Rendering

Follow JJ’s graph rendering in spirit:

- show merge topology clearly
- include parallel lanes, merges, and crossing/continuation lines where needed
- use JJ-like node markers:
  - workspace/working-copy revisions should use the JJ-style working-copy marker
  - bookmarked revisions should use a distinct marker
  - plain revisions should use the plain revision marker
- prioritize readability over pixel-perfect imitation
- if possible, ask `jj` for graph-adjacent information or derive it from real repo structure rather than hard-coding simplistic fake topology
- the graph gutter should remain readable in dense histories

## Detail View Behavior

Expanding a revision should reveal only the changed-files list first.

- Files should be shown relative to repository root, never as absolute paths.
- The file list becomes its own navigation context:
  - when details are open, `j` and `k` move between files, not between revisions
  - the first file is focused initially
  - focus stays inside the file list until the detail view is closed
- The file list should have a clear focused-row treatment.
- Keep the files area compact; vertical space is scarce in a terminal UI.

## Command-Building Model

The app is command-driven.

- The command bar at the top should always reflect the command currently being composed.
- Commands should be expressible both:
  - incrementally via key sequences
  - directly by typing into the command bar
- Multi-step operations should be easy to build progressively.

Important example: rebase flow

- Pressing `r` enters rebase mode and seeds the command builder with a rebase command for the focused revision.
- A follow-up key like `s` should toggle “include descendants”.
- The user should then navigate to an `onto` target and confirm with Enter.
- As the command is being built:
  - the top command bar updates live
  - affected revisions are highlighted
- Use `jj` itself to determine descendant sets and other command semantics. Do not reimplement Jujutsu’s revset logic when `jj` can answer it.

## Command Definitions

Do not scatter key handling logic ad hoc.

- Define commands, modes, titles, and key sequences in a declarative data structure.
- That structure must be iterable so the UI can show context-sensitive available commands.
- It should support:
  - global/default commands
  - mode-specific commands
  - nested or multi-step command trees
- Cancel commands for a mode should be clearly represented and grouped separately in any help/menu UI.

## Repository Integration

Use the real `jj` binary.

- Do not mock core JJ behavior.
- Load the log, details, descendants, and command results by invoking real `jj`.
- Use `jj` as the source of truth for repository state and operation semantics.
- After a command runs successfully:
  - clear the command bar back to blank
  - show a short ephemeral status message
  - keep a durable status/event log available somewhere in the app
  - refresh repository state from `jj`

## Development And Test Strategy

Use TDD.

- Write tests first for each feature phase, then implement, then verify.
- Prefer fast unit tests plus real integration tests.

### Testing Requirements

- Use the real `jj` executable in integration tests.
- Tests should create temporary repositories and populate them with sample history.
- Keep test repositories deterministic and realistic.
- Maintain one checked-in JSONL file describing a sample repository as a sequence of `jj` operations.
- Test setup should materialize that JSONL into a fresh temp repo.
- The sample repo should include:
  - 30+ commits
  - branches
  - merges
  - bookmarks
  - workspaces
  - a believable small codebase
- The app should also support a deterministic debug/dev mode that always launches against a materialized sample repo rather than the developer’s ambient working directory.

## Architecture Guidance

Keep the code cleanly separated:

- JJ client/process layer
- repository/domain models
- command/mode configuration
- application state/store
- OpenTUI rendering components
- test helpers/sample repo materialization

Avoid duplicating business logic between UI and command execution paths. Prefer explicit state transitions and testable pure logic where possible.

## Acceptance Criteria

The first usable version should support:

- log rendering with a readable JJ-style graph gutter
- revision focus with `j/k` and arrow aliases
- in-place detail expansion with `h/l` and arrow aliases
- top command bar with `:` focus and Enter submission
- rebase-mode command building with descendant highlighting driven by real `jj`
- real `jj` integration tests with temp repos
- deterministic sample repo materialization for debug/dev
- a command-definition system that can later drive contextual help

## Implementation Style

Be pragmatic and iterative.

Start with a blank canvas, build the tests and the core architecture first, then layer on rendering and command flows.

When tradeoffs appear, favor clarity, determinism, and real JJ integration over mock-heavy shortcuts.
