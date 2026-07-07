import { afterEach, expect, test } from "bun:test";
import { jifVersion } from "../src/version.ts";

const originalVersion = process.env.JIF_VERSION;

afterEach(() => {
  if (originalVersion === undefined) {
    delete process.env.JIF_VERSION;
  } else {
    process.env.JIF_VERSION = originalVersion;
  }
});

test("jifVersion reads JIF_VERSION", () => {
  process.env.JIF_VERSION = "1.2.3";
  expect(jifVersion()).toBe("1.2.3");
});

test("jifVersion falls back to dev when unset", () => {
  delete process.env.JIF_VERSION;
  expect(jifVersion()).toBe("dev");
});

test("jifVersion falls back to dev when blank", () => {
  process.env.JIF_VERSION = "   ";
  expect(jifVersion()).toBe("dev");
});
