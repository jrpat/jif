import type { ScrollBoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { EventLogEntry } from "../../src/domain/types.ts";
import { NotificationsOverlay } from "../../src/ui/NotificationsOverlay.tsx";

const config = resolveAppConfig({});

const longLine = "a-very-long-notification-line-that-far-exceeds-the-viewport-width-so-the-card-must-scroll-horizontally";

const entries: readonly EventLogEntry[] = [
  {
    id: "evt-0",
    text: `${longLine}\nshort line`,
    level: "info",
    createdAt: 0,
  },
];

const rendered = await testRender(() => (
  <box width={40} height={20} flexDirection="column">
    <NotificationsOverlay
      entries={entries}
      focusedIndex={0}
      expandedIds={[]}
      config={config}
      onFocusEntry={() => {}}
    />
  </box>
), { width: 40, height: 20 });

await rendered.renderOnce();
await rendered.renderOnce();
await rendered.renderOnce();

const frame = rendered.captureCharFrame();

const cardEl = rendered.renderer.root.findDescendantById("notification-0");
let scrollboxFound = false;
let scrollWidth = 0;
let viewportWidth = 0;

function findScrollbox(node: { getChildren?: () => readonly any[] } | undefined): ScrollBoxRenderable | undefined {
  if (!node?.getChildren) return undefined;
  for (const child of node.getChildren()) {
    if (child && typeof child === "object" && "scrollWidth" in child && "viewport" in child) {
      return child as ScrollBoxRenderable;
    }
    const nested = findScrollbox(child);
    if (nested) return nested;
  }
  return undefined;
}

if (cardEl) {
  const sb = findScrollbox(cardEl);
  if (sb) {
    scrollboxFound = true;
    scrollWidth = sb.scrollWidth;
    viewportWidth = sb.viewport.width;
  }
}

rendered.renderer.destroy();

const lines = frame.trimEnd().split("\n");
const longLineHead = longLine.slice(0, 10);
const longLineRowIndex = lines.findIndex((line) => line.includes(longLineHead));
const longLineRowText = longLineRowIndex >= 0 ? lines[longLineRowIndex]! : "";

console.log(JSON.stringify({
  scrollboxFound,
  scrollWidth,
  viewportWidth,
  longLineRowIndex,
  longLineRowText,
  frame,
}));
