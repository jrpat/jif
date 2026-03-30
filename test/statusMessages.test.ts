import { expect, test } from "bun:test";
import { STATUS_MESSAGE_DURATION_MS, getStatusMessageDismissDelay } from "../src/ui/statusMessages.ts";

test("getStatusMessageDismissDelay returns the remaining lifetime for a recent toast", () => {
  expect(getStatusMessageDismissDelay(1_000, 2_000)).toBe(STATUS_MESSAGE_DURATION_MS - 1_000);
});

test("getStatusMessageDismissDelay expires older toasts independently", () => {
  expect(getStatusMessageDismissDelay(1_000, 7_000)).toBe(0);
  expect(getStatusMessageDismissDelay(4_000, 7_000)).toBe(2_000);
});

test("getStatusMessageDismissDelay is based on createdAt instead of render time", () => {
  const initialDelay = getStatusMessageDismissDelay(1_000, 2_000);
  const rerenderedDelay = getStatusMessageDismissDelay(1_000, 4_000);

  expect(initialDelay).toBe(4_000);
  expect(rerenderedDelay).toBe(2_000);
});
