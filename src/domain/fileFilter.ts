import { findTextMatchRanges, textMatchesQuery, type TextMatchRange } from "../search/matching.ts";
import type { ChangedFile } from "./types.ts";

// The text a changed-file row shows. A rename/copy displays jj's compressed
// `src/{old => new}.ext` form, so that — not the resolved path — is what the
// filter highlights.
export function getChangedFileFilterText(file: Pick<ChangedFile, "path" | "displayPath">): string {
  return file.displayPath ?? file.path;
}

export function changedFileMatchesFilter(
  file: Pick<ChangedFile, "path" | "displayPath">,
  query: string,
): boolean {
  if (query.length === 0) {
    return true;
  }

  const displayText = getChangedFileFilterText(file);

  // A rename matches from either side: the displayed `{old => new}` form and
  // the real post-change path both name the file the user is looking for.
  return (
    textMatchesQuery(displayText, query) ||
    (displayText !== file.path && textMatchesQuery(file.path, query))
  );
}

export function filterChangedFiles<T extends Pick<ChangedFile, "path" | "displayPath">>(
  files: readonly T[],
  query: string,
): readonly T[] {
  if (query.length === 0) {
    return files;
  }

  return files.filter((file) => changedFileMatchesFilter(file, query));
}

// Ranges are relative to the displayed text, so a path that matched only on its
// resolved form (a rename) highlights nothing rather than the wrong columns.
export function getChangedFileFilterMatchRanges(
  file: Pick<ChangedFile, "path" | "displayPath">,
  query: string,
): readonly TextMatchRange[] {
  if (query.length === 0) {
    return [];
  }

  return findTextMatchRanges(getChangedFileFilterText(file), query);
}
