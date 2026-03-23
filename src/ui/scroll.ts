import type { ScrollBoxRenderable } from "@opentui/core";

export function scrollToKeepChildVisible(
  scrollbox: ScrollBoxRenderable,
  childId: string,
  direction: "down" | "up",
): void {
  const child = scrollbox.findDescendantById(childId);
  if (!child) return;

  const vpTop = scrollbox.viewport.y;
  const vpBottom = vpTop + scrollbox.viewport.height;

  if (direction === "down") {
    const childBottom = child.y + child.height;
    if (childBottom > vpBottom) {
      scrollbox.scrollBy(childBottom - vpBottom);
    }
  } else {
    if (child.y < vpTop) {
      scrollbox.scrollBy(child.y - vpTop);
    }
  }
}
