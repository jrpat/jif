import type { ChangeSummary, TrackedParentRevision } from "./types.ts";

const TRACKED_PARENT_CHAIN: readonly TrackedParentRevision[] = [
  {
    id: "parent-1",
    label: "@-",
    revset: "@-",
    baseRevset: "@--",
  },
  {
    id: "parent-2",
    label: "@--",
    revset: "@--",
    baseRevset: "first_parent(@, 3)",
  },
];

export function getTrackedParentChain(): readonly TrackedParentRevision[] {
  return TRACKED_PARENT_CHAIN;
}

export function buildChangeLabel(prefix: string, change: Pick<ChangeSummary, "description" | "isConflict">): string {
  const parts = [prefix];
  const description = change.description.trim();

  if (description.length > 0) {
    parts.push(` • ${description}`);
  }

  if (change.isConflict) {
    parts.push(" (conflict)");
  }

  return parts.join("");
}