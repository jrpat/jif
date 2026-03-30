import type { RevisionSummary } from "../domain/types.ts";

export function getChangedFilesPlaceholderText(
  revision: Pick<RevisionSummary, "isEmpty" | "filesLoaded" | "files">,
): string | null {
  if (revision.isEmpty) {
    return "No changes";
  }

  if (!revision.filesLoaded) {
    return "Loading changed files...";
  }

  if (revision.files.length === 0) {
    return "No changes";
  }

  return null;
}
