# Initial Implementation Plan

## Goal

Build a keyboard-first terminal UI for navigating and operating on a real Jujutsu repository, using TypeScript and OpenTUI, with real `jj` integration and a test-first workflow.

## Planning Assumptions

- The repository is currently a blank slate aside from the product spec.
- OpenTUI APIs must be validated against real documentation/source before implementation choices are locked in.
- The first milestone is a usable vertical slice, not a fully polished clone of JJUI.
- Real `jj` behavior is the source of truth for log shape, descendants, changed files, and command execution.

## High-Level Architecture

Organize the app into clear layers so UI behavior stays testable and `jj` semantics stay centralized:

1. `src/jj/`
   - Process runner for invoking `jj`
   - Parsers/mappers from CLI output into typed domain models
   - Command execution helpers
2. `src/domain/`
   - Revision, graph lane, file-change, bookmark, workspace, and status/event types
   - Command builder state and mode definitions
3. `src/state/`
   - App store/state machine
   - Focus handling for revision list, detail file list, and command bar
   - Reducer-style transitions where possible
4. `src/commands/`
   - Declarative command tree/configuration
   - Multi-step command definitions, labels, cancel actions, contextual availability
5. `src/ui/`
   - OpenTUI app bootstrap
   - Layout components: command bar, revision list, graph gutter, detail list, status area/help
   - Styling/highlight rules and any supported animations
6. `src/dev/`
   - Deterministic sample repo materialization
   - Debug/dev launch helpers
7. `test/`
   - Pure unit tests for state, command building, graph mapping
   - Integration tests against temp repos with the real `jj` binary

## Proposed Delivery Phases

### Phase 0: Project Bootstrap

- Initialize the TypeScript project and package scripts.
- Choose the test runner and runtime support for TDD-friendly iteration.
- Add linting/formatting early so the repo has a stable baseline.
- Add a small abstraction around process execution from day one so `jj` access is easy to stub in unit tests and easy to run for integration tests.
- Add a startup-time dependency check for `jj`.
- First validation step: confirm the actual OpenTUI app lifecycle, input handling, rendering primitives, focus model, and animation support.

### Phase 1: `jj` Integration and Domain Model

- Implement a `JjClient` around the real `jj` executable.
- Define typed models for:
  - revision summaries
  - graph rows/gutter segments
  - file changes for a revision
  - descendant sets for command previews
  - command results/status events
- Decide on one or two canonical `jj` output formats for parsing.
- Keep parsing logic isolated and covered by fixture-based tests.
- Implement refresh methods for:
  - repository log
  - revision details / changed files
  - descendant resolution for rebase preview

### Phase 2: Deterministic Repository Fixtures

- Create a checked-in JSONL script that describes a realistic sample repo as a sequence of `jj` operations.
- Build a materializer that replays the JSONL into a temp repo.
- Ensure the sample repo includes:
  - 30+ commits
  - branches/bookmarks
  - merges
  - multiple workspaces if feasible in temp setup
  - a believable multi-file codebase
- Expose a debug/dev entrypoint that always launches the app against a freshly materialized sample repo.
- Use this same materializer in integration tests to keep behavior deterministic.

### Phase 3: State Store and Navigation Model

- Implement the application state shape before rendering complexity grows.
- Model the three focus contexts explicitly:
  - revision list
  - detail file list
  - command bar
- Encode keyboard behavior as explicit transitions:
  - `j/k` and arrow aliases
  - `h/l` and arrow aliases
  - `:`
  - `Escape`
  - `Enter`
- Keep “focused revision”, “expanded revision”, and “operation-affected revisions” separate in state.
- Add unit tests for all key state transitions before wiring the UI.

### Phase 4: Declarative Command System

- Implement the command-definition structure early, before ad hoc key handling spreads.
- The command layer should support:
  - global commands
  - mode-scoped commands
  - nested/multi-step flows
  - explicit cancel behavior
  - display metadata for future contextual help
- Represent command composition separately from command execution so the command bar can reflect either typed text or key-driven composition.
- Add tests that prove the command tree can drive the rebase flow without UI involvement.

### Phase 5: First Usable UI Shell

- Build the top-level OpenTUI layout:
  - command bar at top
  - revision log below
  - compact status/help area if needed
- Render repository rows newest-first.
- Implement focused-row styling and basic operation highlighting.
- Implement graph gutter rendering from parsed graph data rather than faking topology in the UI.
- Keep row rendering modular so graph, metadata, description, and highlights are separable.

### Phase 6: Detail Expansion and Nested File Navigation

