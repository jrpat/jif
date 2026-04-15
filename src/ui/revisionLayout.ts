import type { RevisionSummary } from "../domain/types.ts";
import { shouldCondenseGraphRows } from "./revisionGutter.ts";

export type RevisionSideChip = Readonly<{
  kind: "bookmark" | "workspace";
  text: string;
}>;

export type RevisionLayoutMode = "expanded" | "compact";

export type RevisionLayoutSpec = Readonly<{
  mode: RevisionLayoutMode;
  headerRowCount: 1 | 2;
  baseGraphRowCount: number;
  visibleGraphMode: "direct" | "fold-first-two" | "keep-second-row";
  sideChips: readonly RevisionSideChip[];
  commandTarget: Readonly<{
    placement: "inline" | "overlay";
    leftOffset: number;
    text: string;
  }> | null;
}>;

const BASE_LAYOUT_SPECS: Readonly<Record<RevisionLayoutMode, Omit<RevisionLayoutSpec, "mode" | "sideChips" | "commandTarget">>> = {
  expanded: {
    headerRowCount: 2,
    baseGraphRowCount: 2,
    visibleGraphMode: "direct",
  },
  compact: {
    headerRowCount: 1,
    baseGraphRowCount: 2,
    visibleGraphMode: "fold-first-two",
  },
};

export function getMaxRevisionBaseGraphRowCount(): number {
  return Math.max(...Object.values(BASE_LAYOUT_SPECS).map((spec) => spec.baseGraphRowCount));
}

export function buildRevisionLayoutSpec(
  revision: Pick<RevisionSummary, "changeId" | "bookmarks" | "workspaces" | "graphRows">,
  options: Readonly<{
    mode: RevisionLayoutMode;
    isCommandTarget: boolean;
    badgeText: string;
  }>,
): RevisionLayoutSpec {
  const sideChips: RevisionSideChip[] = [
    ...revision.bookmarks.map((text) => ({ kind: "bookmark" as const, text })),
    ...revision.workspaces.map((text) => ({ kind: "workspace" as const, text })),
  ];
  const base = BASE_LAYOUT_SPECS[options.mode];

  return {
    mode: options.mode,
    ...base,
    visibleGraphMode:
      shouldCondenseGraphRows(revision.graphRows.slice(0, base.baseGraphRowCount))
        ? base.visibleGraphMode
        : "keep-second-row",
    sideChips,
    commandTarget: options.isCommandTarget
      ? {
          placement: options.mode === "expanded" ? "inline" : "overlay",
          leftOffset: revision.changeId.length + 1,
          text: options.badgeText,
        }
      : null,
  };
}
