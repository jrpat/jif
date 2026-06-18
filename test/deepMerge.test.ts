import { expect, test } from "bun:test";
import { deepMergeConfigs, mergeConfigLayers } from "../src/config/deepMerge.ts";
import type { AppConfig } from "../src/config/index.ts";

test("deepMergeConfigs recurses into plain objects", () => {
  const merged = deepMergeConfigs({ a: { b: 1 } }, { a: { c: 2 } });
  expect(merged).toEqual({ a: { b: 1, c: 2 } });
});

test("deepMergeConfigs treats undefined override values as no-ops", () => {
  const base: { a: number | undefined } = { a: 1 };
  const override: { a: number | undefined } = { a: undefined };
  const merged = deepMergeConfigs(base, override);
  expect(merged.a).toBe(1);
});

test("deepMergeConfigs lets null override existing values", () => {
  const base: { a: number | null } = { a: 1 };
  const merged = deepMergeConfigs(base, { a: null });
  expect(merged).toEqual({ a: null });
});

test("deepMergeConfigs replaces arrays wholesale", () => {
  const merged = deepMergeConfigs({ a: [1, 2] }, { a: [3] });
  expect(merged).toEqual({ a: [3] });
});

test("deepMergeConfigs replaces functions wholesale", () => {
  const fA = () => "a";
  const fB = () => "b";
  const merged = deepMergeConfigs({ run: fA }, { run: fB });
  expect(merged.run).toBe(fB);
});

test("deepMergeConfigs treats objects containing functions as atomic", () => {
  const fA = () => "a";
  const fB = () => "b";
  const merged = deepMergeConfigs(
    { normal: { g: { title: "A", stale: true, run: fA } } },
    { normal: { g: { title: "B", run: fB } } },
  );
  expect(merged.normal.g.title).toBe("B");
  expect(merged.normal.g.run).toBe(fB);
  expect((merged.normal.g as { stale?: boolean }).stale).toBeUndefined();
  expect(Object.keys(merged.normal.g).sort()).toEqual(["run", "title"]);
});

test("deepMergeConfigs preserves siblings when merging keymap-shaped objects", () => {
  const fA = () => "a";
  const fB = () => "b";
  const merged = deepMergeConfigs(
    { normal: { g: { title: "G", run: fA } } },
    { normal: { h: { title: "H", run: fB } } },
  );
  expect(merged.normal.g.run).toBe(fA);
  expect(merged.normal.h.run).toBe(fB);
});

test("deepMergeConfigs left-fold matches right-fold for non-overlapping keys", () => {
  const a = { x: 1 };
  const b = { y: 2 };
  const c = { z: 3 };
  const left = deepMergeConfigs(deepMergeConfigs(a, b), c);
  const right = deepMergeConfigs(a, deepMergeConfigs(b, c));
  expect(left).toEqual(right);
});

test("deepMergeConfigs does not mutate inputs", () => {
  const base = { a: { b: 1 } };
  const override = { a: { c: 2 } };
  const baseSnapshot = JSON.parse(JSON.stringify(base));
  const overrideSnapshot = JSON.parse(JSON.stringify(override));
  deepMergeConfigs(base, override);
  expect(base).toEqual(baseSnapshot);
  expect(override).toEqual(overrideSnapshot);
});

test("deepMergeConfigs returns base when override is undefined", () => {
  const base = { a: 1 };
  expect(deepMergeConfigs(base, undefined)).toEqual({ a: 1 });
});

test("mergeConfigLayers folds left across the layer stack", () => {
  const layers: AppConfig[] = [
    { log: { scrollMargin: 1, revisionIdAdditionalChars: 1 } },
    { log: { scrollMargin: 2 } },
    { log: { revisionIdAdditionalChars: 9 } },
  ];

  const merged = mergeConfigLayers(layers);

  expect(merged.log?.scrollMargin).toBe(2);
  expect(merged.log?.revisionIdAdditionalChars).toBe(9);
});

test("mergeConfigLayers returns empty object for empty input", () => {
  expect(mergeConfigLayers([])).toEqual({});
});
