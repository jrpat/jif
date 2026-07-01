import type { MouseEvent, ScrollBoxRenderable } from "@opentui/core";

type BottomAwareScrollBox = Pick<ScrollBoxRenderable, "scrollBy" | "scrollTop" | "scrollHeight" | "viewport">;
export type ScrollVisibilityDirection = "down" | "up" | "nearest";

type MouseEventHandler = (event: MouseEvent) => void;
type WithMouseEvent = { onMouseEvent: MouseEventHandler };

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

  // Mouse wheel and scrollbar drag in OpenTUI mutate scrollTop directly inside
  // ScrollBoxRenderable.onMouseEvent, bypassing scrollBy. Wrap that path too so
  // reaching the bottom via the mouse triggers the callback.
  const mouseTarget = scrollbox as unknown as Partial<WithMouseEvent>;
  const originalOnMouseEvent = mouseTarget.onMouseEvent?.bind(scrollbox);
  if (originalOnMouseEvent) {
    mouseTarget.onMouseEvent = (event: MouseEvent) => {
      originalOnMouseEvent(event);
      if ((event.type === "scroll" || event.type === "drag") && isScrollboxAtBottom(scrollbox, threshold)) {
        onBottomReached();
      }
    };
  }

  return () => {
    scrollbox.scrollBy = originalScrollBy as ScrollBy;
    if (originalOnMouseEvent) {
      mouseTarget.onMouseEvent = originalOnMouseEvent;
    }
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
  direction: ScrollVisibilityDirection,
): void {
  const child = scrollbox.findDescendantById(childId);
  if (!child) return;

  const vpTop = scrollbox.viewport.y;
  const vpBottom = vpTop + scrollbox.viewport.height;
  const childBottom = child.y + child.height;

  if (direction === "down") {
    if (childBottom > vpBottom) {
      scrollbox.scrollBy(childBottom - vpBottom);
    }
    return;
  }

  if (direction === "up") {
    if (child.y < vpTop) scrollbox.scrollBy(child.y - vpTop);
    return;
  }

  if (child.y < vpTop) {
    scrollbox.scrollBy(child.y - vpTop);
  } else if (childBottom > vpBottom) {
    scrollbox.scrollBy(childBottom - vpBottom);
  }
}
