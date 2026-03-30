import type { AppState, RevisionSummary } from "../domain/types.ts";

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

export function getChangedFileRowState(
  state: Pick<AppState, "focusMode" | "expandedRevisionId" | "focusedFileIndex" | "selectedFilePaths">,
  revisionId: string,
  rowIndex: number,
  filePath: string,
): Readonly<{
  focused: boolean;
  selected: boolean;
  marker: "*" | "⏵" | " ";
}> {
  const focused =
    state.focusMode === "files" &&
    state.expandedRevisionId === revisionId &&
    state.focusedFileIndex === rowIndex;
  const selected = state.selectedFilePaths.includes(filePath);

  return {
    focused,
    selected,
    marker: selected ? "*" : focused ? "⏵" : " ",
  };
}
