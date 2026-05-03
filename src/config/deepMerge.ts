import type { AppConfig } from "./schema.ts";

export function deepMergeConfigs<T extends object, U extends object>(
  base: T,
  override: U | undefined,
): T & U {
  if (override === undefined) {
    return { ...base } as T & U;
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  const overrideRecord = override as Record<string, unknown>;

  for (const key of Object.keys(overrideRecord)) {
    const overrideValue = overrideRecord[key];
    if (overrideValue === undefined) continue;

    const baseValue = result[key];
    if (
      isPlainObject(baseValue) &&
      isPlainObject(overrideValue) &&
      !containsFunction(baseValue) &&
      !containsFunction(overrideValue)
    ) {
      result[key] = deepMergeConfigs(baseValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  }

  return result as T & U;
}

export function mergeConfigLayers(layers: readonly AppConfig[]): AppConfig {
  return layers.reduce<AppConfig>(
    (acc, layer) => deepMergeConfigs(acc, layer),
    {} as AppConfig,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function containsFunction(obj: Record<string, unknown>): boolean {
  for (const value of Object.values(obj)) {
    if (typeof value === "function") return true;
  }
  return false;
}
