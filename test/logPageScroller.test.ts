import { expect, test } from "bun:test";
import type { ScrollBoxRenderable } from "@opentui/core";
import { createLogPageScroller } from "../src/ui/logPageScroller.ts";

function createViewport(options: {
  scrollTop?: number;
  scrollHeight?: number;
  viewportY?: number;
  viewportHeight?: number;
  children?: Record<string, { y: number; height: number }>;
}) {
  let scrollTop = options.scrollTop ?? 0;
  const scrollHeight = options.scrollHeight ?? 100;
  const viewportHeight = options.viewportHeight ?? 20;
  const deltas: number[] = [];
  const viewport = {
    get scrollTop() {
      return scrollTop;
    },
    scrollHeight,
    viewport: { y: options.viewportY ?? 0, height: viewportHeight },
    findDescendantById(id: string) {
      return options.children?.[id];
    },
    scrollBy(delta: { x: number; y: number }) {
      deltas.push(delta.y);
      const maxScrollTop = Math.max(0, scrollHeight - viewportHeight);
      scrollTop = Math.max(0, Math.min(maxScrollTop, scrollTop + delta.y));
    },
  } as unknown as ScrollBoxRenderable;
  return { viewport, deltas, getScrollTop: () => scrollTop };
}

test("scrolls synchronously by half a viewport", () => {
  const { viewport, deltas, getScrollTop } = createViewport({
    scrollTop: 7,
    viewportHeight: 21,
  });
  const scroller = createLogPageScroller({ getViewport: () => viewport });

  scroller.scrollByPage(0.5);

  expect(deltas).toEqual([10]);
  expect(getScrollTop()).toBe(17);
});

test("clamps page scrolling to the viewport scroll range", () => {
  const { viewport, deltas, getScrollTop } = createViewport({
    scrollTop: 72,
    scrollHeight: 100,
    viewportHeight: 20,
  });
  const scroller = createLogPageScroller({ getViewport: () => viewport });

  scroller.scrollByPage(0.5);
  scroller.scrollByPage(-20);

  expect(deltas).toEqual([8, -80]);
  expect(getScrollTop()).toBe(0);
});

test("repeated input applies each half-page immediately", () => {
  const { viewport, deltas, getScrollTop } = createViewport({ viewportHeight: 20 });
  const scroller = createLogPageScroller({ getViewport: () => viewport });

  scroller.scrollByPage(0.5);
  scroller.scrollByPage(0.5);
  scroller.scrollByPage(-0.5);

  expect(deltas).toEqual([10, 10, -10]);
  expect(getScrollTop()).toBe(10);
});

test("ignores unavailable viewports and invalid page deltas", () => {
  const { viewport, deltas } = createViewport({});
  let currentViewport: ScrollBoxRenderable | undefined;
  const scroller = createLogPageScroller({ getViewport: () => currentViewport });

  scroller.scrollByPage(0.5);
  currentViewport = viewport;
  scroller.scrollByPage(0);
  scroller.scrollByPage(Number.NaN);

  expect(deltas).toEqual([]);
});

test("centers a child in the viewport", () => {
  const { viewport, deltas, getScrollTop } = createViewport({
    scrollTop: 20,
    viewportY: 3,
    viewportHeight: 10,
    children: { focused: { y: 10, height: 2 } },
  });
  const scroller = createLogPageScroller({ getViewport: () => viewport });

  scroller.centerChild("focused");

  expect(deltas).toEqual([3]);
  expect(getScrollTop()).toBe(23);
});

test("clamps centering at the start and end of the scroll range", () => {
  const atStart = createViewport({
    scrollTop: 2,
    scrollHeight: 30,
    viewportHeight: 10,
    children: { focused: { y: 0, height: 1 } },
  });
  const startScroller = createLogPageScroller({ getViewport: () => atStart.viewport });

  startScroller.centerChild("focused");

  expect(atStart.deltas).toEqual([-2]);
  expect(atStart.getScrollTop()).toBe(0);

  const atEnd = createViewport({
    scrollTop: 18,
    scrollHeight: 30,
    viewportHeight: 10,
    children: { focused: { y: 14, height: 1 } },
  });
  const endScroller = createLogPageScroller({ getViewport: () => atEnd.viewport });

  endScroller.centerChild("focused");

  expect(atEnd.deltas).toEqual([2]);
  expect(atEnd.getScrollTop()).toBe(20);
});

test("ignores unavailable viewports and missing centered children", () => {
  const { viewport, deltas } = createViewport({});
  let currentViewport: ScrollBoxRenderable | undefined;
  const scroller = createLogPageScroller({ getViewport: () => currentViewport });

  scroller.centerChild("focused");
  currentViewport = viewport;
  scroller.centerChild("focused");

  expect(deltas).toEqual([]);
});
