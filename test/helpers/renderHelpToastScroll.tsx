import type { ScrollBoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { MessageOverlay } from "../../src/ui/statusArea.tsx";

const config = resolveAppConfig({});
const longMessage = Array.from(
  { length: 40 },
  (_, index) => `help line ${index + 1}`,
).join("\n");

let helpViewport: ScrollBoxRenderable | undefined;

const rendered = await testRender(
  () => (
    <box width={40} height="100%" flexDirection="column">
      <MessageOverlay
        messages={[
          {
            id: "toast-1",
            text: longMessage,
            level: "success",
            variant: "help",
            createdAt: 0,
            lastInteractedAt: 0,
          },
        ]}
        loading={false}
        config={config}
        bottomInset={0}
        maxToastBodyHeight={3}
        maxHelpToastBodyHeight={12}
        registerHelpViewport={(el) => { helpViewport = el; }}
        onInteract={() => {}}
        onDismiss={() => {}}
      />
    </box>
  ),
  { width: 40, height: 20 },
);

await rendered.renderOnce();
await rendered.renderOnce();

const registered = helpViewport !== undefined;
const scrollTopBefore = helpViewport?.scrollTop ?? -1;

// Drive the viewport the way the help-mode scroll commands do.
helpViewport?.scrollBy({ x: 0, y: 8 });
await rendered.renderOnce();
const scrollTopAfter = helpViewport?.scrollTop ?? -1;

rendered.renderer.destroy();

console.log(JSON.stringify({ registered, scrollTopBefore, scrollTopAfter }));
