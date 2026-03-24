import { expect, test } from "bun:test";
import {
  defaultAppConfig,
  resolveAppConfig,
  FALLBACK_PALETTE_DARK,
  FALLBACK_PALETTE_LIGHT,
  type AppConfig,
} from "../src/config/index.ts";

test("resolveAppConfig resolves semantic colors from dark fallback palette", () => {
  const resolved = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });

  expect(typeof resolved.colorScheme.semanticColors.chromeFillOne).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.graphWorkingCopy).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.rowSelectedFill).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.rowSelectedAccent).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.statusError).toBe("string");
});

test("resolveAppConfig produces different colors for light vs dark palettes", () => {
  const dark = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });
  const light = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_LIGHT,
  });

  expect(dark.colorScheme.semanticColors.chromeFillOne).not.toBe(
    light.colorScheme.semanticColors.chromeFillOne,
  );
  expect(dark.colorScheme.semanticColors.textPrimary).not.toBe(
    light.colorScheme.semanticColors.textPrimary,
  );
});

test("resolveAppConfig applies user hex overrides", () => {
  const config: AppConfig = {
    colorScheme: {
      colors: {
        statusError: "#ff0000",
      },
    },
  };

  const resolved = resolveAppConfig(config, {
    palette: FALLBACK_PALETTE_DARK,
  });

  expect(resolved.colorScheme.semanticColors.statusError).toBe("#ff0000");
});

test("resolveAppConfig applies user palette ref overrides", () => {
  const config: AppConfig = {
    colorScheme: {
      colors: {
        chromeBorderFocus: { source: "cyan", opacity: 1.0 },
      },
    },
  };

  const resolved = resolveAppConfig(config, {
    palette: FALLBACK_PALETTE_DARK,
  });

  // Cyan in the dark fallback palette is #00cdcd
  expect(resolved.colorScheme.semanticColors.chromeBorderFocus).toBe("#00cdcd");
});

test("resolveAppConfig blends colors at sub-1.0 opacity against background", () => {
  const resolved = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });

  // chromeFillOne is background @ 1.0 → should be the background color directly
  expect(resolved.colorScheme.semanticColors.chromeFillOne).toBe("#000000");

  // chromeFillTwo is foreground @ 0.08 → should be very close to background
  const fillTwo = resolved.colorScheme.semanticColors.chromeFillTwo!;
  expect(fillTwo).not.toBe("#000000");
  expect(fillTwo).not.toBe("#e5e5e5");
  // Should be a very dark gray (foreground #e5e5e5 at 8% over #000000)
  expect(fillTwo.startsWith("#")).toBe(true);
});

test("resolveAppConfig defaults log.scrollMargin to 1", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.log.scrollMargin).toBe(1);
});

test("resolveAppConfig without palette falls back to dark xterm defaults", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  // Should produce the same result as explicitly passing the dark fallback
  const withExplicit = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });

  expect(resolved.colorScheme.semanticColors.chromeFillOne).toBe(
    withExplicit.colorScheme.semanticColors.chromeFillOne,
  );
  expect(resolved.colorScheme.semanticColors.textPrimary).toBe(
    withExplicit.colorScheme.semanticColors.textPrimary,
  );
});
