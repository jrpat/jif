# jif

`jif` is a keyboard-first terminal UI for browsing and operating on Jujutsu history.

This README is for humans working in this repository.

## Prerequisites

- `bun`
- `jj`

`jif` shells out to the real `jj` binary. The built app is a single `jif` executable, but it still expects `jj` to be installed and available on `PATH`.

## Install

```bash
bun run install:bin
```

This compiles a single `jif` executable into `${XDG_BIN_HOME:-$HOME/.local/bin}`.

To install workspace dependencies without compiling the binary:

```bash
bun install
```

To install into a different location for one run:

```bash
XDG_BIN_HOME=/some/bin bun run install:bin
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

Run in watch mode against a freshly materialized sample repo:

```bash
bun run dev
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
- `scripts/build.ts` uses the OpenTUI Solid Bun plugin during `Bun.build`.

## Configuration

User config lives in the jif config directory:

- `$XDG_CONFIG_HOME/jif` when `XDG_CONFIG_HOME` is set
- otherwise `~/.config/jif`

jif currently loads the first existing file in this order from that directory:

- `config.ts`
- `config.js`
- `jif.config.ts`
- `jif.config.js`

Run `jif init-config` to create a starter config in that directory. The command creates:

- `config.ts` with a placeholder `Jif.Config` shape and commented examples
- `jif.d.ts` with editor-facing types for autocomplete and inline docs

The generated `config.ts` starts with a `/// <reference path="./jif.d.ts" />` comment so TypeScript language servers can pick up the types even outside the jif source tree.

If a config file already exists, `jif init-config` leaves it alone and only fills in missing support files.

The current color configuration supports `light`, `dark`, and `auto` theme mode. In `auto`, startup queries the terminal background color and picks the light or dark theme accordingly.

Revision IDs default to the longest unique prefix across the visible log. You can show a few extra characters with:

```ts
export default {
	log: {
		revisionIdAdditionalChars: 0,
	},
} satisfies Jif.Config;
```

Key bindings live under the top-level `keymap` field. User keymaps are deep-merged into the built-in defaults, so adding one binding does not replace the rest of the default map.

You can either rebind an existing built-in command by id:

```ts
export default {
	keymap: {
		normal: {
			J: "move-down",
		},
	},
} satisfies Jif.Config;
```

Or define an inline command directly in the keymap:

```ts
export default {
	keymap: {
		normal: {
			"ctrl-g": {
				title: "Show Focused Revision",
				description: "Open jj show for the focused revision",
				run: (cmd, app) => {
					const revision = app.rev;
					if (!revision) return;

					return cmd.jji(`show -r ${revision.revisionId}`);
				},
			},
			"ctrl-e": {
				title: "Edit Focused Revision",
				description: "Run jj edit on the focused revision",
				run: (cmd, app) => {
					const revision = app.rev;
					if (!revision) return;

					return cmd.jj(`edit ${revision.revisionId}`);
				},
			},
		},
	},
} satisfies Jif.Config;
```

Inline handlers receive `cmd` and `app` by convention:

- `cmd` is the user command controller. Use `cmd.jj("...")` for normal commands or `cmd.jji("...")` for interactive ones.
- `app` is the full config-facing `AppState`, plus an ergonomic `app.rev` getter for the currently focused revision.

Custom inline command ids are optional. If you provide one, jif prefixes it internally so it cannot collide with built-in command ids.
