# Learning

- If a user asks you to "learn" something, document it in the AGENTS.md file before ending the task.
- When a change introduces a new user-facing surface — a default keyboard binding, a configuration option, a CLI flag, or any other behavior worth calling out — update `README.md` in the same change. Implementation details that a user would never set or invoke do not belong in the README.


# Project Intent

- `jif` is a keyboard-first terminal UI for browsing and operating on Jujutsu history.
- UX should mirror JJUI mental models: log-first navigation, in-place details, and progressive command composition.
- OpenTUI APIs should be used idiomatically and verified against the installed package/docs instead of guessed.


# Repository And Tooling

- This is a Jujutsu repository. Use `jj`, not Git, for version-control operations.
- Run `jj commit` outside the sandbox with escalation. The repository metadata lives outside the writable workspace root, so sandboxed commits cannot lock the Jujutsu store.
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
- Run full test suites and real-`jj` integration tests outside the sandbox with escalation. `jj` may need secure config under `~/.config/jj`, which is outside the writable workspace root.
- Repo fixtures should be created in temp directories.
- Keep deterministic sample data checked in and replayable.
- When UI-specific testing is needed, start with narrow renderer/state coverage before broader interactive checks.


# JJ/Repo Setup Expectations

- Deterministic sample data lives at `test/fixtures/sample-repo.jsonl`.
- Sample repo materialization logic lives under `src/dev/`.
- Debug mode should launch against a freshly materialized sample repo instead of the ambient working directory:
  - `bun run index.ts --sample`
- `bun run dev` runs `scripts/dev.ts`, a launcher that restarts jif on `src/` changes. Do not switch `dev` back to `bun --watch`: bun's watcher reload-loops against jif's startup (it re-triggers faster than the opentui TUI can paint its first frame), so the screen is cleared on every restart and stays blank. The custom launcher only watches `src/` and `index.ts`, so jif's runtime file activity can't retrigger it.


# User-specific Instructions

If the user has user-specific instructions, they can be found in [@my/AGENTS.md](my/agents.md). Read them immediately after reading this file.
