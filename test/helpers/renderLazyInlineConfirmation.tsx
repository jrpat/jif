import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { lazyComponent } from "../../src/ui/lazyComponent.ts";

const config = resolveAppConfig({});

// Mirrors how render.tsx defers non-first-paint components.
const LazyInlineConfirmation = lazyComponent(() =>
  import("../../src/ui/InlineConfirmation.tsx").then((module) => module.InlineConfirmation)
);

const rendered = await testRender(() => (
  <box width={60} height={10} flexDirection="column">
    <LazyInlineConfirmation
      config={config}
      message="Abandon revision xyz?"
      options={["yes", "no"]}
      selectedOption="yes"
    />
  </box>
), { width: 60, height: 10 });

await rendered.renderOnce();
const framePending = rendered.captureCharFrame();

// The module resolves asynchronously; once loaded, the component must swap
// in on a subsequent frame without a remount.
await LazyInlineConfirmation.preload();
await rendered.renderOnce();
await rendered.renderOnce();

const frame = rendered.captureCharFrame();
rendered.renderer.destroy();

console.log(JSON.stringify({ framePending, frame }));
