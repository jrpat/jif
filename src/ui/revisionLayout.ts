import type { RevisionSummary } from "../domain/types.ts";

export type RevisionSideChip = Readonly<{
  kind: "bookmark" | "workspace";
  text: string;
}>;

export type RevisionHeaderLayout = Readonly<{
  headerRowCount: 1 | 2;
  contentHeight: 1 | 2;
  clipOverflow: boolean;
  descriptionPlacement: "separate-row" | "between-id-and-side-chips" | "full-row-after-id";
  sideChips: readonly RevisionSideChip[];
  commandTarget: Readonly<{
    placement: "inline" | "overlay";
    leftOffset: number;
    text: string;
  }> | null;
}>;

export function buildRevisionHeaderLayout(
  revision: Pick<RevisionSummary, "changeId" | "bookmarks" | "workspaces">,
  options: Readonly<{
    condensed: boolean;
    isCommandTarget: boolean;
    badgeText: string;
  }>,
): RevisionHeaderLayout {
  const sideChips: RevisionSideChip[] = [
    ...revision.bookmarks.map((text) => ({ kind: "bookmark" as const, text })),
    ...revision.workspaces.map((text) => ({ kind: "workspace" as const, text })),
  ];

  if (!options.condensed) {
    return {
      headerRowCount: 2,
      contentHeight: 2,
      clipOverflow: false,
      descriptionPlacement: "separate-row",
      sideChips,
      commandTarget: options.isCommandTarget
        ? {
            placement: "inline",
            leftOffset: revision.changeId.length + 1,
            text: options.badgeText,
          }
        : null,
    };
  }

  return {
    headerRowCount: 1,
    contentHeight: 1,
    clipOverflow: true,
    descriptionPlacement: sideChips.length > 0
      ? "between-id-and-side-chips"
      : "full-row-after-id",
    sideChips,
    commandTarget: options.isCommandTarget
      ? {
          placement: "overlay",
          leftOffset: revision.changeId.length + 1,
          text: options.badgeText,
        }
      : null,
  };
}
