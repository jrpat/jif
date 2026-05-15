import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { MessageOverlay } from "../../src/ui/statusArea.tsx";

const config = resolveAppConfig({});

const rendered = await testRender(
  () => (
    <box width={40} height="100%" flexDirection="column">
      <MessageOverlay
        messages={[
          {
            id: "toast-1",
            text: "alpha\nbeta\ngamma",
            level: "error",
            createdAt: 0,
            lastInteractedAt: 0,
          },
        ]}
        loading={false}
        config={config}
        bottomInset={0}
        maxToastBodyHeight={12}
        onInteract={() => {}}
        onDismiss={() => {}}
      />
    </box>
  ),
  { width: 40, height: 20 },
);

await rendered.renderOnce();
await rendered.renderOnce();
await rendered.renderOnce();

const frame = rendered.captureCharFrame();
rendered.renderer.destroy();

const renderedLineCount = frame
  .trimEnd()
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .length;

console.log(JSON.stringify({ frame, renderedLineCount }));