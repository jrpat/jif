import type { RevisionSummary } from "../domain/types.ts";
import { getChangeIdFromRevisionId, isDivergentRevisionId } from "../domain/revisionIds.ts";
import type { RevisionRowState } from "./revisionBorders.ts";

const NO_DESCRIPTION_PLACEHOLDER = "(no description)";
const EMPTY_NO_DESCRIPTION_PLACEHOLDER = "(empty) (no description)";

export type RevisionChangeIdSegment = Readonly<{
  kind: "prefix" | "suffix" | "separator" | "timestamp";
  text: string;
}>;

export type RevisionChangeIdColors = Readonly<{
  prefix: string | undefined;
  suffix: string | undefined;
}>;

export function getRevisionCommandChipBgColor(options: Readonly<{
  rowState: RevisionRowState;
  colors: Readonly<{
    rowSelectedAccent: string | undefined;
    chromeBorderFocus: string | undefined;
  }>;
}>): string | undefined {
  switch (options.rowState) {
    case "selected":
      return options.colors.rowSelectedAccent;
    default:
      return options.colors.chromeBorderFocus;
  }
}

export function buildRevisionChangeIdSegments(
  revision: Pick<RevisionSummary, "revisionId" | "changeIdPrefixLength" | "localTimestamp">,
  options: Readonly<{ showTimestamp: boolean }>,
): readonly RevisionChangeIdSegment[] {
  const changeId = getChangeIdFromRevisionId(revision.revisionId);
  const segments: RevisionChangeIdSegment[] = [
    {
      kind: "prefix",
      text: changeId.slice(0, revision.changeIdPrefixLength),
    },
    {
      kind: "suffix",
      text: changeId.slice(revision.changeIdPrefixLength),
    },
  ];

  if (isDivergentRevisionId(revision.revisionId)) {
    segments.push({
      kind: "prefix",
      text: revision.revisionId.slice(changeId.length),
    });
  }

  if (options.showTimestamp && revision.localTimestamp.trim().length > 0) {
    segments.push({ kind: "separator", text: " · " });
    segments.push({ kind: "timestamp", text: revision.localTimestamp });
  }

  return segments;
}

export function getRevisionDescriptionColor(
  revision: Pick<RevisionSummary, "description">,
  options: Readonly<{
    rowState: RevisionRowState;
    colors: Readonly<{
      textPrimary: string | undefined;
      textTertiary: string | undefined;
      statusSuccess: string | undefined;
      statusWarning: string | undefined;
    }>;
  }>,
): string | undefined {
  if (revision.description.includes("(empty)")) {
    return options.colors.statusSuccess;
  }

  if (!hasUserDescription(revision)) {
    return options.colors.statusWarning;
  }

  switch (options.rowState) {
    case "selected":
    case "focused":
    case "affected":
    case "default":
      return options.colors.textPrimary;
  }
}

export function hasUserDescription(
  revision: Pick<RevisionSummary, "description">,
): boolean {
  return revision.description !== NO_DESCRIPTION_PLACEHOLDER
    && revision.description !== EMPTY_NO_DESCRIPTION_PLACEHOLDER;
}

export function getRevisionChangeIdColors(options: Readonly<{
  rowState: RevisionRowState;
  colors: Readonly<{
    rowSelectedAccent: string | undefined;
    chromeBorderFocus: string | undefined;
    revsetPrefix: string | undefined;
    textTertiary: string | undefined;
  }>;
}>): RevisionChangeIdColors {
  switch (options.rowState) {
    case "selected":
      return {
        prefix: options.colors.rowSelectedAccent,
        suffix: options.colors.rowSelectedAccent,
      };
    case "focused":
      return {
        prefix: options.colors.chromeBorderFocus,
        suffix: options.colors.chromeBorderFocus,
      };
    default:
      return {
        prefix: options.colors.revsetPrefix,
        suffix: options.colors.textTertiary,
      };
  }
}
