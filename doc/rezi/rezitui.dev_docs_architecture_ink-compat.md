---
url: "https://rezitui.dev/docs/architecture/ink-compat"
title: "Ink Compatibility Layer | Rezi"
---

[$ rezi](https://rezitui.dev/)

[$ rezi](https://rezitui.dev/)

Search
`⌘`  `K`

[Blog](https://rezitui.dev/blog) [Rezi](https://rezitui.dev/docs) [Design Principles (Breaking Alpha)](https://rezitui.dev/docs/design-principles)

[Getting Started](https://rezitui.dev/docs/getting-started)

Migration

Guides

Reference

[Benchmarks](https://rezitui.dev/docs/benchmarks)

Widgets

Styling

[Rezi Design System](https://rezitui.dev/docs/design-system)

Recipes

Architecture

[Architecture](https://rezitui.dev/docs/architecture) [Ink Compatibility Layer](https://rezitui.dev/docs/architecture/ink-compat)

Backend

Protocol

[Terminal I/O Contract](https://rezitui.dev/docs/terminal-io-contract)

API

[API Reference](https://rezitui.dev/docs/api)

Developer

[Maintaining docs](https://rezitui.dev/docs/maintainers)

[GitHub](https://github.com/RtlZeroMemory/Rezi)

Ink Compatibility LayerWhat this gives you

Architecture

# Ink Compatibility Layer

@rezi-ui/ink-compat lets Ink apps run on Rezi's renderer.

`@rezi-ui/ink-compat` lets Ink apps run on Rezi's renderer.

It is designed for practical compatibility: keep React + Ink component/hook semantics, but replace Ink's renderer backend with Rezi's deterministic layout and draw pipeline.

If you are actively migrating an app, start with [Ink to Ink-Compat Migration](https://rezitui.dev/docs/migration/ink-to-ink-compat) and use this page as the runtime/internals reference.

## [What this gives you](https://rezitui.dev/docs/architecture/ink-compat\#what-this-gives-you)

- Reuse existing Ink app code with minimal migration.
- Keep common Ink APIs (`render`, `Box`, `Text`, `useInput`, `useFocus`, etc.).
- Route rendering through Rezi's engine for better performance and deterministic frame behavior.
- Debug parity issues with structured traces instead of ad-hoc logging.

## [Scope and expectations](https://rezitui.dev/docs/architecture/ink-compat\#scope-and-expectations)

Goals:

- High-fidelity behavior for real-world Ink apps.
- Stable, deterministic diagnostics for parity work.
- Clear compatibility boundaries.

Non-goals:

- Re-implement all Ink internals byte-for-byte.
- Guarantee every undocumented edge-case behavior from every Ink version/fork.

## [Install and use](https://rezitui.dev/docs/architecture/ink-compat\#install-and-use)

### [Option A: explicit import swap (recommended)](https://rezitui.dev/docs/architecture/ink-compat\#option-a-explicit-import-swap-recommended)

Use this when you can edit source imports.

```
// Before
import { render, Box, Text } from "ink";

// After
import { render, Box, Text } from "@rezi-ui/ink-compat";
```

### [Option B: package aliasing (no app source changes)](https://rezitui.dev/docs/architecture/ink-compat\#option-b-package-aliasing-no-app-source-changes)

Use this when you want existing `import "ink"` calls to keep working.

Install alias packages under Ink names:

```
npm install \
  ink@npm:@rezi-ui/ink-compat@latest \
  ink-gradient@npm:ink-gradient-shim@latest \
  ink-spinner@npm:ink-spinner-shim@latest
```

Equivalent with pnpm:

```
pnpm add \
  ink@npm:@rezi-ui/ink-compat@latest \
  ink-gradient@npm:ink-gradient-shim@latest \
  ink-spinner@npm:ink-spinner-shim@latest
```

Equivalent with Yarn:

```
yarn add \
  ink@npm:@rezi-ui/ink-compat@latest \
  ink-gradient@npm:ink-gradient-shim@latest \
  ink-spinner@npm:ink-spinner-shim@latest
```

### [Shims and ecosystem packages](https://rezitui.dev/docs/architecture/ink-compat\#shims-and-ecosystem-packages)

Compat includes dedicated shims for commonly-used Ink ecosystem packages:

- `ink-gradient` -\> `ink-gradient-shim`
- `ink-spinner` -\> `ink-spinner-shim`

You can also import shim implementations from `@rezi-ui/ink-compat` directly:

- `@rezi-ui/ink-compat/shims/ink-gradient`
- `@rezi-ui/ink-compat/shims/ink-spinner`

## [Wiring verification (recommended in CI)](https://rezitui.dev/docs/architecture/ink-compat\#wiring-verification-recommended-in-ci)

To ensure you are not silently running real Ink:

1. Verify resolved package identity:

```
node -e "const p=require('ink/package.json'); if(p.name!=='@rezi-ui/ink-compat') throw new Error('ink resolves to '+p.name); console.log('ink-compat active:', p.version);"
```

2. Verify resolved module path:

```
node -e "const fs=require('node:fs'); const path=require('node:path'); const pkg=require.resolve('ink/package.json'); console.log(fs.realpathSync(path.dirname(pkg)));"
```

3. For bundled CLIs, rebuild the bundle after aliasing and validate expected compat-only markers in generated output.

4. For rendering/layout/theme parity checks, run a live PTY with `REZI_FRAME_AUDIT=1` and generate evidence with `node scripts/frame-audit-report.mjs`.


## [Ink-Compat Bench (Ink vs Ink-Compat)](https://rezitui.dev/docs/architecture/ink-compat\#ink-compat-bench-ink-vs-ink-compat)

This repo includes a fairness-focused benchmark + profiling suite that runs the **same TUI app code** against:

- `real-ink`: `@jrichman/ink`
- `ink-compat`: `@rezi-ui/ink-compat`

Key commands:

```
# build bench packages
npm run prebench

# (optional) set up module resolution for bench-app explicitly
npm run prepare:real-ink
npm run prepare:ink-compat

# run a scenario (3 replicates)
npm run -s bench -- --scenario streaming-chat --renderer real-ink --runs 3 --out results/
npm run -s bench -- --scenario streaming-chat --renderer ink-compat --runs 3 --out results/

# CPU profiling (writes .cpuprofile under results/.../run_XX/cpu-prof/)
npm run -s bench -- --scenario dashboard-grid --renderer ink-compat --runs 1 --cpu-prof --out results/

# final-screen equivalence gate
npm run -s verify -- --scenario streaming-chat --compare real-ink,ink-compat --out results/
```

Docs + reports:

- Methodology + metric definitions: `BENCHMARK_VALIDITY.md`
- Latest report: `results/report_2026-02-27.md`
- Bottlenecks + fixes: `results/bottlenecks.md`
- Porting and architecture docs:
  - `../migration/ink-to-ink-compat.md`
  - `../dev/ink-compat-debugging.md`

## [Public compatibility surface](https://rezitui.dev/docs/architecture/ink-compat\#public-compatibility-surface)

### [Components](https://rezitui.dev/docs/architecture/ink-compat\#components)

| Export | Notes |
| --- | --- |
| `Box` | Ink-compatible layout/container props, including overflow/scroll props used by modern Ink forks |
| `Text` | Ink text styling props + wrapping/truncation behavior |
| `Newline` | Line break helper |
| `Spacer` | Flexible spacer helper |
| `Static` | Static channel output compatible with Ink-style scrollback behavior |
| `Transform` | Line transform wrapper (e.g. post-process text lines) |

### [Hooks](https://rezitui.dev/docs/architecture/ink-compat\#hooks)

| Export | Notes |
| --- | --- |
| `useApp` | `{ exit, rerender }` interface |
| `useInput` | Input subscription + raw mode management |
| `useFocus` | Focus registration and focus state |
| `useFocusManager` | Focus traversal/control helpers |
| `useStdin` / `useStdout` / `useStderr` | Stream access helpers |
| `useIsScreenReaderEnabled` | Reads compat screen-reader flag |
| `useCursor` | Cursor visibility/position integration |

### [Runtime APIs](https://rezitui.dev/docs/architecture/ink-compat\#runtime-apis)

| Export | Notes |
| --- | --- |
| `render` | Primary runtime entrypoint |
| `renderToString` | Non-interactive rendering for tests/snapshots |
| `measureElement` | Layout measurement by host node ref |
| `ResizeObserver` | Compat resize observer export |
| `getBoundingBox` | Host node geometry helper |
| `getInnerHeight` / `getScrollHeight` | DOM-like helpers |

### [Testing entrypoint](https://rezitui.dev/docs/architecture/ink-compat\#testing-entrypoint)

- `@rezi-ui/ink-compat/testing`

Provides a compact Ink-testing-library-like renderer for frame assertions and input simulation.

### [Keyboard helpers](https://rezitui.dev/docs/architecture/ink-compat\#keyboard-helpers)

- `kittyFlags`
- `kittyModifiers`

## [`render()` options](https://rezitui.dev/docs/architecture/ink-compat\#render-options)

`render(element, options)` supports:

| Option | Default | Notes |
| --- | --- | --- |
| `stdout` | `process.stdout` | Render target stream |
| `stdin` | `process.stdin` | Input source stream |
| `stderr` | `process.stderr` | Diagnostics/error output |
| `exitOnCtrlC` | `true` | Ctrl+C triggers `exit()` unless disabled |
| `patchConsole` | `true` | Patches console writes so logs do not destroy UI frame |
| `debug` | `false` | Enables verbose internal diagnostics |
| `maxFps` | `30` | Frame throttling; `\<=0` disables throttling |
| `concurrent` | `false` | Kept for API compatibility; not a React scheduling mode toggle |
| `kittyKeyboard` | `{ mode: "disabled" }` | Kitty keyboard protocol support |
| `isScreenReaderEnabled` | `process.env.INK_SCREEN_READER === "true"` | Accessibility mode hint |
| `onRender` | `undefined` | Per-frame callback with `renderTime`, `output`, `staticOutput?` |
| `alternateBuffer` | `false` | Use terminal alternate screen (`?1049h`) |
| `incrementalRendering` | `false` | Incremental write mode instead of full-screen rewrite |

## [How it works](https://rezitui.dev/docs/architecture/ink-compat\#how-it-works)

### [High-level pipeline](https://rezitui.dev/docs/architecture/ink-compat\#high-level-pipeline)

React Ink tree

Compat Reconciler Host Tree

Translation: Ink props -> Rezi VNodes

Rezi renderer

Render ops + layout nodes

ANSI serialization + stream writes

### [1\. React reconciler host tree](https://rezitui.dev/docs/architecture/ink-compat\#1-react-reconciler-host-tree)

Ink-compat provides a custom React reconciler host config that stores an `InkHostNode` tree.

- Host nodes keep type/props/children/text data.
- Focus registration and key routing are handled in bridge/context state.
- React semantics are preserved (state/effects/context/suspense in app code).

### [2\. Translation layer](https://rezitui.dev/docs/architecture/ink-compat\#2-translation-layer)

`translation/propsToVNode.ts` converts host nodes into Rezi VNodes.

Key mappings:

- Ink layout props -> Rezi layout props (`flex*`, spacing, min/max sizes, positioning).
- Ink border styles/colors -> Rezi border style maps.
- Ink text styling -> Rezi text style maps.
- Overflow/scroll props -> Rezi overflow and scroll props.
- Virtual nodes (`Spacer`, `Newline`, `Transform`) -\> dedicated Rezi equivalents.

The translator also supports mode-based extraction:

- full tree (`translateTree`)
- dynamic subtree only (`translateDynamicTree`)
- static subtree only (`translateStaticTree`)

This is used for static channel behavior described below.

### [3\. Dynamic + static channels](https://rezitui.dev/docs/architecture/ink-compat\#3-dynamic--static-channels)

`<Static>` output is treated as a scrollback-oriented channel:

- Static subtree renders separately.
- Static output accumulates above dynamic frame output.
- Dynamic viewport is reduced by static row count so footers/prompts remain anchored.

This is critical for parity with Ink apps that stream logs while keeping an interactive prompt anchored.

### [4\. Viewport, layout, and percent resolution](https://rezitui.dev/docs/architecture/ink-compat\#4-viewport-layout-and-percent-resolution)

Render pass behavior:

1. Read viewport from `stdout`/fallback stream/env.
2. Translate dynamic subtree.
3. Resolve percent markers against current layout viewport.
4. Render once; if percent markers were present, render a second pass with resolved values.
5. Compute content bounds (`maxRectBottom`) from layout nodes.
6. In non-alternate-buffer mode, size ANSI grid to content height (not full terminal rows).

Additional parity behavior:

- Root viewport coercion for overflow-clipped roots.
- Resize-event timeline handling.
- Stable-output preservation on transient empty frames after resize.

### [5\. ANSI output + color strategy](https://rezitui.dev/docs/architecture/ink-compat\#5-ansi-output--color-strategy)

Color support resolution order:

1. `NO_COLOR` (non-empty) disables color.
2. `FORCE_COLOR` overrides level (0..3).
3. `stdout.getColorDepth()` if available.
4. Fallback defaults to truecolor.

When host text already contains ANSI SGR sequences, compat forces truecolor handling for that frame/path to avoid degrading pre-styled output.

### [6\. Input, focus, cursor](https://rezitui.dev/docs/architecture/ink-compat\#6-input-focus-cursor)

Input flow is bridge-driven:

- Parses standard ANSI/CSI sequences.
- Optional Kitty keyboard protocol parsing.
- Emits normalized `key` object to `useInput` handlers.
- Handles Tab/Shift+Tab focus traversal.
- Handles Ctrl+C exit (unless `exitOnCtrlC: false`).

Focus flow:

- `useFocus` registers focusable IDs in bridge context.
- `useFocusManager` controls traversal and direct focus.
- Focus changes trigger rerender where needed.

Cursor flow:

- `useCursor` sets cursor position/visibility in context.
- Runtime updates terminal cursor state around frame writes.

### [7\. Instance lifecycle model](https://rezitui.dev/docs/architecture/ink-compat\#7-instance-lifecycle-model)

`render()` behavior by `stdout`:

- One active compat instance per `stdout` stream.
- Calling `render()` again on the same `stdout` rerenders existing instance.
- `unmount()` and `cleanup()` release stream listeners, timers, raw mode, and terminal protocol state.

## [Recommended integration patterns](https://rezitui.dev/docs/architecture/ink-compat\#recommended-integration-patterns)

### [Pattern A: migrate imports directly](https://rezitui.dev/docs/architecture/ink-compat\#pattern-a-migrate-imports-directly)

Best when you control app source and want explicitness.

- Replace `ink` imports with `@rezi-ui/ink-compat`.
- Keep app code structure unchanged first.
- Validate UI parity before broader refactors.

### [Pattern B: alias package names](https://rezitui.dev/docs/architecture/ink-compat\#pattern-b-alias-package-names)

Best when you want a no-source-change adoption path.

- Alias `ink` to `@rezi-ui/ink-compat`.
- Alias `ink-gradient`/`ink-spinner` to shim packages.
- Run parity checks before and after dependency lockfile updates.

### [Pattern C: test-first rollout](https://rezitui.dev/docs/architecture/ink-compat\#pattern-c-test-first-rollout)

- Use `@rezi-ui/ink-compat/testing` to snapshot important frame states.
- Add keyboard/focus regression tests around core interaction loops.
- Run compatibility traces in CI for known-problem screens.

## [Diagnostics and tracing](https://rezitui.dev/docs/architecture/ink-compat\#diagnostics-and-tracing)

Compat diagnostics are env-gated and deterministic.

| Env var | Purpose |
| --- | --- |
| `INK_COMPAT_TRACE=1` | Enables compat trace stream |
| `INK_COMPAT_TRACE_FILE=/path/log` | Writes trace lines to file |
| `INK_COMPAT_TRACE_STDERR=1` | Mirrors trace lines to stderr |
| `INK_COMPAT_TRACE_DETAIL=1` | Adds node/op snapshots |
| `INK_COMPAT_TRACE_DETAIL_FULL=1` | Adds full VNode/grid snapshots + translation traces |
| `INK_COMPAT_TRACE_ALL_FRAMES=1` | Disables frame sampling |
| `INK_COMPAT_TRACE_IO=1` | Includes output/write queue diagnostics |
| `INK_COMPAT_TRACE_RESIZE_VERBOSE=1` | Includes resize timeline detail |
| `INK_COMPAT_TRACE_POLL_EVERY=<n>` | Sampling cadence |
| `INK_COMPAT_TRACE_JSON_MAX_DEPTH=<n>` | JSON trace depth limit |
| `INK_COMPAT_TRACE_JSON_ARRAY_LIMIT=<n>` | JSON array truncation limit |
| `INK_COMPAT_TRACE_JSON_OBJECT_LIMIT=<n>` | JSON object-key truncation limit |
| `INK_COMPAT_VIEWPORT_POLL_MS=<n>` | Viewport poll interval |
| `INK_COMPAT_IDLE_REPAINT_MS=<n>` | Idle repaint interval |
| `INK_GRADIENT_TRACE=1` | Gradient shim traces |

Use this runbook for full debug workflows and triage commands:

- [Ink Compat Debugging Runbook](https://rezitui.dev/docs/dev/ink-compat-debugging)

## [Testing examples](https://rezitui.dev/docs/architecture/ink-compat\#testing-examples)

### [Render-to-string](https://rezitui.dev/docs/architecture/ink-compat\#render-to-string)

```
import React from "react";
import { renderToString, Text } from "@rezi-ui/ink-compat";

const out = renderToString(<Text color="green">OK</Text>, { columns: 40 });
```

### [Interactive frame assertions](https://rezitui.dev/docs/architecture/ink-compat\#interactive-frame-assertions)

```
import React from "react";
import { Text } from "@rezi-ui/ink-compat";
import { render } from "@rezi-ui/ink-compat/testing";

const ui = render(<Text>Hello</Text>);
expect(ui.lastFrame()).toContain("Hello");
ui.unmount();
```

## [Known compatibility boundaries](https://rezitui.dev/docs/architecture/ink-compat\#known-compatibility-boundaries)

- App/version-specific message text (for example update banners) can differ without being a renderer bug.
- Slight per-character gradient interpolation differences can exist while preserving expected visual progression.
- Terminal/OS/TTY quirks can still cause minor differences outside renderer control.
- `concurrent` is accepted for API compatibility but does not map to upstream React concurrent scheduling semantics.

## [Troubleshooting checklist](https://rezitui.dev/docs/architecture/ink-compat\#troubleshooting-checklist)

1. Verify package wiring first (`ink` alias/import swap + shims).
2. Reproduce with traces enabled (`INK_COMPAT_TRACE=1`).
3. Compare structure before color (`layoutViewport`, `gridViewport`, static rows, overflow counts).
4. Then inspect color/gradient data (`FORCE_COLOR`, `NO_COLOR`, `INK_GRADIENT_TRACE`).
5. Add focused regression tests for the failing screen.

## [Maintainer workflow for parity fixes](https://rezitui.dev/docs/architecture/ink-compat\#maintainer-workflow-for-parity-fixes)

1. Reproduce with trace capture.
2. Identify stage of drift: host tree vs translation vs renderer vs ANSI output.
3. Add or update tests in `packages/ink-compat/src/__tests__`.
4. Keep instrumentation environment-gated and deterministic.
5. Re-validate against upstream app screenshots/traces.

[Architecture\\
\\
Rezi is a layered system: a runtime-agnostic UI core, a Node.js/Bun backend, and a native C rendering engine connected by versioned binary protocols.](https://rezitui.dev/docs/architecture) [Node/Bun backend\\
\\
The Node/Bun backend owns:](https://rezitui.dev/docs/backend/node)

### On this page

[What this gives you](https://rezitui.dev/docs/architecture/ink-compat#what-this-gives-you) [Scope and expectations](https://rezitui.dev/docs/architecture/ink-compat#scope-and-expectations) [Install and use](https://rezitui.dev/docs/architecture/ink-compat#install-and-use) [Option A: explicit import swap (recommended)](https://rezitui.dev/docs/architecture/ink-compat#option-a-explicit-import-swap-recommended) [Option B: package aliasing (no app source changes)](https://rezitui.dev/docs/architecture/ink-compat#option-b-package-aliasing-no-app-source-changes) [Shims and ecosystem packages](https://rezitui.dev/docs/architecture/ink-compat#shims-and-ecosystem-packages) [Wiring verification (recommended in CI)](https://rezitui.dev/docs/architecture/ink-compat#wiring-verification-recommended-in-ci) [Ink-Compat Bench (Ink vs Ink-Compat)](https://rezitui.dev/docs/architecture/ink-compat#ink-compat-bench-ink-vs-ink-compat) [Public compatibility surface](https://rezitui.dev/docs/architecture/ink-compat#public-compatibility-surface) [Components](https://rezitui.dev/docs/architecture/ink-compat#components) [Hooks](https://rezitui.dev/docs/architecture/ink-compat#hooks) [Runtime APIs](https://rezitui.dev/docs/architecture/ink-compat#runtime-apis) [Testing entrypoint](https://rezitui.dev/docs/architecture/ink-compat#testing-entrypoint) [Keyboard helpers](https://rezitui.dev/docs/architecture/ink-compat#keyboard-helpers) [`render()` options](https://rezitui.dev/docs/architecture/ink-compat#render-options) [How it works](https://rezitui.dev/docs/architecture/ink-compat#how-it-works) [High-level pipeline](https://rezitui.dev/docs/architecture/ink-compat#high-level-pipeline) [1\. React reconciler host tree](https://rezitui.dev/docs/architecture/ink-compat#1-react-reconciler-host-tree) [2\. Translation layer](https://rezitui.dev/docs/architecture/ink-compat#2-translation-layer) [3\. Dynamic + static channels](https://rezitui.dev/docs/architecture/ink-compat#3-dynamic--static-channels) [4\. Viewport, layout, and percent resolution](https://rezitui.dev/docs/architecture/ink-compat#4-viewport-layout-and-percent-resolution) [5\. ANSI output + color strategy](https://rezitui.dev/docs/architecture/ink-compat#5-ansi-output--color-strategy) [6\. Input, focus, cursor](https://rezitui.dev/docs/architecture/ink-compat#6-input-focus-cursor) [7\. Instance lifecycle model](https://rezitui.dev/docs/architecture/ink-compat#7-instance-lifecycle-model) [Recommended integration patterns](https://rezitui.dev/docs/architecture/ink-compat#recommended-integration-patterns) [Pattern A: migrate imports directly](https://rezitui.dev/docs/architecture/ink-compat#pattern-a-migrate-imports-directly) [Pattern B: alias package names](https://rezitui.dev/docs/architecture/ink-compat#pattern-b-alias-package-names) [Pattern C: test-first rollout](https://rezitui.dev/docs/architecture/ink-compat#pattern-c-test-first-rollout) [Diagnostics and tracing](https://rezitui.dev/docs/architecture/ink-compat#diagnostics-and-tracing) [Testing examples](https://rezitui.dev/docs/architecture/ink-compat#testing-examples) [Render-to-string](https://rezitui.dev/docs/architecture/ink-compat#render-to-string) [Interactive frame assertions](https://rezitui.dev/docs/architecture/ink-compat#interactive-frame-assertions) [Known compatibility boundaries](https://rezitui.dev/docs/architecture/ink-compat#known-compatibility-boundaries) [Troubleshooting checklist](https://rezitui.dev/docs/architecture/ink-compat#troubleshooting-checklist) [Maintainer workflow for parity fixes](https://rezitui.dev/docs/architecture/ink-compat#maintainer-workflow-for-parity-fixes)