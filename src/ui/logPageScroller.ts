import type { ScrollBoxRenderable } from "@opentui/core";

type LogViewport = Pick<
  ScrollBoxRenderable,
  "scrollBy" | "scrollHeight" | "scrollTop" | "viewport"
>;

function clampScrollTop(viewport: LogViewport, value: number): number {
  const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.viewport.height);
  return Math.max(0, Math.min(maxScrollTop, value));
}

export function createLogPageScroller(options: Readonly<{
  getViewport(): LogViewport | undefined;
}>) {
  const scrollByPage = (pageDelta: number) => {
    if (!Number.isFinite(pageDelta) || pageDelta === 0) return;

    const viewport = options.getViewport();
    if (!viewport) return;

    const rows = Math.max(
      1,
      Math.floor(viewport.viewport.height * Math.abs(pageDelta)),
    );
    const target = clampScrollTop(
      viewport,
      viewport.scrollTop + Math.sign(pageDelta) * rows,
    );
    const delta = target - viewport.scrollTop;
    if (delta !== 0) {
      viewport.scrollBy({ x: 0, y: delta });
    }
  };

  return { scrollByPage } as const;
}
