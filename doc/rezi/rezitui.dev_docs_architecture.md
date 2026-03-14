---
url: "https://rezitui.dev/docs/architecture"
title: "Architecture | Rezi"
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

ArchitectureRuntime Stack

Architecture

# Architecture

Rezi is a layered system: a runtime-agnostic UI core, a Node.js/Bun backend, and a native C rendering engine connected by versioned binary protocols.

Rezi is a layered system: a runtime-agnostic UI core, a Node.js/Bun backend, and a native C rendering engine connected by versioned binary protocols.

## [Runtime Stack](https://rezitui.dev/docs/architecture\#runtime-stack)

Node.js/Bun Runtime

Runtime-Agnostic

Application Code

@rezi-ui/core

@rezi-ui/jsx

@rezi-ui/node

@rezi-ui/native

Zireael C Engine

| Layer | Owns | Does NOT own |
| --- | --- | --- |
| **@rezi-ui/core** | Widget tree, layout, themes, keybindings, forms, drawlist encoding, event parsing | Terminal I/O, threads, OS APIs |
| **@rezi-ui/node** | Worker thread lifecycle, frame scheduling, buffer transport, execution mode selection | Widget logic, layout math |
| **@rezi-ui/native** | N-API binding, Zireael engine lifecycle, SharedArrayBuffer interop | Protocol semantics |
| **Zireael (C)** | Framebuffer management, diff rendering, ANSI emission, terminal capability detection, platform I/O | Widget definitions, layout, themes |

## [Data Flow](https://rezitui.dev/docs/architecture\#data-flow)

A single frame follows this path:

```
1. Event Dispatch
   Terminal input → Zireael parses raw bytes → ZREV event batch →
   worker thread → main thread → app event handlers

2. State Update
   Event handler calls app.update() → state transitions queued →
   batched into single commit at next commit point

3. Render
   view(state) called → VNode tree produced → reconciliation →
   layout computed (cell coordinates) → focus resolved

4. Drawlist Encoding
   Render output → ZRDL binary drawlist (commands: clear, fill_rect,
   draw_text, push_clip, pop_clip, set_cursor)

5. Present
   Drawlist transferred to worker → worker submits to Zireael →
   Zireael diffs prev/next framebuffers → emits minimal ANSI bytes →
   single write to terminal
```

### [Binary Protocol Boundary](https://rezitui.dev/docs/architecture\#binary-protocol-boundary)

The native engine communicates exclusively through two binary formats:

- **ZRDL** (drawlists): rendering commands flowing _down_ from TypeScript to the engine. Contains a 64-byte header (`magic: "ZRDL"` / `0x4C44525A` as little-endian `u32`), followed by command records, a string table, and an optional blob table.
- **ZREV** (event batches): input events flowing _up_ from the engine to TypeScript. Contains a 24-byte header (`magic: "ZREV"` / `0x5645525A` as little-endian `u32`), followed by self-framed event records (key, text, paste, mouse, resize, tick, user).

Both formats are little-endian, 4-byte aligned, and versioned. Mismatched versions produce deterministic errors at the boundary — no silent data corruption.

### [Execution Modes](https://rezitui.dev/docs/architecture\#execution-modes)

The Node/Bun backend supports three execution modes:

- **`"auto"`** (default): selects `"inline"` when `fpsCap \<= 30`, otherwise `"worker"`.
- **`"worker"`**: native engine runs on a dedicated worker thread. Main thread is never blocked by terminal I/O.
- **`"inline"`**: engine runs on the main thread. Lower latency, but main thread blocks during I/O.

### [Widget Protocol Registry](https://rezitui.dev/docs/architecture\#widget-protocol-registry)

Widget capability detection is centralized in `packages/core/src/widgets/protocol.ts`.
The render/runtime pipeline no longer relies on scattered hardcoded widget-kind checks.
Instead, capability helpers are unified through protocol lookups (for example,
interactive/focusable/pressable detection), so commit, focus metadata, hit-testing,
and routing all interpret widget kinds consistently.

## [Design Constraints](https://rezitui.dev/docs/architecture\#design-constraints)

**No Node.js APIs in core.**`@rezi-ui/core` must remain runtime-agnostic. It contains no `Buffer`, `worker_threads`, `fs`, or `node:*` imports. This is enforced by CI.

**Binary boundary for safety.** All data crossing the native boundary goes through versioned binary formats with strict validation. No raw pointers or shared mutable state cross the TypeScript/C boundary.

**Deterministic rendering.** Same initial state + same event sequence = same frames. This is achieved through pinned Unicode tables (v15.1.0), versioned protocols, and strict commit-point semantics.

**No per-frame heap churn.** The engine pre-allocates framebuffers, output buffers, and event queues at creation time. The diff renderer operates on caller-provided buffers with no dynamic allocation.

**Single flush per present.**`engine_present()` writes exactly one chunk to the terminal on success, zero on failure. No partial ANSI sequences reach the terminal.

## [Related Docs](https://rezitui.dev/docs/architecture\#related-docs)

- [Node/Bun backend](https://rezitui.dev/backend/node) — backend lifecycle and `createNodeApp`
- [Worker model](https://rezitui.dev/backend/worker-model) — thread ownership and backpressure
- [Native addon](https://rezitui.dev/backend/native) — N-API binding details
- [Protocol overview](https://rezitui.dev/protocol/index) — binary format specs
- [ZRDL drawlists](https://rezitui.dev/protocol/zrdl) — rendering command format
- [ZREV event batches](https://rezitui.dev/protocol/zrev) — input event format
- [Terminal I/O contract](https://rezitui.dev/terminal-io-contract) — terminal interaction guarantees

[Data Table\\
\\
Building sortable, filterable data tables in Rezi.](https://rezitui.dev/docs/recipes/data-table) [Ink Compatibility Layer\\
\\
@rezi-ui/ink-compat lets Ink apps run on Rezi's renderer.](https://rezitui.dev/docs/architecture/ink-compat)

### On this page

[Runtime Stack](https://rezitui.dev/docs/architecture#runtime-stack) [Data Flow](https://rezitui.dev/docs/architecture#data-flow) [Binary Protocol Boundary](https://rezitui.dev/docs/architecture#binary-protocol-boundary) [Execution Modes](https://rezitui.dev/docs/architecture#execution-modes) [Widget Protocol Registry](https://rezitui.dev/docs/architecture#widget-protocol-registry) [Design Constraints](https://rezitui.dev/docs/architecture#design-constraints) [Related Docs](https://rezitui.dev/docs/architecture#related-docs)