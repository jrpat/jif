import { expect, test } from "bun:test";
import {
  isMacScrollPlatform,
  makeScrollAcceleration,
} from "../src/ui/scrollAcceleration.ts";

test("isMacScrollPlatform detects darwin only", () => {
  expect(isMacScrollPlatform("darwin")).toBeTrue();
  expect(isMacScrollPlatform("linux")).toBeFalse();
  expect(isMacScrollPlatform("win32")).toBeFalse();
});

test("makeScrollAcceleration returns a constant one-line step when disabled", () => {
  const accel = makeScrollAcceleration(1, false, "darwin");

  expect(accel.tick(1000)).toBe(1);
  expect(accel.tick(1010)).toBe(1);
});

test("makeScrollAcceleration returns a constant configured step when disabled", () => {
  const accel = makeScrollAcceleration(3, false, "darwin");

  expect(accel.tick(1000)).toBe(3);
  expect(accel.tick(1010)).toBe(3);
});

test("makeScrollAcceleration keeps a constant step off macOS", () => {
  const accel = makeScrollAcceleration(4, true, "linux");

  expect(accel.tick(1000)).toBe(4);
  expect(accel.tick(1010)).toBe(4);
});

test("makeScrollAcceleration uses fresh macOS acceleration instances", () => {
  const first = makeScrollAcceleration(2, true, "darwin");
  const second = makeScrollAcceleration(2, true, "darwin");

  expect(first).not.toBe(second);
  expect(first.tick(1000)).toBe(2);
  expect(first.tick(1020)).toBeGreaterThanOrEqual(2);
  expect(second.tick(1020)).toBe(2);
});

test("makeScrollAcceleration scales macOS acceleration by the configured step", () => {
  const unitStep = makeScrollAcceleration(1, true, "darwin");
  const tripleStep = makeScrollAcceleration(3, true, "darwin");

  expect(unitStep.tick(1000)).toBe(1);
  expect(tripleStep.tick(1000)).toBe(3);

  const unitAccelerated = unitStep.tick(1020);
  const tripleAccelerated = tripleStep.tick(1020);

  expect(unitAccelerated).toBeGreaterThanOrEqual(1);
  expect(tripleAccelerated).toBeGreaterThanOrEqual(3);
  expect(tripleAccelerated).toBeCloseTo(unitAccelerated * 3);
});
