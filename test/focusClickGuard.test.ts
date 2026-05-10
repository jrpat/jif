import { expect, test } from "bun:test";
import { CliRenderEvents } from "@opentui/core";
import { FOCUS_CLICK_GRACE_MS, createFocusClickGuard } from "../src/ui/focusClickGuard.ts";

function createMockRenderer() {
  const listeners = new Set<() => void>();
  return {
    on(_event: CliRenderEvents.FOCUS, listener: () => void) {
      listeners.add(listener);
    },
    off(_event: CliRenderEvents.FOCUS, listener: () => void) {
      listeners.delete(listener);
    },
    emitFocus() {
      for (const listener of listeners) listener();
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

test("isWithinFocusGrace returns false before any focus event", () => {
  const renderer = createMockRenderer();
  const guard = createFocusClickGuard(renderer, { now: () => 1000 });

  expect(guard.isWithinFocusGrace()).toBe(false);
  guard.dispose();
});

test("isWithinFocusGrace is true within grace window after focus, false after", () => {
  const renderer = createMockRenderer();
  let nowMs = 1000;
  const guard = createFocusClickGuard(renderer, { now: () => nowMs });

  renderer.emitFocus();
  expect(guard.isWithinFocusGrace()).toBe(true);

  nowMs += FOCUS_CLICK_GRACE_MS - 1;
  expect(guard.isWithinFocusGrace()).toBe(true);

  nowMs += 1;
  expect(guard.isWithinFocusGrace()).toBe(false);

  guard.dispose();
});

test("dispose unsubscribes from the focus event", () => {
  const renderer = createMockRenderer();
  const guard = createFocusClickGuard(renderer);

  expect(renderer.listenerCount()).toBe(1);
  guard.dispose();
  expect(renderer.listenerCount()).toBe(0);
});
