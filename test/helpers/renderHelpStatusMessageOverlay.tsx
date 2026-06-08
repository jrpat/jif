import { jest } from "bun:test";
import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { MessageOverlay } from "../../src/ui/statusArea.tsx";
import { STATUS_MESSAGE_DURATION_MS } from "../../src/ui/statusMessages.ts";

jest.useFakeTimers({ now: 0 });

const config = resolveAppConfig({});
const dismissCalls: string[] = [];
const longMessage = Array.from(
  { length: 40 },
  (_, index) => `help line ${index + 1}`,
).join("\n");

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
        onInteract={() => {}}
        onDismiss={(id) => {
          dismissCalls.push(id ?? "unknown");
        }}
      />
    </box>
  ),
  { width: 40, height: 20 },
);

await rendered.renderOnce();

// A help toast never auto-dismisses, even long past the normal toast lifetime.
jest.advanceTimersByTime(STATUS_MESSAGE_DURATION_MS * 2);
await rendered.renderOnce();

const frame = rendered.captureCharFrame();
rendered.renderer.destroy();
jest.useRealTimers();

const renderedLineCount = frame
  .trimEnd()
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .length;

console.log(JSON.stringify({ frame, renderedLineCount, dismissCalls }));
