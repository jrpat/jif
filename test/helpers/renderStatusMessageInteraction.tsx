import { jest } from "bun:test";
import type { ScrollBoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import type { StatusMessage } from "../../src/domain/types.ts";
import { resolveAppConfig } from "../../src/config/index.ts";
import { MessageOverlay } from "../../src/ui/statusArea.tsx";
import { STATUS_MESSAGE_DURATION_MS } from "../../src/ui/statusMessages.ts";

jest.useFakeTimers({ now: 0 });

const dismissCalls: string[] = [];
const longMessage = Array.from(
  { length: 40 },
  (_, index) => `status line ${index + 1}`,
).join("\n");

const rendered = await testRender(() => {
  const [messages, setMessages] = createSignal<readonly StatusMessage[]>([
    {
      id: "toast-1",
      text: longMessage,
      level: "success",
      createdAt: 0,
      lastInteractedAt: 0,
    },
  ]);

  return (
    <box width={40} height={20} flexDirection="column">
      <MessageOverlay
        messages={messages()}
        loading={false}
        config={resolveAppConfig({})}
        bottomInset={0}
        maxToastBodyHeight={3}
        onInteract={(id) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === id
                ? { ...message, lastInteractedAt: Date.now() }
                : message
            )
          );
        }}
        onDismiss={(id) => {
          dismissCalls.push(id ?? "unknown");
        }}
      />
    </box>
  );
}, { width: 40, height: 20 });

await rendered.renderOnce();

const body = rendered.renderer.root.findDescendantById(
  "status-toast-body-toast-1",
) as ScrollBoxRenderable | undefined;

jest.advanceTimersByTime(STATUS_MESSAGE_DURATION_MS - 100);
await rendered.renderOnce();

if (body) {
  await rendered.mockMouse.scroll(body.x + 1, body.y + 1, "down");
  await rendered.renderOnce();
}

jest.advanceTimersByTime(STATUS_MESSAGE_DURATION_MS - 100);
await rendered.renderOnce();

jest.advanceTimersByTime(100);
await rendered.renderOnce();

rendered.renderer.destroy();
jest.useRealTimers();

console.log(JSON.stringify({
  bodyFound: body !== undefined,
  dismissCalls,
}));