import { MacOSScrollAccel, type ScrollAcceleration } from "@opentui/core";

export function isMacScrollPlatform(platform = process.platform): boolean {
  return platform === "darwin";
}

export function makeScrollAcceleration(
  step: number,
  accelerationEnabled: boolean,
  platform = process.platform,
): ScrollAcceleration {
  const scrollStep = normalizeScrollStep(step);
  const useAcceleration = accelerationEnabled && isMacScrollPlatform(platform);

  if (!useAcceleration) {
    return {
      tick: () => scrollStep,
      reset() {},
    };
  }

  const macos = new MacOSScrollAccel();
  if (scrollStep === 1) {
    return macos;
  }

  return {
    tick: (now) => scrollStep * macos.tick(now),
    reset: () => macos.reset(),
  };
}

function normalizeScrollStep(step: number): number {
  if (!Number.isFinite(step)) {
    return 1;
  }

  return Math.max(1, Math.floor(step));
}
