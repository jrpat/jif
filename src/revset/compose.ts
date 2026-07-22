// Union a base revset with individually named commits. Each commit is wrapped
// in present() so one that no longer resolves (abandoned, rewritten) drops out
// of the set instead of failing the whole query.
export function unionRevsetWithCommits(
  baseRevset: string,
  commitIds: readonly string[],
): string {
  if (commitIds.length === 0) {
    return baseRevset;
  }

  const commits = commitIds.map((commitId) => `present(${commitId})`).join(" | ");
  return `(${baseRevset}) | ${commits}`;
}
