import { expect, test } from "bun:test";
import { normalizeKey } from "../src/ui/keyboard.ts";

test("normalizeKey keeps printable sequences when already shifted", () => {
  expect(normalizeKey({ name: "s", sequence: "S", shift: true })).toBe("S");
  expect(normalizeKey({ name: "?", sequence: "?", shift: false })).toBe("?");
});

test("normalizeKey maps shifted punctuation when terminals report the base symbol name", () => {
  expect(normalizeKey({ name: "/", sequence: "/", shift: true })).toBe("?");
  expect(normalizeKey({ name: "-", sequence: "-", shift: true })).toBe("_");
  expect(normalizeKey({ name: "2", sequence: "2", shift: true })).toBe("@");
});

test("normalizeKey maps return to enter", () => {
  expect(normalizeKey({ name: "return", sequence: "\r", shift: false })).toBe("enter");
});
