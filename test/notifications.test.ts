import { expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import {
  cancelOrBlurState,
  closeNotifications,
  collapseFocusedNotification,
  createInitialState,
  expandFocusedNotification,
  focusLogBottom,
  getDisplayedNotifications,
  getFocusedNotification,
  logEvent,
  moveFocus,
  openNotifications,
  pushEvent,
} from "../src/state/store.ts";

function baseState(overrides: { notificationHistoryLimit?: number } = {}): AppState {
  return {
    ...createInitialState("/tmp/repo", overrides),
    loading: false,
  };
}

function pushEvents(state: AppState, count: number, prefix = "event"): AppState {
  let next = state;
  for (let i = 0; i < count; i += 1) {
    next = pushEvent(next, `${prefix}-${i}`, "info", 1_700_000_000_000 + i);
  }
  return next;
}

test("openNotifications switches focus mode and resets focus to top (newest)", () => {
  const state = pushEvents(baseState(), 3);
  const next = openNotifications(state);

  expect(next.focusMode).toBe("notifications");
  expect(next.focusModeStack).toEqual(["revisions", "notifications"]);
  expect(next.focusedNotificationIndex).toBe(0);
  expect(next.expandedNotificationIds).toEqual([]);
});

test("getDisplayedNotifications returns events newest-first", () => {
  const state = pushEvents(baseState(), 3);
  const displayed = getDisplayedNotifications(state);

  expect(displayed.map((entry) => entry.text)).toEqual([
    "event-2",
    "event-1",
    "event-0",
  ]);
});

test("moveFocus in notifications mode is bounded against eventLog length", () => {
  let state = openNotifications(pushEvents(baseState(), 3));

  state = moveFocus(state, 1);
  expect(state.focusedNotificationIndex).toBe(1);
  state = moveFocus(state, 5);
  expect(state.focusedNotificationIndex).toBe(2);
  state = moveFocus(state, -10);
  expect(state.focusedNotificationIndex).toBe(0);
});

test("moveFocus is a no-op when notifications history is empty", () => {
  const state = openNotifications(baseState());
  const next = moveFocus(state, 1);

  expect(next.focusedNotificationIndex).toBe(0);
});

test("focusLogBottom in notifications mode jumps to the oldest entry", () => {
  const state = openNotifications(pushEvents(baseState(), 4));
  const next = focusLogBottom(state);

  expect(next.focusedNotificationIndex).toBe(3);
  expect(getFocusedNotification(next)?.text).toBe("event-0");
});

test("expand/collapse focused notification toggles expandedNotificationIds", () => {
  let state = openNotifications(pushEvents(baseState(), 3));
  const focusedId = getFocusedNotification(state)!.id;

  state = expandFocusedNotification(state);
  expect(state.expandedNotificationIds).toEqual([focusedId]);

  // Idempotent
  state = expandFocusedNotification(state);
  expect(state.expandedNotificationIds).toEqual([focusedId]);

  state = collapseFocusedNotification(state);
  expect(state.expandedNotificationIds).toEqual([]);

  // Idempotent
  state = collapseFocusedNotification(state);
  expect(state.expandedNotificationIds).toEqual([]);
});

test("expand/collapse with no events is a no-op", () => {
  const state = openNotifications(baseState());

  expect(expandFocusedNotification(state)).toEqual(state);
  expect(collapseFocusedNotification(state)).toEqual(state);
});

test("closeNotifications returns to revisions and clears expansion state", () => {
  let state = openNotifications(pushEvents(baseState(), 2));
  state = expandFocusedNotification(state);
  expect(state.expandedNotificationIds.length).toBe(1);

  const next = closeNotifications(state);
  expect(next.focusMode).toBe("revisions");
  expect(next.focusModeStack).toEqual(["revisions"]);
  expect(next.expandedNotificationIds).toEqual([]);
});

test("cancelOrBlurState closes notifications mode", () => {
  const state = openNotifications(pushEvents(baseState(), 2));
  const next = cancelOrBlurState(state);

  expect(next.focusMode).toBe("revisions");
});

test("pushEvent respects notificationHistoryLimit (drops oldest)", () => {
  const state = pushEvents(baseState({ notificationHistoryLimit: 3 }), 5);

  expect(state.eventLog.length).toBe(3);
  expect(state.eventLog.map((entry) => entry.text)).toEqual([
    "event-2",
    "event-3",
    "event-4",
  ]);
});

test("logEvent respects notificationHistoryLimit", () => {
  let state = baseState({ notificationHistoryLimit: 2 });
  state = logEvent(state, "first", "info");
  state = logEvent(state, "second", "info");
  state = logEvent(state, "third", "info");

  expect(state.eventLog.length).toBe(2);
  expect(state.eventLog.map((entry) => entry.text)).toEqual(["second", "third"]);
});

test("notificationHistoryLimit defaults to 50", () => {
  const state = createInitialState("/tmp/repo");
  expect(state.notificationHistoryLimit).toBe(50);
});

test("notificationHistoryLimit floors and clamps to a minimum of 1", () => {
  expect(createInitialState("/tmp/repo", { notificationHistoryLimit: 0 }).notificationHistoryLimit).toBe(1);
  expect(createInitialState("/tmp/repo", { notificationHistoryLimit: -10 }).notificationHistoryLimit).toBe(1);
  expect(createInitialState("/tmp/repo", { notificationHistoryLimit: 7.9 }).notificationHistoryLimit).toBe(7);
});
