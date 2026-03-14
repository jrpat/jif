# AGENTS Notes

## Project intent
- `suijj` is a keyboard-first tui client for browsing and operating on Jujutsu history.
- UX direction mirrors JJUI mental models (log navigation, in-place details, operation modes).

## Working style
- Use TDD by default: add or update tests first, then implement, then verify.
- Prefer small, reviewable increments over broad rewrites.
- Preserve existing behavior unless a requirement explicitly changes it.

## Testing policy
- Use real `jj` for integration and UI tests. Do not mock core JJ behavior.
- Repo fixtures should be created in temp directories.
- Do **not** run UI tests automatically unless the user explicitly asks (they steal focus).
- When UI tests are requested, start with targeted tests, then expand scope.

## JJ/repo setup expectations
- Debug mode should use deterministic sample data, materialized from:
  - `Sources/SuijjUI/SampleData/sample-repo.jsonl`
- Keep sample repo generation reproducible and isolated from real repos.

## UI command conventions
- Canonical menu shortcuts are Vim-style keys (`J/K/H/L`, etc.).
- Arrow keys can be behavior aliases, but menu discoverability should keep canonical keys.
- Command bar shows subcommands only (no leading `jj`).
- `Escape` cancels current input/mode.

