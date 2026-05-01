import { expect, test } from "bun:test";
import type { ScrollBoxRenderable } from "@opentui/core";
import {
  isScrollboxAtBottom,
  observeScrollboxInteraction,
  observeScrollboxBottomReached,
  scrollToKeepChildVisible,
} from "../src/ui/scroll.ts";

function createMockScrollBox(options: {
  viewportY: number;
  viewportHeight: number;
  children: Record<string, { y: number; height: number }>;
}) {
  const scrollByDeltas: number[] = [];
  const scrollbox = {
    viewport: { y: options.viewportY, height: options.viewportHeight },
    findDescendantById(id: string) {
      return options.children[id];
    },
    scrollBy(delta: number) {
      scrollByDeltas.push(delta);
    },
  } as unknown as ScrollBoxRenderable;
  return { scrollbox, scrollByDeltas };
}

test("scrolls down when child is below viewport", () => {
  const { scrollbox, scrollByDeltas } = createMockScrollBox({
    viewportY: 3,
    viewportHeight: 10,
    children: { "target": { y: 14, height: 2 } },
  });

  scrollToKeepChildVisible(scrollbox, "target", "down");

  // child bottom (14+2=16) exceeds viewport bottom (3+10=13), delta = 16 - 13 = 3
  expect(scrollByDeltas).toEqual([3]);
});

test("does not scroll down when child is visible", () => {
  const { scrollbox, scrollByDeltas } = createMockScrollBox({
    viewportY: 3,
    viewportHeight: 10,
    children: { "target": { y: 5, height: 2 } },
  });

  scrollToKeepChildVisible(scrollbox, "target", "down");

  expect(scrollByDeltas).toEqual([]);
});

test("scrolls up when child is above viewport", () => {
  const { scrollbox, scrollByDeltas } = createMockScrollBox({
    viewportY: 3,
    viewportHeight: 10,
    children: { "target": { y: 1, height: 2 } },
  });

  scrollToKeepChildVisible(scrollbox, "target", "up");

  // child.y (1) < viewport.y (3), delta = 1 - 3 = -2
  expect(scrollByDeltas).toEqual([-2]);
});

test("does not scroll up when child is visible", () => {
  const { scrollbox, scrollByDeltas } = createMockScrollBox({
    viewportY: 3,
    viewportHeight: 10,
    children: { "target": { y: 5, height: 2 } },
  });

  scrollToKeepChildVisible(scrollbox, "target", "up");

  expect(scrollByDeltas).toEqual([]);
});

test("viewport offset does not pollute coordinate math", () => {
  // Regression test: with viewport.y=5, a child at y=4 is above the viewport.
  // The old code (child.y + scrollTop) would produce an inflated contentY
  // that would fail the scrollTop comparison.
  const { scrollbox, scrollByDeltas } = createMockScrollBox({
    viewportY: 5,
    viewportHeight: 10,
    children: { "target": { y: 4, height: 2 } },
  });

  scrollToKeepChildVisible(scrollbox, "target", "up");

  // child.y (4) < viewport.y (5), delta = 4 - 5 = -1
  expect(scrollByDeltas).toEqual([-1]);
});

test("does not crash when child is not found", () => {
  const { scrollbox, scrollByDeltas } = createMockScrollBox({
    viewportY: 0,
    viewportHeight: 10,
    children: {},
  });

  scrollToKeepChildVisible(scrollbox, "nonexistent", "down");

  expect(scrollByDeltas).toEqual([]);
});

test("isScrollboxAtBottom detects when the viewport is scrolled to the end", () => {
  const scrollbox = {
    scrollTop: 10,
    scrollHeight: 20,
    viewport: { height: 10 },
  } as ScrollBoxRenderable;

  expect(isScrollboxAtBottom(scrollbox)).toBeTrue();
});

test("observeScrollboxBottomReached hooks scrollBy and fires when the viewport reaches the end", () => {
  let scrollTop = 0;
  let triggered = 0;
  const scrollbox = {
    scrollTop,
    scrollHeight: 20,
    viewport: { height: 10 },
    scrollBy(delta: number) {
      scrollTop += delta;
      this.scrollTop = scrollTop;
    },
  } as unknown as ScrollBoxRenderable;

  const dispose = observeScrollboxBottomReached(scrollbox, () => {
    triggered += 1;
  });

  scrollbox.scrollBy(5);
  expect(triggered).toBe(0);

  scrollbox.scrollBy(5);
  expect(triggered).toBe(1);

  dispose();
  scrollbox.scrollBy(-1);
  scrollbox.scrollBy(1);
  expect(triggered).toBe(1);
});

test("observeScrollboxInteraction hooks scrollBy and fires for scroll attempts until disposed", () => {
  let triggered = 0;
  const scrollbox = {
    scrollBy() {},
  } as unknown as ScrollBoxRenderable;

  const dispose = observeScrollboxInteraction(scrollbox, () => {
    triggered += 1;
  });

  scrollbox.scrollBy(1);
  scrollbox.scrollBy(-1);
  expect(triggered).toBe(2);

  dispose();
  scrollbox.scrollBy(1);
  expect(triggered).toBe(2);
});
