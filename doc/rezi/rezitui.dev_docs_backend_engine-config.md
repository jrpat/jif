---
url: "https://rezitui.dev/docs/backend/engine-config"
title: "Engine Configuration | Rezi"
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

[Node/Bun backend](https://rezitui.dev/docs/backend/node) [Worker model](https://rezitui.dev/docs/backend/worker-model) [Native Addon](https://rezitui.dev/docs/backend/native) [Engine Configuration](https://rezitui.dev/docs/backend/engine-config) [Terminal Capabilities](https://rezitui.dev/docs/backend/terminal-caps)

Protocol

[Terminal I/O Contract](https://rezitui.dev/docs/terminal-io-contract)

API

[API Reference](https://rezitui.dev/docs/api)

Developer

[Maintaining docs](https://rezitui.dev/docs/maintainers)

[GitHub](https://github.com/RtlZeroMemory/Rezi)

Engine ConfigurationQuick Example

Backend

# Engine Configuration

The AppConfig type lets you tune runtime limits, rendering behavior, and frame pipelining when creating a Rezi application. Every property is optional; sensible defaults are applied automatically.

The `AppConfig` type lets you tune runtime limits, rendering behavior, and frame
pipelining when creating a Rezi application. Every property is optional; sensible
defaults are applied automatically.

## [Quick Example](https://rezitui.dev/docs/backend/engine-config\#quick-example)

```
import { createNodeApp } from "@rezi-ui/node";

const app = createNodeApp({
  initialState: { count: 0 },
  config: {
    fpsCap: 30,
    maxDrawlistBytes: 4 \<< 20, // 4 MiB
    drawlistValidateParams: false, // trusted inputs, skip validation
    maxFramesInFlight: 2,
  },
});
```

## [AppConfig Reference](https://rezitui.dev/docs/backend/engine-config\#appconfig-reference)

```
type AppConfig = Readonly\<{
  fpsCap?: number;
  maxEventBytes?: number;
  maxDrawlistBytes?: number;
  drawlistValidateParams?: boolean;
  drawlistReuseOutputBuffer?: boolean;
  drawlistEncodedStringCacheCap?: number;
  maxFramesInFlight?: number;
  internal_onRender?: (metrics: AppRenderMetrics) => void;
  internal_onLayout?: (snapshot: AppLayoutSnapshot) => void;
}>;
```

`internal_onRender` and `internal_onLayout` are internal inspector hooks and
default to `undefined`.

### [fpsCap](https://rezitui.dev/docs/backend/engine-config\#fpscap)

| Detail | Value |
| --- | --- |
| Type | `number` (positive integer, `\<= 1000`) |
| Default | `60` |

Controls the maximum frames per second the runtime will attempt to render. The
runtime uses this value for frame pacing -- it will not render faster than the
specified rate even if the backend can consume frames faster. Lower values reduce
CPU usage at the cost of visual responsiveness.

```
config: {
  fpsCap: 30, // cap at 30 fps for a low-power scenario
}
```

### [maxEventBytes](https://rezitui.dev/docs/backend/engine-config\#maxeventbytes)

| Detail | Value |
| --- | --- |
| Type | `number` (positive integer, `\<= 4 \<< 20`) |
| Default | `1 \<< 20` (1 MiB) |

Upper limit on the byte size of a single event batch received from the backend.
If the backend sends an event batch larger than this value, it is rejected. This
acts as a safety valve to prevent unbounded memory growth from a misbehaving
backend or extremely large paste events.

### [maxDrawlistBytes](https://rezitui.dev/docs/backend/engine-config\#maxdrawlistbytes)

| Detail | Value |
| --- | --- |
| Type | `number` (positive integer) |
| Default | `2 \<< 20` (2 MiB) |

Maximum byte size of a single rendered drawlist frame. If the builder exceeds
this limit during frame construction, the frame is rejected. Increase this value
for applications with very large terminal viewports or extremely dense UIs.

```
config: {
  maxDrawlistBytes: 4 \<< 20, // 4 MiB for a large dashboard
}
```

### [drawlistValidateParams](https://rezitui.dev/docs/backend/engine-config\#drawlistvalidateparams)

| Detail | Value |
| --- | --- |
| Type | `boolean` |
| Default | `true` |

When `true`, the drawlist builder validates every command parameter (coordinates,
dimensions, color values, string lengths) before encoding. This catches bugs
early but adds overhead to every draw call.

Set to `false` when inputs are trusted and you want maximum rendering throughput.
For `createApp`/`createNodeApp`, the app-level default is `true`. If you
instantiate `WidgetRenderer` directly and omit `drawlistValidateParams`, that
constructor defaults builder validation to `false` for widget render paths.

```
config: {
  drawlistValidateParams: false, // skip validation for performance
}
```

### [drawlistReuseOutputBuffer](https://rezitui.dev/docs/backend/engine-config\#drawlistreuseoutputbuffer)

| Detail | Value |
| --- | --- |
| Type | `boolean` |
| Default | `true` (in the app runtime) |

When `true`, the drawlist builder reuses its output `ArrayBuffer` across frames
instead of allocating a new one each time. This eliminates per-frame allocation
overhead and reduces GC pressure.

This optimization is safe when the runtime enforces a single in-flight frame
(the default). If you increase `maxFramesInFlight` above 1, the runtime
automatically manages separate buffers for each in-flight frame, so this setting
remains safe regardless of the pipelining depth.

### [drawlistEncodedStringCacheCap](https://rezitui.dev/docs/backend/engine-config\#drawlistencodedstringcachecap)

| Detail | Value |
| --- | --- |
| Type | `number` (non-negative integer) |
| Default | `1024` |

Maximum number of UTF-8 encoded strings to cache across frames. The drawlist
builder maintains a cache of encoded strings to avoid redundant
`TextEncoder.encode()` calls for repeated text content (labels, titles, static
UI strings). When the cache reaches this capacity, it is flushed entirely and
rebuilt from scratch on subsequent frames.

Set to `0` to disable the cache entirely. Increase above the default if your
application renders many unique but repeated strings across frames.

```
config: {
  drawlistEncodedStringCacheCap: 2048, // larger cache for text-heavy UIs
}
```

### [maxFramesInFlight](https://rezitui.dev/docs/backend/engine-config\#maxframesinflight)

| Detail | Value |
| --- | --- |
| Type | `number` (1--4) |
| Default | `1` |

Controls how many rendered frames can be in-flight (submitted to the backend but
not yet acknowledged) simultaneously. The value is clamped to the range `[1, 4]`.

- **1 (default):** No pipelining. The runtime waits for the backend to
acknowledge the current frame before rendering the next one. Simplest model,
lowest memory usage.
- **2--4:** Enables frame pipelining. The runtime can render ahead while the
backend is still processing a previous frame. This reduces perceived latency
on backends with non-trivial frame processing time, at the cost of higher
memory usage (one drawlist buffer per in-flight frame).

```
config: {
  maxFramesInFlight: 2, // allow one frame of look-ahead
}
```

## [Default Values Summary](https://rezitui.dev/docs/backend/engine-config\#default-values-summary)

| Property | Default |
| --- | --- |
| `fpsCap` | `60` |
| `maxEventBytes` | `1048576` (1 MiB) |
| `maxDrawlistBytes` | `2097152` (2 MiB) |
| `drawlistValidateParams` | `true` (app runtime default) |
| `drawlistReuseOutputBuffer` | `true` |
| `drawlistEncodedStringCacheCap` | `1024` |
| `maxFramesInFlight` | `1` |

## [See Also](https://rezitui.dev/docs/backend/engine-config\#see-also)

- [Node/Bun backend](https://rezitui.dev/docs/backend/node)
- [Terminal capabilities](https://rezitui.dev/docs/backend/terminal-caps)
- [Packages: @rezi-ui/node](https://rezitui.dev/docs/packages/node)

[Native Addon\\
\\
@rezi-ui/native provides the Node.js binding to the Zireael C engine. It is built with napi-rs and ships prebuilt binaries for all supported platforms, so most users never need a C toolchain.](https://rezitui.dev/docs/backend/native) [Terminal Capabilities\\
\\
The Zireael engine detects terminal capabilities at startup and surfaces them to the framework via the TerminalCaps type.](https://rezitui.dev/docs/backend/terminal-caps)

### On this page

[Quick Example](https://rezitui.dev/docs/backend/engine-config#quick-example) [AppConfig Reference](https://rezitui.dev/docs/backend/engine-config#appconfig-reference) [fpsCap](https://rezitui.dev/docs/backend/engine-config#fpscap) [maxEventBytes](https://rezitui.dev/docs/backend/engine-config#maxeventbytes) [maxDrawlistBytes](https://rezitui.dev/docs/backend/engine-config#maxdrawlistbytes) [drawlistValidateParams](https://rezitui.dev/docs/backend/engine-config#drawlistvalidateparams) [drawlistReuseOutputBuffer](https://rezitui.dev/docs/backend/engine-config#drawlistreuseoutputbuffer) [drawlistEncodedStringCacheCap](https://rezitui.dev/docs/backend/engine-config#drawlistencodedstringcachecap) [maxFramesInFlight](https://rezitui.dev/docs/backend/engine-config#maxframesinflight) [Default Values Summary](https://rezitui.dev/docs/backend/engine-config#default-values-summary) [See Also](https://rezitui.dev/docs/backend/engine-config#see-also)