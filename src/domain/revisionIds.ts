const DIVERGENT_REVISION_SUFFIX = /\/\d+$/;

export function getChangeIdFromRevisionId(revisionId: string): string {
  return revisionId.replace(DIVERGENT_REVISION_SUFFIX, "");
}

export function isDivergentRevisionId(revisionId: string): boolean {
  return DIVERGENT_REVISION_SUFFIX.test(revisionId);
}

export function getRevisionArg(revisionId: string, changeIdPrefixLength: number): string {
  return isDivergentRevisionId(revisionId)
    ? revisionId
    : revisionId.slice(0, changeIdPrefixLength);
}