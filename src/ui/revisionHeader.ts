import type { RevisionSummary } from "../domain/types.ts";
import { getChangeIdFromRevisionId, isDivergentRevisionId } from "../domain/revisionIds.ts";
import type { RevisionRowState } from "./revisionBorders.ts";

const NO_DESCRIPTION_PLACEHOLDER = "(no description)";
const EMPTY_NO_DESCRIPTION_PLACEHOLDER = "(empty) (no description)";

export type RevisionChangeIdSegment = Readonly<{
  kind: "prefix" | "suffix";
  text: string;
}>;

export type RevisionChangeIdColors = Readonly<{
  prefix: string | undefined;
  suffix: string | undefined;
}>;

export function getRevisionSelectionMarker(rowState: RevisionRowState): "✓ " | "" {
  return rowState === "selected" ? "✓ " : "";
}

export function getRevisionChangeIdDisplayLength(
  revisions: readonly Pick<RevisionSummary, "revisionId" | "changeIdPrefixLength">[],
  additionalChars = 0,
): number {
  let longestUniquePrefix = 0;
  let maxChangeIdLength = 0;

  for (const revision of revisions) {
    const changeId = getChangeIdFromRevisionId(revision.revisionId);
    if (changeId.length === 0) {
      continue;
    }

    longestUniquePrefix = Math.max(longestUniquePrefix, revision.changeIdPrefixLength);
    maxChangeIdLength = Math.max(maxChangeIdLength, changeId.length);
  }

  if (maxChangeIdLength === 0) {
    return 0;
  }

  return Math.min(maxChangeIdLength, longestUniquePrefix + Math.max(0, additionalChars));
}

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
  revision: Pick<RevisionSummary, "revisionId" | "changeIdPrefixLength">,
  options: Readonly<{ displayLength?: number }> = {},
): readonly RevisionChangeIdSegment[] {
  const changeId = getChangeIdFromRevisionId(revision.revisionId);
  const visibleChangeIdLength = options.displayLength === undefined
    ? changeId.length
    : Math.min(changeId.length, Math.max(0, options.displayLength));
  const visiblePrefixLength = Math.min(revision.changeIdPrefixLength, visibleChangeIdLength);
  const segments: RevisionChangeIdSegment[] = [
    {
      kind: "prefix",
      text: changeId.slice(0, visiblePrefixLength),
    },
  ];
  if (visiblePrefixLength < visibleChangeIdLength) {
    segments.push({
      kind: "suffix",
      text: changeId.slice(visiblePrefixLength, visibleChangeIdLength),
    });
  }

  if (isDivergentRevisionId(revision.revisionId)) {
    segments.push({
      kind: "prefix",
      text: revision.revisionId.slice(changeId.length),
    });
  }

  return segments;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.25;

function parseLocalTimestamp(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, y, mo, d, h, mi, se] = match;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
}

export function formatRelativeAgo(timestamp: string, now: Date = new Date()): string {
  const parsed = parseLocalTimestamp(timestamp);
  if (!parsed) {
    return "";
  }

  const diffDays = Math.max(0, (now.getTime() - parsed.getTime()) / MS_PER_DAY);
  const days = Math.round(diffDays);
  if (days < 7) {
    return `${days}d`;
  }

  const weeks = Math.round(diffDays / 7);
  if (weeks < 8) {
    return `${weeks}w`;
  }

  const months = Math.round(diffDays / DAYS_PER_MONTH);
  if (months < 12) {
    return `${months}mo`;
  }

  return `${Math.round(diffDays / DAYS_PER_YEAR)}y`;
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
