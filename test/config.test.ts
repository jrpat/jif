import { expect, test } from "bun:test";
import {
  defaultAppConfig,
  resolveAppConfig,
  resolveThemeMode,
  type AppConfig,
} from "../src/config/index.ts";

test("resolveAppConfig resolves semantic colors for the default dark mode", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.colorScheme.mode).toBe("dark");
  expect(resolved.colorScheme.semanticColors.chromeFillOne).toBeUndefined();
  expect(typeof resolved.colorScheme.semanticColors.graphWorkingCopy).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.rowSelectedFill).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.rowSelectedAccent).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.statusError).toBe("string");
});

test("resolveAppConfig uses detected light mode for auto themes", () => {
  const resolved = resolveAppConfig(defaultAppConfig, {
    detectedThemeMode: "light",
  });

  expect(resolved.colorScheme.mode).toBe("light");
  expect(resolved.colorScheme.semanticColors.textPrimary).toBe("#13202b");
});

test("resolveAppConfig honors explicit dark mode over detection", () => {
  const config: AppConfig = {
    colorScheme: {
      mode: "dark",
    },
  };

  const resolved = resolveAppConfig(config, {
    detectedThemeMode: "light",
  });

  expect(resolved.colorScheme.mode).toBe("dark");
  expect(resolved.colorScheme.semanticColors.textPrimary).toBe("#edf2f7");
});

test("resolveAppConfig defaults log.scrollMargin to 1", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.log.scrollMargin).toBe(1);
});

test("resolveThemeMode falls back to detected mode for auto", () => {
  expect(resolveThemeMode("auto", "light")).toBe("light");
  expect(resolveThemeMode(undefined, "dark")).toBe("dark");
  expect(resolveThemeMode("auto", null)).toBe("dark");
});
