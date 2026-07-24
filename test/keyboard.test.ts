import { expect, test } from "bun:test";
import { normalizeKey, resolveKeyToken } from "../src/ui/keyboard.ts";

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

test("resolveKeyToken builds plain tokens from unmodified keys", () => {
  expect(resolveKeyToken({ name: "r", sequence: "r" })).toBe("r");
  expect(resolveKeyToken({ name: "s", sequence: "S", shift: true })).toBe("S");
});

test("resolveKeyToken prefixes ctrl combos", () => {
  expect(resolveKeyToken({ name: "o", sequence: "\x0f", ctrl: true })).toBe("ctrl-o");
  expect(resolveKeyToken({ name: "\\", sequence: "\x1c", ctrl: true })).toBe("ctrl-\\");
});

test("resolveKeyToken keeps Alt combos even though OpenTUI also sets meta", () => {
  // OpenTUI reports Alt/Option with BOTH option and meta set; the token must
  // still resolve to alt-* rather than being discarded as a Meta combo.
  expect(resolveKeyToken({ name: "r", sequence: "r", option: true, meta: true })).toBe("alt-r");
  expect(resolveKeyToken({ name: "s", sequence: "s", option: true, meta: true })).toBe("alt-s");
  expect(resolveKeyToken({ name: "j", sequence: "j", option: true, meta: true })).toBe("alt-j");
});

test("resolveKeyToken builds alt-backtick from an Option+backtick press", () => {
  // Under the Kitty keyboard protocol (OpenTUI's default) Option+` reports the
  // backtick as `name` with both option and meta set; the token must resolve to
  // alt-` rather than being discarded as a Meta combo.
  expect(resolveKeyToken({ name: "`", sequence: "`", option: true, meta: true })).toBe("alt-`");
});

test("resolveKeyToken ignores true Meta/Command combos without option", () => {
  expect(resolveKeyToken({ name: "r", sequence: "r", meta: true })).toBeNull();
});

test("resolveKeyToken ignores key releases", () => {
  expect(resolveKeyToken({ name: "r", sequence: "r", eventType: "release" })).toBeNull();
});

test("resolveKeyToken maps modified return to enter", () => {
  expect(resolveKeyToken({ name: "return", sequence: "\r", option: true, meta: true })).toBe("alt-enter");
  expect(resolveKeyToken({ name: "return", sequence: "\r", ctrl: true })).toBe("ctrl-enter");
});
