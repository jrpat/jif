---
name: jif-release
description: Cut a jif release — run preflight, choose the version, draft release notes from jj log, update CHANGELOG.md, push main, and create the draft GitHub Release that CI builds and publishes. Use when the user asks to cut, ship, or publish a jif release.
---

# Cutting a jif release

Releases are tag-driven with human-curated notes. This skill produces a **draft**
GitHub Release; `release.yml` reacts to it, builds all binaries on a
native-runner matrix, attests provenance, uploads everything, and flips the
draft to published. You never create the tag yourself — GitHub creates it when
the draft is published (the repo is jj-only, so tags cannot be pushed locally).

Work through the steps in order. Do not skip preflight and do not create the
draft before the user has approved the notes.

## 1. Preflight

Run outside the sandbox (it runs jj and the full test suite):

```bash
bun run release:preflight
```

All steps must pass. If the working copy is dirty, have the user decide what to
do with the changes — never abandon work yourself.

## 2. Choose the version

Find the previous release, then agree on the new version with the user:

```bash
gh release list --limit 5
```

Versioning policy (pre-1.0): `0.MINOR.PATCH` — bump MINOR for features, PATCH
for fixes only. Prereleases are `0.MINOR.PATCH-beta.N`. Validate the choice:

```bash
bun run scripts/release/assets.ts normalize <version>
```

## 3. Draft the notes

List every change since the last release (first release: use `-r '::@-'`):

```bash
jj git fetch
jj log --no-graph -r 'v<LAST>..@-' -T 'description.first_line() ++ "\n"'
```

Write the notes to `.tmp/release-notes.md`:

- `## Highlights` — a few sentences or bullets of curated prose covering the
  user-facing changes that matter. Read the actual commits (`jj show`) when a
  subject line is not enough. Skip internal churn.
- `## All changes` — one bullet per commit subject, newest first. Omit empty
  and dead-end commits.
- Footer, verbatim:

```markdown
---

**Install**: `curl -fsSL https://raw.githubusercontent.com/jrpat/jif/main/install.sh | sh` · `brew install jrpat/jif-tap/jif` · [more options](https://github.com/jrpat/jif#install)

**Verify**: `gh attestation verify <asset> --repo jrpat/jif`
```

Show the notes to the user and iterate until they approve. **Do not continue
without approval.**

## 4. Stable releases only: update CHANGELOG.md

Prepend an entry (below the header) with the approved notes, without the
footer:

```markdown
## vX.Y.Z — YYYY-MM-DD

<Highlights + All changes>
```

Commit it (outside the sandbox): `jj commit -m "Release vX.Y.Z"`. Betas skip
this step — their notes live only on the GitHub prerelease.

## 5. Push main and create the draft

Point `main` at the release commit and push:

```bash
jj bookmark set main -r @-
jj git push --bookmark main
```

Create the draft against the exact commit (add `--prerelease` for betas):

```bash
TARGET=$(jj log --no-graph -r main -T commit_id)
gh release create vX.Y.Z --draft --title "jif X.Y.Z" --notes-file .tmp/release-notes.md --target "$TARGET"
```

## 6. Watch CI

```bash
gh run list --workflow=release.yml --limit 1
gh run watch <run-id>
```

On success the release is published automatically and the Homebrew tap is
bumped (stable only). Confirm with `gh release view vX.Y.Z`.

If a build leg fails: for a fix that needs no new commits, re-run the failed
jobs from the Actions UI, or dispatch `release.yml` with the version and
dry-run unchecked to finish the existing draft. If the fix needs new commits,
delete the draft (`gh release delete vX.Y.Z`), land the fix, and restart from
step 1.
