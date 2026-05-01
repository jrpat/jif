import type { ScrollBoxRenderable } from "@opentui/core";

type BottomAwareScrollBox = Pick<ScrollBoxRenderable, "scrollBy" | "scrollTop" | "scrollHeight" | "viewport">;

export function isScrollboxAtBottom(scrollbox: BottomAwareScrollBox, threshold = 0): boolean {
  const maxScrollTop = Math.max(0, scrollbox.scrollHeight - scrollbox.viewport.height);
  return scrollbox.scrollTop >= maxScrollTop - threshold;
}

export function observeScrollboxBottomReached(
  scrollbox: BottomAwareScrollBox,
  onBottomReached: () => void,
  threshold = 0,
): () => void {
  const originalScrollBy = scrollbox.scrollBy.bind(scrollbox);
  type ScrollBy = ScrollBoxRenderable["scrollBy"];

  scrollbox.scrollBy = ((delta: Parameters<ScrollBy>[0], unit?: Parameters<ScrollBy>[1]) => {
    originalScrollBy(delta, unit);
    if (isScrollboxAtBottom(scrollbox, threshold)) {
      onBottomReached();
    }
  }) as ScrollBy;

  return () => {
    scrollbox.scrollBy = originalScrollBy as ScrollBy;
  };
}

export function observeScrollboxInteraction(
  scrollbox: Pick<ScrollBoxRenderable, "scrollBy">,
  onInteraction: () => void,
): () => void {
  const originalScrollBy = scrollbox.scrollBy.bind(scrollbox);
  type ScrollBy = ScrollBoxRenderable["scrollBy"];

  scrollbox.scrollBy = ((delta: Parameters<ScrollBy>[0], unit?: Parameters<ScrollBy>[1]) => {
    originalScrollBy(delta, unit);
    onInteraction();
  }) as ScrollBy;

  return () => {
    scrollbox.scrollBy = originalScrollBy as ScrollBy;
  };
}

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
