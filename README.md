# jif

`jif` is a keyboard-first terminal UI for browsing and operating on Jujutsu history.

This README is for humans working in this repository.

## Prerequisites

- `bun`
- `jj`

`jif` shells out to the real `jj` binary. The built app is a single `jif` executable, but it still expects `jj` to be installed and available on `PATH`.

## Install

```bash
bun install
```

## Run

Run against the current working directory:

```bash
bun run start
```

Run against a freshly materialized deterministic sample repo:

```bash
bun run sample
```

You can also run the entrypoint directly:

```bash
bun run index.ts
```

## Build

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

## Test

Run the test suite:

```bash
bun test
```

Run typechecking:

```bash
bunx tsc --noEmit
```

## Project Notes

- This is a Jujutsu repository. Use `jj`, not Git.
- Deterministic sample data lives in `test/fixtures/sample-repo.jsonl`.
- Sample repo materialization logic lives under `src/dev/`.
- The UI runtime is OpenTUI + Solid.
- `tsconfig.json` uses `jsxImportSource: "@opentui/solid"` and `bunfig.toml` preloads `@opentui/solid/preload`.
- `build.ts` uses the OpenTUI Solid Bun plugin during `Bun.build`.

## Configuration

Repo-local config lives in `config.ts`.

The current color configuration supports `light`, `dark`, and `auto` theme mode. In `auto`, startup queries the terminal background color and picks the light or dark theme accordingly.
