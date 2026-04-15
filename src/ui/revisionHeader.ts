import type { RevisionSummary } from "../domain/types.ts";
import type { RevisionRowState } from "./revisionBorders.ts";

export type RevisionChangeIdSegment = Readonly<{
  kind: "prefix" | "suffix" | "separator" | "timestamp";
  text: string;
}>;

export type RevisionChangeIdColors = Readonly<{
  prefix: string | undefined;
  suffix: string | undefined;
}>;

export function buildRevisionChangeIdSegments(
  revision: Pick<RevisionSummary, "changeId" | "changeIdPrefixLength" | "localTimestamp">,
  options: Readonly<{ showTimestamp: boolean }>,
): readonly RevisionChangeIdSegment[] {
  const segments: RevisionChangeIdSegment[] = [
    {
      kind: "prefix",
      text: revision.changeId.slice(0, revision.changeIdPrefixLength),
    },
    {
      kind: "suffix",
      text: revision.changeId.slice(revision.changeIdPrefixLength),
    },
  ];

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

  if (revision.description.includes("(no description)")) {
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
