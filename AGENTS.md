# Learning

- If a user asks you to "learn" something, document it in the appropriate project guidance file before ending the task.
- If the content is high-level agent behavior or workflow, add it to `AGENTS.md`.
- If it fits an existing `.ai/*` guidance file, add it there.
- If no existing `.ai` file is appropriate, create a new file in `.ai` and record it there.


# Project Intent

- `jif` is a keyboard-first terminal UI for browsing and operating on Jujutsu history.
- UX should mirror JJUI mental models: log-first navigation, in-place details, and progressive command composition.
- Rezi APIs should be used idiomatically and verified against the installed package/docs instead of guessed.


# Repository And Tooling

- This is a Jujutsu repository. Use `jj`, not Git, for version-control operations.
- Default runtime and package manager is Bun.
- Commit messages should use:
  - a subject line that is a single sentence under 72 characters stating what changed
  - one to four short paragraphs, each up to four sentences, describing what changed and any significant decisions
  - enough context to explain why the change was made and what tradeoffs or alternatives mattered
- Prefer:
  - `bun run <script>` for entrypoints
  - `bun test` for tests
  - `bunx tsc --noEmit` for typechecking


# Working Style

- Use TDD by default: add or update tests first, then implement, then verify.
- Prefer small, reviewable increments over broad rewrites.
- Preserve existing behavior unless a requirement explicitly changes it.
- Keep UI state transitions explicit and testable. Avoid scattering command semantics across rendering code.


# Testing Policy

- Use real `jj` for integration tests. Do not mock core JJ behavior.
- Repo fixtures should be created in temp directories.
- Keep deterministic sample data checked in and replayable.
- When UI-specific testing is needed, start with narrow renderer/state coverage before broader interactive checks.


# JJ/Repo Setup Expectations

- Deterministic sample data lives at `test/fixtures/sample-repo.jsonl`.
- Sample repo materialization logic lives under `src/dev/`.
- Debug mode should launch against a freshly materialized sample repo instead of the ambient working directory:
  - `bun run index.ts --sample`


# UI Command Conventions

- Canonical shortcuts are Vim-style keys: `j/k` for movement and `h/l` for close/open.
- Arrow keys can be behavior aliases, but canonical help should keep the Vim-style bindings.
- The command bar shows only the `jj` subcommand text, never a leading `jj`.
- `Escape` cancels the current in-progress command or exits command-bar focus.
