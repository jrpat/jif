import { expect, test } from "bun:test";
import {
  configureOpenTUIPaletteIdleTimeout,
  DEFAULT_PALETTE_IDLE_TIMEOUT_MS,
} from "../src/opentuiPaletteIdleTimeout.ts";

test("configureOpenTUIPaletteIdleTimeout shortens OpenTUI's palette idle window by default", () => {
  const env: { OTUI_PALETTE_IDLE_TIMEOUT_MS?: string } = {};

  expect(configureOpenTUIPaletteIdleTimeout({ env })).toBeTrue();
  expect(env.OTUI_PALETTE_IDLE_TIMEOUT_MS).toBe(String(DEFAULT_PALETTE_IDLE_TIMEOUT_MS));
});

test("configureOpenTUIPaletteIdleTimeout preserves explicit overrides", () => {
  const env = { OTUI_PALETTE_IDLE_TIMEOUT_MS: "300" };

  expect(configureOpenTUIPaletteIdleTimeout({ env })).toBeFalse();
  expect(env.OTUI_PALETTE_IDLE_TIMEOUT_MS).toBe("300");
});

test("configureOpenTUIPaletteIdleTimeout treats blank overrides as unset", () => {
  const env = { OTUI_PALETTE_IDLE_TIMEOUT_MS: "  " };

  expect(configureOpenTUIPaletteIdleTimeout({ env })).toBeTrue();
  expect(env.OTUI_PALETTE_IDLE_TIMEOUT_MS).toBe(String(DEFAULT_PALETTE_IDLE_TIMEOUT_MS));
});
