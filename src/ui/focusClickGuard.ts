import { CliRenderEvents } from "@opentui/core";

export const FOCUS_CLICK_GRACE_MS = 125;

type FocusGuardRenderer = {
  on(event: CliRenderEvents.FOCUS, listener: () => void): unknown;
  off(event: CliRenderEvents.FOCUS, listener: () => void): unknown;
};

export type FocusClickGuard = {
  isWithinFocusGrace: () => boolean;
  dispose: () => void;
};

export function createFocusClickGuard(
  renderer: FocusGuardRenderer,
  options: { now?: () => number } = {},
): FocusClickGuard {
  const now = options.now ?? Date.now;
  let lastFocusAt = Number.NEGATIVE_INFINITY;
  const handleFocus = () => {
    lastFocusAt = now();
  };
  renderer.on(CliRenderEvents.FOCUS, handleFocus);

  return {
    isWithinFocusGrace: () => now() - lastFocusAt < FOCUS_CLICK_GRACE_MS,
    dispose: () => {
      renderer.off(CliRenderEvents.FOCUS, handleFocus);
    },
  };
}
