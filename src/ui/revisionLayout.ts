import type { AppLayout, RevisionSummary } from "../domain/types.ts";
import { shouldCondenseGraphRows } from "./revisionGutter.ts";

export type RevisionSideChip = Readonly<{
  kind: "bookmark" | "workspace" | "conflict";
  text: string;
}>;

export type RevisionLayoutMode = AppLayout;

export const REVISION_RENDER_SLOT_NAMES = [
  "graph",
  "header",
  "identity",
  "side-chips",
  "description",
  "date",
  "command",
  "details",
] as const;

export type RevisionRenderSlotName = typeof REVISION_RENDER_SLOT_NAMES[number];

export type RevisionHeaderSlotLayout = Readonly<{
  row: 0 | 1;
  placement: "flow" | "positioned";
  grow: boolean;
}>;

// The bookmark, workspace, and conflict chips always ride the identity row in
// flow right after the change id, so only the description needs a slot that
// moves between rows.
export type RevisionHeaderLayout = Readonly<{
  rowCount: 1 | 2;
  slots: Readonly<Record<
    "identity" | "description" | "date" | "command",
    RevisionHeaderSlotLayout
  >>;
}>;

export type RevisionGraphMode = "direct" | "fold-first-two" | "keep-second-row";

export type RevisionLayoutPlan = Readonly<{
  mode: RevisionLayoutMode;
  header: RevisionHeaderLayout;
  contentFrame: "bordered" | "unboxed";
  graph: Readonly<{
    baseRowCount: number;
    condensableMode: Exclude<RevisionGraphMode, "keep-second-row">;
  }>;
}>;

const REVISION_LAYOUT_PLANS: Readonly<Record<RevisionLayoutMode, RevisionLayoutPlan>> = {
  loose: {
    mode: "loose",
    header: {
      rowCount: 2,
      slots: {
        identity: { row: 0, placement: "flow", grow: false },
        description: { row: 1, placement: "positioned", grow: true },
        date: { row: 0, placement: "flow", grow: false },
        command: { row: 0, placement: "flow", grow: false },
      },
    },
    contentFrame: "bordered",
    graph: {
      baseRowCount: 2,
      condensableMode: "direct",
    },
  },
  normal: {
    mode: "normal",
    header: {
      rowCount: 1,
      slots: {
        identity: { row: 0, placement: "flow", grow: false },
        description: { row: 0, placement: "flow", grow: true },
        date: { row: 0, placement: "flow", grow: false },
        command: { row: 0, placement: "positioned", grow: false },
      },
    },
    contentFrame: "bordered",
    graph: {
      baseRowCount: 2,
      condensableMode: "fold-first-two",
    },
  },
  tight: {
    mode: "tight",
    header: {
      rowCount: 1,
      slots: {
        identity: { row: 0, placement: "flow", grow: false },
        description: { row: 0, placement: "flow", grow: true },
        date: { row: 0, placement: "flow", grow: false },
        command: { row: 0, placement: "positioned", grow: false },
      },
    },
    contentFrame: "unboxed",
    graph: {
      baseRowCount: 2,
      condensableMode: "fold-first-two",
    },
  },
};

export function getMaxRevisionBaseGraphRowCount(): number {
  return Math.max(...Object.values(REVISION_LAYOUT_PLANS).map((plan) => plan.graph.baseRowCount));
}

export function getRevisionLayoutPlan(mode: RevisionLayoutMode): RevisionLayoutPlan {
  return REVISION_LAYOUT_PLANS[mode];
}

export function resolveRevisionGraphMode(
  plan: Pick<RevisionLayoutPlan, "graph">,
  graphRows: readonly string[],
): RevisionGraphMode {
  return shouldCondenseGraphRows(graphRows.slice(0, plan.graph.baseRowCount))
    ? plan.graph.condensableMode
    : "keep-second-row";
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
