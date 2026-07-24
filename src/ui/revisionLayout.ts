import type { AppLayout, RevisionSummary } from "../domain/types.ts";
import { shouldCondenseGraphRows } from "./revisionGutter.ts";

export type RevisionSideChip = Readonly<{
  kind: "bookmark" | "workspace" | "conflict";
  text: string;
}>;

export type RevisionLayoutMode = AppLayout;

export type RevisionLayoutSpec = Readonly<{
  mode: RevisionLayoutMode;
  headerRowCount: 1 | 2;
  baseGraphRowCount: number;
  visibleGraphMode: "direct" | "fold-first-two" | "keep-second-row";
  sideChips: readonly RevisionSideChip[];
  commandChip: Readonly<{
    placement: "inline" | "overlay";
    text: string;
  }> | null;
}>;

const BASE_LAYOUT_SPECS: Readonly<Record<RevisionLayoutMode, Omit<RevisionLayoutSpec, "mode" | "sideChips" | "commandChip">>> = {
  loose: {
    headerRowCount: 2,
    baseGraphRowCount: 2,
    visibleGraphMode: "direct",
  },
  normal: {
    headerRowCount: 1,
    baseGraphRowCount: 2,
    visibleGraphMode: "fold-first-two",
  },
  tight: {
    headerRowCount: 1,
    baseGraphRowCount: 2,
    visibleGraphMode: "fold-first-two",
  },
};

export function getMaxRevisionBaseGraphRowCount(): number {
  return Math.max(...Object.values(BASE_LAYOUT_SPECS).map((spec) => spec.baseGraphRowCount));
}

function formatWorkspaceChipText(workspaceName: string): string {
  return workspaceName.endsWith("@") ? workspaceName : `${workspaceName}@`;
}

export function buildRevisionSideChips(
  revision: Pick<RevisionSummary, "bookmarks" | "workspaces" | "hasConflict">,
): readonly RevisionSideChip[] {
  return [
    ...(revision.hasConflict ? [{ kind: "conflict" as const, text: "×" }] : []),
    ...revision.workspaces.map((text) => ({
      kind: "workspace" as const,
      text: formatWorkspaceChipText(text),
    })),
    ...revision.bookmarks.map((text) => ({ kind: "bookmark" as const, text })),
  ];
}

export function buildRevisionLayoutSpec(
  revision: Pick<RevisionSummary, "revisionId" | "bookmarks" | "workspaces" | "graphRows" | "hasConflict">,
  options: Readonly<{
    mode: RevisionLayoutMode;
    commandChipText: string | null;
    sideChips?: readonly RevisionSideChip[];
  }>,
): RevisionLayoutSpec {
  const sideChips = options.sideChips ?? buildRevisionSideChips(revision);
  const base = BASE_LAYOUT_SPECS[options.mode];

  return {
    mode: options.mode,
    ...base,
    visibleGraphMode:
      shouldCondenseGraphRows(revision.graphRows.slice(0, base.baseGraphRowCount))
        ? base.visibleGraphMode
        : "keep-second-row",
    sideChips,
    commandChip: options.commandChipText
      ? {
          placement: options.mode === "loose" ? "inline" : "overlay",
          text: options.commandChipText,
        }
      : null,
  };
}
