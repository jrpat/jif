import { getRevisionArg } from "./revisionIds.ts";
import type { RevisionSummary } from "./types.ts";

export type ElidedExpansionQuery = Readonly<{
  descendantArg: string;
  excludeArgs: readonly string[];
}>;

// jj renders elided markers directly below the revision whose ancestry edge
// they hide (a merge emits one marker per elided parent edge), so the nearest
// non-elided row above the marker is the descendant anchor. Rows below the
// marker can be sibling branches, which makes them useless as anchors. The
// hidden revisions are then the anchor's ancestors minus everything already
// shown, which is why every non-elided row becomes an exclusion.
export function resolveElidedExpansion(
  revisions: readonly RevisionSummary[],
  elidedIndex: number,
): ElidedExpansionQuery | null {
  if (revisions[elidedIndex]?.marker !== "elided") {
    return null;
  }

  let descendant: RevisionSummary | undefined;
  for (let index = elidedIndex - 1; index >= 0; index -= 1) {
    const candidate = revisions[index];
    if (candidate && candidate.marker !== "elided") {
      descendant = candidate;
      break;
    }
  }
  if (!descendant) {
    return null;
  }

  return {
    descendantArg: getRevisionArg(descendant.revisionId, descendant.changeIdPrefixLength),
    excludeArgs: revisions
      .filter((revision) => revision.marker !== "elided")
      .map((revision) => getRevisionArg(revision.revisionId, revision.changeIdPrefixLength)),
  };
}
