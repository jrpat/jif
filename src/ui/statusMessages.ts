import type { ResolvedAppConfig } from "../config/schema.ts";

export const STATUS_MESSAGE_DURATION_MS = 5000;
export const STATUS_TOAST_MAX_BODY_LINES = 15;
export const STATUS_TOAST_TERMINAL_HEIGHT_RATIO = 0.15;
// ANSI palette index for blue, used to border help toasts.
export const ANSI_COLOR_BLUE = 4;

export function getStatusMessageDismissDelay(
  lastInteractedAt: number,
  now = Date.now(),
): number {
  return Math.max(0, STATUS_MESSAGE_DURATION_MS - (now - lastInteractedAt));
}

export function getStatusToastMaxBodyHeight(terminalHeight: number): number {
  return Math.max(
    1,
    Math.min(
      STATUS_TOAST_MAX_BODY_LINES,
      Math.floor(terminalHeight * STATUS_TOAST_TERMINAL_HEIGHT_RATIO),
    ),
  );
}

export function getStatusToastBodyHeight(
  text: string,
  maxBodyHeight: number,
): number {
  const outputLineCount = Math.max(1, text.split(/\r\n|\r|\n/).length);
  return Math.min(outputLineCount, maxBodyHeight);
}

// Help toasts grow to fit their text, bounded only by the vertical space the
// overlay actually has: the terminal height above the bottom chrome, less the
// toast's own top and bottom border rows.
export function getStatusHelpToastMaxBodyHeight(
  terminalHeight: number,
  bottomInset: number,
): number {
  return Math.max(1, Math.floor(terminalHeight) - Math.floor(bottomInset) - 2);
}

export function getHelpToastBorderColor(config: ResolvedAppConfig): string | undefined {
  return (
    config.terminalPalette[ANSI_COLOR_BLUE] ??
    getStatusColor("info", config.colorScheme.semanticColors)
  );
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

export function getStatusFillColor(
  level: "info" | "success" | "warning" | "error",
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"],
): string | undefined {
  switch (level) {
    case "success":
      return colors.statusSuccessFill;
    case "warning":
      return colors.statusWarningFill;
    case "error":
      return colors.statusErrorFill;
    default:
      return colors.statusInfoFill;
  }
}
