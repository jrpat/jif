---
url: "https://rezitui.dev/docs/design-principles"
title: "Design Principles (Breaking Alpha) | Rezi"
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

Backend

Protocol

[Terminal I/O Contract](https://rezitui.dev/docs/terminal-io-contract)

API

[API Reference](https://rezitui.dev/docs/api)

Developer

[Maintaining docs](https://rezitui.dev/docs/maintainers)

[GitHub](https://github.com/RtlZeroMemory/Rezi)

Design Principles (Breaking Alpha)Canonical layout mechanisms

# Design Principles (Breaking Alpha)

This page describes the project’s high-level product principles for the breaking alpha.

This page describes the project’s high-level product principles for the breaking alpha.

* * *

## [Canonical layout mechanisms](https://rezitui.dev/docs/design-principles\#canonical-layout-mechanisms)

Use the first mechanism that fits the need:

1. Fixed cells: `width: 20`
2. Flex distribution: `flex: 1`
3. Grid placement: `ui.grid({ columns: ... })`
4. Helper constraints (preferred) or `expr("...")` for derived relationships
5. `fluid(min, max)` for smooth scaling

* * *

## [Constraint policy (summary)](https://rezitui.dev/docs/design-principles\#constraint-policy-summary)

- Helper-first constraints are the mainstream path:
  - `visibilityConstraints`, `widthConstraints`, `heightConstraints`, `spaceConstraints`, `groupConstraints`, `conditionalConstraints`
- Raw `expr("...")` is the escape hatch for custom rules.
- `%` size strings and responsive-map layout constraints (`{ sm, md, ... }`) are removed in the breaking alpha.
- `grid.columns` accepts `number | string` only in alpha; `columns: expr(...)` is invalid.
- Layout-driven visibility uses `display: ...` constraints; business logic visibility uses `show(...)`/`when(...)`/`maybe(...)`/`match(...)`.

* * *

## [Banned patterns (high signal)](https://rezitui.dev/docs/design-principles\#banned-patterns-high-signal)

- Manual `Math.floor/ceil/min/max` to compute widget `width`/`height` in view functions
- Threading viewport size through application state for layout decisions
- `%` layout size strings
- responsive-map layout constraints for sizing/visibility

For detailed examples, see `docs/guide/constraints.md` and `docs/guide/layout-decision-tree.md`.

[Rezi\\
\\
Rezi is a code-first terminal UI framework for Node.js and Bun. Build interactive terminal applications with a declarative widget API, automatic focus management, and native-backed rendering throug...](https://rezitui.dev/docs) [Getting Started\\
\\
Get up and running with Rezi in minutes.](https://rezitui.dev/docs/getting-started)

### On this page

[Canonical layout mechanisms](https://rezitui.dev/docs/design-principles#canonical-layout-mechanisms) [Constraint policy (summary)](https://rezitui.dev/docs/design-principles#constraint-policy-summary) [Banned patterns (high signal)](https://rezitui.dev/docs/design-principles#banned-patterns-high-signal)