import type { ScrollBoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { EventLogEntry } from "../../src/domain/types.ts";
import { NotificationsOverlay } from "../../src/ui/NotificationsOverlay.tsx";
import "../../src/ui/scrollboxRegistration.ts";

const config = resolveAppConfig({});

const longLine = "a-very-long-notification-line-that-far-exceeds-the-viewport-width-so-the-card-must-scroll-horizontally";

const entries: readonly EventLogEntry[] = [
  {
    id: "evt-0",
    text: `${longLine}\nshort line`,
    commandText: "jj describe -r abc",
    level: "info",
    createdAt: 0,
  },
  {
    id: "evt-1",
    text: "ordinary notification\nline two\nline three\nline four\nline five\nline six\nline seven",
    level: "warning",
    createdAt: 1,
  },
];

const [expandedIds, setExpandedIds] = createSignal<readonly string[]>([]);

const rendered = await testRender(() => (
  <box width={40} height={20} flexDirection="column">
    <NotificationsOverlay
      entries={entries}
      focusedIndex={0}
      expandedIds={expandedIds()}
      config={config}
      onFocusEntry={() => {}}
    />
  </box>
), { width: 40, height: 20 });

const initialFirstScrollbox = findScrollbox(
  rendered.renderer.root.findDescendantById("notification-0"),
);
const initialVerticalScrollbarVisible =
  initialFirstScrollbox?.verticalScrollBar.visible ?? null;
const initialHorizontalScrollbarVisible =
  initialFirstScrollbox?.horizontalScrollBar.visible ?? null;

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

const firstScrollboxBefore = findScrollbox(cardEl);
const expandedScrollboxBefore = findScrollbox(
  rendered.renderer.root.findDescendantById("notification-1"),
);
const firstTextContentBefore = (
  firstScrollboxBefore?.getChildren()[0] as { content?: unknown } | undefined
)?.content;

setExpandedIds(["evt-1"]);

const firstScrollboxAfter = findScrollbox(
  rendered.renderer.root.findDescendantById("notification-0"),
);
const expandedScrollboxAfter = findScrollbox(
  rendered.renderer.root.findDescendantById("notification-1"),
);
const firstTextContentAfter = (
  firstScrollboxAfter?.getChildren()[0] as { content?: unknown } | undefined
)?.content;
const verticalScrollbarVisibleImmediatelyAfterExpansion =
  firstScrollboxAfter?.verticalScrollBar.visible ?? null;

await rendered.renderOnce();

rendered.renderer.destroy();

const lines = frame.trimEnd().split("\n");
const longLineHead = longLine.slice(0, 10);
const longLineRowIndex = lines.findIndex((line) => line.includes(longLineHead));
const longLineRowText = longLineRowIndex >= 0 ? lines[longLineRowIndex]! : "";
const commandRowIndex = lines.findIndex((line) => line.includes("❯ jj describe -r abc"));
const ordinaryNotificationRowIndex = lines.findIndex((line) => line.includes("ordinary notification"));

console.log(JSON.stringify({
  scrollboxFound,
  scrollWidth,
  viewportWidth,
  longLineRowIndex,
  longLineRowText,
  commandRowIndex,
  ordinaryNotificationRowIndex,
  initialVerticalScrollbarVisible,
  initialHorizontalScrollbarVisible,
  firstScrollboxStable: firstScrollboxBefore === firstScrollboxAfter,
  expandedScrollboxStable: expandedScrollboxBefore === expandedScrollboxAfter,
  unrelatedTextContentStable: firstTextContentBefore === firstTextContentAfter,
  verticalScrollbarVisibleImmediatelyAfterExpansion,
  frame,
}));
