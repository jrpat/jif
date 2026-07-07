import { expect, test } from "bun:test";
import { normalizeTag, releaseAssetName } from "../scripts/release/assets.ts";

test("normalizeTag accepts bare and v-prefixed versions", () => {
  expect(normalizeTag("0.2.0")).toEqual({
    tag: "v0.2.0",
    version: "0.2.0",
    prerelease: false,
  });
  expect(normalizeTag("v0.2.0")).toEqual({
    tag: "v0.2.0",
    version: "0.2.0",
    prerelease: false,
  });
});

test("normalizeTag detects prerelease suffixes", () => {
  expect(normalizeTag("0.1.0-beta.1")).toEqual({
    tag: "v0.1.0-beta.1",
    version: "0.1.0-beta.1",
    prerelease: true,
  });
  expect(normalizeTag("v1.0.0-rc.2")).toEqual({
    tag: "v1.0.0-rc.2",
    version: "1.0.0-rc.2",
    prerelease: true,
  });
});

test("normalizeTag rejects invalid versions", () => {
  expect(() => normalizeTag("")).toThrow();
  expect(() => normalizeTag("1.2")).toThrow();
  expect(() => normalizeTag("v1.2.3.4")).toThrow();
  expect(() => normalizeTag("abc")).toThrow();
  expect(() => normalizeTag("1.2.3+meta")).toThrow();
  expect(() => normalizeTag("01.2.3")).toThrow();
  expect(() => normalizeTag("1.2.3-")).toThrow();
});

test("releaseAssetName covers every compile target", () => {
  expect(releaseAssetName("bun-darwin-arm64", "v0.2.0")).toBe("jif-v0.2.0-darwin-arm64.tar.gz");
  expect(releaseAssetName("bun-darwin-x64", "v0.2.0")).toBe("jif-v0.2.0-darwin-x64.tar.gz");
  expect(releaseAssetName("bun-linux-arm64", "v0.2.0")).toBe("jif-v0.2.0-linux-arm64.tar.gz");
  expect(releaseAssetName("bun-linux-x64", "v0.2.0")).toBe("jif-v0.2.0-linux-x64.tar.gz");
  expect(releaseAssetName("bun-windows-arm64", "v0.2.0")).toBe("jif-v0.2.0-windows-arm64.zip");
  expect(releaseAssetName("bun-windows-x64", "v0.2.0")).toBe("jif-v0.2.0-windows-x64.zip");
});

test("releaseAssetName normalizes a bare version and keeps prerelease suffixes", () => {
  expect(releaseAssetName("bun-darwin-arm64", "0.2.0")).toBe("jif-v0.2.0-darwin-arm64.tar.gz");
  expect(releaseAssetName("bun-linux-x64", "v0.1.0-beta.1")).toBe(
    "jif-v0.1.0-beta.1-linux-x64.tar.gz",
  );
});