- Implement in-place detail expansion for the focused revision.
- Load and render only the changed-files list first.
- Switch navigation context into the file list while details are open.
- Ensure file paths are always repository-relative.
- Add tests for:
  - focus entering the file list
  - `j/k` moving across files instead of revisions
  - `h` closing details and restoring revision focus

### Phase 7: Command Bar Editing and Submission

- Make `:` focus the command bar.
- Ensure typing in the command bar suppresses list navigation shortcuts.
- Support direct editing of command text and submission with `Enter`.
- On `Escape`, cancel in-progress command composition or exit command-bar focus.
- Keep parser/validation behavior shallow at first: the command bar mainly reflects and submits composed `jj` subcommand text.

### Phase 8: Rebase Flow Vertical Slice

- Implement the first multi-step command flow: rebase.
- `r` seeds a rebase command for the focused revision.
- `s` toggles descendant inclusion.
- Navigation chooses the `onto` target.
- The command bar updates continuously as the flow progresses.
- Affected revisions are highlighted using descendant sets resolved by real `jj`.
- `Enter` executes the command through the `JjClient`.
- On success:
  - clear the command bar
  - show an ephemeral success message
  - append a durable event/status log entry
  - refresh repository state from `jj`

### Phase 9: Polish and Acceptance Pass

- Improve graph readability in denser histories.
- Add dimming of non-focused revisions when details are open, with animation only if OpenTUI supports it cleanly.
- Add contextual command/help rendering driven from the command-definition system.
- Tighten integration tests around command execution and post-command refresh.
- Verify the implemented behavior against each acceptance criterion in the spec.

## Test Strategy

Use TDD per feature phase:

1. Pure unit tests
   - state transitions
   - command builder behavior
   - graph mapping from `jj` output into renderable rows
   - command availability by mode/focus context
2. Integration tests with real `jj`
   - sample repo materialization
   - log loading
   - file-detail loading
   - descendant resolution
   - rebase execution and refresh behavior
3. Minimal UI behavior tests where OpenTUI tooling allows them
   - only for behavior that cannot be confidently covered at the state layer

Prefer testing pure logic over snapshotting terminal output. Snapshot tests may still be useful for graph-row formatting if kept narrow and intentional.

## Recommended Initial Milestones

### Milestone 1

Project boots, loads a real repo through `jj`, and has deterministic sample repo setup plus integration tests for the client.

### Milestone 2

Revision log renders with keyboard navigation, focus state, graph gutter, and detail expansion into changed files.

### Milestone 3

Command system exists declaratively, command bar supports focus/edit/submit, and the first rebase flow works end-to-end against real `jj`.

### Milestone 4

Status/event logging, contextual help, highlight polish, and acceptance-criteria cleanup are complete.

## Early Risks and Mitigations

- OpenTUI API uncertainty
  - Mitigation: validate actual APIs in Phase 0 before locking the component structure.
- Parsing `jj` output too loosely
  - Mitigation: prefer structured templates/output where available and freeze representative fixtures in tests.
- Terminal layout complexity around graph rendering and nested focus
  - Mitigation: keep graph mapping and focus state outside rendering code.
- Rebase flow coupling UI state directly to execution details
  - Mitigation: keep a standalone command-builder model that the UI merely presents.
- Workspace handling may complicate deterministic test setup
  - Mitigation: treat workspaces as a stretch aspect of the sample repo if setup is materially harder than expected, but keep domain support ready.

## Suggested First Implementation Order

1. Bootstrap TypeScript, test runner, lint/format, and OpenTUI dependency.
2. Validate real OpenTUI APIs and document the constraints that affect architecture.
3. Build `JjClient` plus parsing tests.
4. Build JSONL sample repo materializer and integration harness.
5. Build app state/store and keyboard transition tests.
6. Build declarative command system and rebase-flow unit tests.
7. Render the revision log and graph gutter.
8. Add detail expansion and file-list focus handling.
9. Add command-bar editing/submission.
10. Finish real rebase execution, refresh flow, and polish.

## Definition of Done for the First Reviewable Version

- The app launches against either the current repo or deterministic debug repo.
- The log is rendered newest-first with a readable graph gutter.
- Revision focus and detail expansion work with the required key bindings and aliases.
- The command bar is visible, focusable with `:`, editable, and submittable.
- Rebase mode works end-to-end with descendant highlighting driven by real `jj`.
- Successful commands clear the bar, emit status, append event history, and refresh state.
- Unit and integration tests cover the main flows using the real `jj` executable.
