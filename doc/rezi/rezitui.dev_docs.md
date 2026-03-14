---
url: "https://rezitui.dev/docs"
title: "Rezi | Rezi"
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

ReziWhy Rezi?

# Rezi

Rezi is a code-first terminal UI framework for Node.js and Bun. Build interactive terminal applications with a declarative widget API, automatic focus management, and native-backed rendering throug...

Rezi is a **code-first terminal UI framework** for Node.js and Bun. Build interactive terminal applications with a declarative widget API, automatic focus management, and native-backed rendering through the [Zireael](https://github.com/RtlZeroMemory/Zireael) C engine.

```
import { ui } from "@rezi-ui/core";
import { createNodeApp } from "@rezi-ui/node";

const app = createNodeApp\<{ count: number }>({
  initialState: { count: 0 },
});

app.view((state) =>
  ui.page({
    p: 1,
    gap: 1,
    header: ui.header({ title: "Counter", subtitle: "Beautiful defaults" }),
    body: ui.panel("Count", [\
      ui.row({ gap: 1, items: "center" }, [\
        ui.text(String(state.count), { variant: "heading" }),\
        ui.spacer({ flex: 1 }),\
        ui.button({\
          id: "inc",\
          label: "+1",\
          intent: "primary",\
          onPress: () => app.update((s) => ({ count: s.count + 1 })),\
        }),\
      ]),\
    ]),
  })
);

app.keys({ q: () => app.stop() });
await app.start();
```

## [Why Rezi?](https://rezitui.dev/docs\#why-rezi)

**Declarative and Type-Safe**
: Define your UI as a function of state. Full TypeScript support with strict typing for props, state, and events.

**Rich Widget Library**
: 50+ built-in widgets covering forms, tables, trees, modals, code editors, command palettes, charts, and more.

**Native Performance**
: Powered by the Zireael C engine with a binary protocol boundary. No virtual DOM diffing overhead.

**Focus Management**
: Automatic keyboard navigation with focus zones, focus traps, and modal stacking.

**Mouse Support**
: Click to focus and activate widgets, scroll wheel for lists and editors, drag to resize split panes, click backdrops to close modals. Detected automatically — no configuration needed.

**Theming**
: Six built-in themes (dark, light, dimmed, high-contrast, nord, dracula) with semantic color tokens.

**Declarative Animation**
: Built-in animation hooks (`useTransition`, `useSpring`, `useSequence`, `useStagger`) plus container transition props on `ui.box(...)`.

**Keybindings**
: First-class support for modal keybindings with chord sequences (Vim-style `g g`, Emacs-style `C-x C-s`).

**JSX Support**
: Write widget trees using JSX syntax with `@rezi-ui/jsx` — no React required. [Getting started →](https://rezitui.dev/getting-started/jsx)

**Performance**
: See [benchmarks →](https://rezitui.dev/benchmarks) for methodology, limitations, and the latest committed results.

## [Architecture](https://rezitui.dev/docs\#architecture)

Node.js/Bun Runtime

Runtime-Agnostic

Application Code

@rezi-ui/core

@rezi-ui/jsx

@rezi-ui/node

@rezi-ui/native

Zireael C Engine

| Layer | Purpose |
| --- | --- |
| **@rezi-ui/core** | Widgets, layout, themes, forms, keybindings. No Node.js APIs. |
| **@rezi-ui/node** | Node.js/Bun backend with worker and inline execution modes. |
| **@rezi-ui/native** | N-API addon (napi-rs) binding to the Zireael C rendering engine. |
| **@rezi-ui/jsx** | Optional JSX runtime for widget trees. |

## [Getting Started](https://rezitui.dev/docs\#getting-started)

- **Install**


* * *


Install Rezi via npm and set up your first project.

[Installation](https://rezitui.dev/getting-started/install)

- **Quickstart**


* * *


Build a minimal Rezi application.

[Quickstart](https://rezitui.dev/getting-started/quickstart)

- **Widgets**


* * *


Browse the complete widget catalog.

[Widget Catalog](https://rezitui.dev/widgets/index)

- **Styling**


* * *


Themes, colors, and visual customization.

[Styling Guide](https://rezitui.dev/styling/index)


## [Core Concepts](https://rezitui.dev/docs\#core-concepts)

### [State-Driven Rendering](https://rezitui.dev/docs\#state-driven-rendering)

Rezi applications are state-driven. You define a `view` function that returns a widget tree based on your application state:

```
type State = { items: string[]; selected: number };

app.view((state) =>
  ui.column({ gap: 1 },
    state.items.map((item, i) =>
      ui.text(i === state.selected ? `> ${item}` : `  ${item}`, {
        key: String(i),
      })
    )
  )
);
```

### [State Updates](https://rezitui.dev/docs\#state-updates)

Update state with `app.update()`. Updates are batched and coalesced for efficiency:

```
app.update((prev) => ({ ...prev, selected: prev.selected + 1 }));
```

### [Widget Composition](https://rezitui.dev/docs\#widget-composition)

Widgets compose naturally. Container widgets like `column`, `row`, and `box` accept children:

```
ui.box({ title: "User Form", p: 1 }, [\
  ui.field({ label: "Name", required: true, children:\
    ui.input({ id: "name", value: state.name })\
  }),\
  ui.row({ gap: 2 }, [\
    ui.button({ id: "submit", label: "Submit", intent: "primary" }),\
    ui.button({ id: "cancel", label: "Cancel" }),\
  ]),\
])
```

### [Focus and Navigation](https://rezitui.dev/docs\#focus-and-navigation)

Interactive widgets (buttons, inputs) automatically participate in focus navigation. Use Tab/Shift+Tab to move between focusable elements, or click any focusable widget with the mouse:

```
ui.column({}, [\
  ui.button({ id: "first", label: "First" }),   // Tab stop 1\
  ui.button({ id: "second", label: "Second" }), // Tab stop 2\
  ui.input({ id: "name", value: "" }),          // Tab stop 3\
])
```

## [Widget Categories](https://rezitui.dev/docs\#widget-categories)

### [Primitives](https://rezitui.dev/docs\#primitives)

Layout building blocks: `text`, `box`, `row`, `column`, `spacer`, `divider`

### [Form Inputs](https://rezitui.dev/docs\#form-inputs)

Interactive controls: `button`, `input`, `checkbox`, `radioGroup`, `select`, `field`

### [Navigation](https://rezitui.dev/docs\#navigation)

Routing and wayfinding: `tabs`, `accordion`, `breadcrumb`, `link`, `pagination`

### [Data Display](https://rezitui.dev/docs\#data-display)

Data presentation: `table`, `virtualList`, `tree`, `richText`, `badge`, `tag`, `status`

### [Overlays](https://rezitui.dev/docs\#overlays)

Modal UIs: `modal`, `dropdown`, `layer`, `layers`, `toast`, `focusZone`, `focusTrap`

### [Layout Components](https://rezitui.dev/docs\#layout-components)

Complex layouts: `splitPane`, `panelGroup`, `resizablePanel`

### [Advanced Widgets](https://rezitui.dev/docs\#advanced-widgets)

Rich functionality: `commandPalette`, `codeEditor`, `diffViewer`, `logsConsole`, `filePicker`

### [Charts](https://rezitui.dev/docs\#charts)

Data visualization: `gauge`, `progress`, `sparkline`, `barChart`, `miniChart`

### [Graphics Components](https://rezitui.dev/docs\#graphics-components)

Graphics rendering: `canvas`, `image`, `lineChart`, `scatter`, `heatmap`

### [Feedback](https://rezitui.dev/docs\#feedback)

User feedback: `spinner`, `skeleton`, `callout`, `errorDisplay`, `empty`

## [Learn More](https://rezitui.dev/docs\#learn-more)

- [Concepts](https://rezitui.dev/guide/concepts) \- Understanding Rezi's architecture
- [Ink to Ink-Compat Migration](https://rezitui.dev/migration/ink-to-ink-compat) \- Port existing Ink apps with minimal code churn
- [Beautiful Defaults migration](https://rezitui.dev/migration/beautiful-defaults) \- Design system styling defaults and manual overrides
- [Ink to Rezi Migration](https://rezitui.dev/migration/ink-to-rezi) \- Mental model mapping and migration recipes
- [Lifecycle & Updates](https://rezitui.dev/guide/lifecycle-and-updates) \- State management patterns
- [Routing](https://rezitui.dev/guide/routing) \- Page-level navigation and screen history
- [Layout](https://rezitui.dev/guide/layout) \- Spacing, alignment, and constraints
- [Input & Focus](https://rezitui.dev/guide/input-and-focus) \- Keyboard navigation and focus management
- [Mouse Support](https://rezitui.dev/guide/mouse-support) \- Click, scroll, and drag interactions
- [Animation](https://rezitui.dev/guide/animation) \- Declarative motion hooks and box transitions
- [Styling](https://rezitui.dev/styling/index) \- Colors, themes, and visual customization
- [Graphics](https://rezitui.dev/guide/graphics) \- Capability-aware rendering and progressive enhancement
- [Performance](https://rezitui.dev/guide/performance) \- Optimization techniques
- [Debugging](https://rezitui.dev/guide/debugging) \- Debug tools and frame inspection
- [Architecture](https://rezitui.dev/architecture/index) \- Runtime stack and data flow
- [API Reference](https://rezitui.dev/api) \- TypeDoc-generated API docs
- [Developer Guide](https://rezitui.dev/dev/contributing) \- Local setup and workflows

[Design Principles (Breaking Alpha)\\
\\
This page describes the project’s high-level product principles for the breaking alpha.](https://rezitui.dev/docs/design-principles)

### On this page

[Why Rezi?](https://rezitui.dev/docs#why-rezi) [Architecture](https://rezitui.dev/docs#architecture) [Getting Started](https://rezitui.dev/docs#getting-started) [Core Concepts](https://rezitui.dev/docs#core-concepts) [State-Driven Rendering](https://rezitui.dev/docs#state-driven-rendering) [State Updates](https://rezitui.dev/docs#state-updates) [Widget Composition](https://rezitui.dev/docs#widget-composition) [Focus and Navigation](https://rezitui.dev/docs#focus-and-navigation) [Widget Categories](https://rezitui.dev/docs#widget-categories) [Primitives](https://rezitui.dev/docs#primitives) [Form Inputs](https://rezitui.dev/docs#form-inputs) [Navigation](https://rezitui.dev/docs#navigation) [Data Display](https://rezitui.dev/docs#data-display) [Overlays](https://rezitui.dev/docs#overlays) [Layout Components](https://rezitui.dev/docs#layout-components) [Advanced Widgets](https://rezitui.dev/docs#advanced-widgets) [Charts](https://rezitui.dev/docs#charts) [Graphics Components](https://rezitui.dev/docs#graphics-components) [Feedback](https://rezitui.dev/docs#feedback) [Learn More](https://rezitui.dev/docs#learn-more)