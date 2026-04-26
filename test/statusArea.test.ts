import { expect, test } from "bun:test";
import { resolveAppConfig } from "../src/config/index.ts";
import { getStatusColor } from "../src/ui/statusMessages.ts";

test("getStatusColor maps each status level to the matching semantic color", () => {
  const colors = resolveAppConfig({}).colorScheme.semanticColors;

  expect(getStatusColor("info", colors)).toBe(colors.statusInfo);
  expect(getStatusColor("success", colors)).toBe(colors.statusSuccess);
  expect(getStatusColor("warning", colors)).toBe(colors.statusWarning);
  expect(getStatusColor("error", colors)).toBe(colors.statusError);
});