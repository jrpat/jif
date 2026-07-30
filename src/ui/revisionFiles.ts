import {
  getChangedFileFilterMatchRanges,
  getChangedFileFilterText,
} from "../domain/fileFilter.ts";
import type { AppState, ChangedFile, RevisionSummary } from "../domain/types.ts";
import { isFileFocusMode } from "../modes.ts";

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

// The filter row stays on screen after Enter commits the query, so a narrowed
// list always says why it is short.
export function showsChangedFilesFilter(
  state: Pick<AppState, "focusMode" | "fileFilterQuery">,
): boolean {
  return state.focusMode === "file-filter" || state.fileFilterQuery !== "";
}

export type ChangedFileNameSegment = Readonly<{
  text: string;
  matched: boolean;
}>;

// Splits a file's displayed name into alternating plain and matched runs, so
// the row can tint exactly the substring the filter query hit.
export function buildChangedFileNameSegments(
  file: Pick<ChangedFile, "path" | "displayPath">,
  filterQuery: string,
): readonly ChangedFileNameSegment[] {
  const text = getChangedFileFilterText(file);
  const ranges = getChangedFileFilterMatchRanges(file, filterQuery);
  if (ranges.length === 0) {
    return [{ text, matched: false }];
  }

  const segments: ChangedFileNameSegment[] = [];
  let offset = 0;

  for (const range of ranges) {
    if (range.start > offset) {
      segments.push({ text: text.slice(offset, range.start), matched: false });
    }
    segments.push({ text: text.slice(range.start, range.end), matched: true });
    offset = range.end;
  }

  if (offset < text.length) {
    segments.push({ text: text.slice(offset), matched: false });
  }

  return segments;
}

export function getChangedFileRowState(
  state: Pick<AppState, "focusMode" | "expandedRowId" | "focusedFileIndex" | "selectedFilePaths">,
  rowId: string,
  rowIndex: number,
  filePath: string,
): Readonly<{
  focused: boolean;
  selected: boolean;
  marker: "⏵" | " ";
}> {
  const focused =
    isFileFocusMode(state.focusMode) &&
    state.expandedRowId === rowId &&
    state.focusedFileIndex === rowIndex;
  const selected = state.selectedFilePaths.includes(filePath);

  return {
    focused,
    selected,
    marker: focused ? "⏵" : " ",
  };
}
