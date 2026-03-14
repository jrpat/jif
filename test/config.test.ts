import { darkTheme, lightTheme } from "@rezi-ui/core";
import { expect, test } from "bun:test";
import {
  defaultAppConfig,
  resolveAppConfig,
  resolveThemeMode,
  type AppConfig,
} from "../src/config/index.ts";

test("resolveAppConfig resolves semantic theme color references", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.colorScheme.mode).toBe("dark");
  expect(resolved.colorScheme.semanticColors.chromeFillOne).toBeUndefined();
  expect(typeof resolved.colorScheme.semanticColors.graphWorkingCopy).toBe("number");
  expect(typeof resolved.colorScheme.semanticColors.statusError).toBe("number");
});

test("resolveAppConfig uses detected light mode for auto themes", () => {
  const resolved = resolveAppConfig(defaultAppConfig, {
    detectedThemeMode: "light",
  });

  expect(resolved.colorScheme.mode).toBe("light");
  expect(resolved.colorScheme.theme.name).toBe(lightTheme.name);
});

test("resolveAppConfig honors explicit dark mode over detection", () => {
  const config: AppConfig = {
    colorScheme: {
      ...defaultAppConfig.colorScheme,
      mode: "dark",
    },
  };

  const resolved = resolveAppConfig(config, {
    detectedThemeMode: "light",
  });

  expect(resolved.colorScheme.mode).toBe("dark");
  expect(resolved.colorScheme.theme.name).toBe(darkTheme.name);
});

test("resolveThemeMode falls back to detected mode for auto", () => {
  expect(resolveThemeMode("auto", "light")).toBe("light");
  expect(resolveThemeMode(undefined, "dark")).toBe("dark");
  expect(resolveThemeMode("auto", null)).toBe("dark");
});
