import { expect, test } from "bun:test";
import { defaultAppConfig, resolveAppConfig } from "../src/config/index.ts";

test("resolveAppConfig resolves semantic theme color references", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.colorScheme.semanticColors.chromeFillOne).toBeUndefined();
  expect(typeof resolved.colorScheme.semanticColors.graphWorkingCopy).toBe("number");
  expect(typeof resolved.colorScheme.semanticColors.statusError).toBe("number");
});
