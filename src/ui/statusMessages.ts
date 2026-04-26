import type { ResolvedAppConfig } from "../config/schema.ts";

export const STATUS_MESSAGE_DURATION_MS = 5000;

export function getStatusMessageDismissDelay(
  createdAt: number,
  now = Date.now(),
): number {
  return Math.max(0, STATUS_MESSAGE_DURATION_MS - (now - createdAt));
}

export function getStatusColor(
  level: "info" | "success" | "warning" | "error",
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"],
): string | undefined {
  switch (level) {
    case "success":
      return colors.statusSuccess;
    case "warning":
      return colors.statusWarning;
    case "error":
      return colors.statusError;
    default:
      return colors.statusInfo;
  }
}
