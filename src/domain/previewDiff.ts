// Helpers for feeding OpenTUI's `<diff>` (DiffRenderable) component. That
// component parses a diff with jsdiff `parsePatch` and renders only the FIRST
// file's patch, so a multi-file revision/operation diff must be split into one
// single-file patch per `<diff>`. It also renders exactly the in-hunk lines
// (no `@@`/file headers), so we can compute an exact row count for sizing.

import { pathToFiletype } from "@opentui/core";

export type PreviewFilePatch = Readonly<{
  path: string;
  patch: string;
}>;

export type DiffSection =
  | Readonly<{ kind: "hunk"; patch: string }>
  | Readonly<{ kind: "omission"; omittedLineCount: number }>;

const GIT_DIFF_PREFIX = "diff --git ";
const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

// A line inside a hunk body: added (`+`), removed (`-`), or context (` `). The
// `@@` header and `\ No newline…` marker are not body lines. OpenTUI's `<diff>`
// renders exactly these, so both the row count and width estimate key off them.
function isDiffBodyLine(line: string): boolean {
  const first = line[0];
  return first === "+" || first === "-" || first === " ";
}

// Header lines that legitimately appear between `diff --git` and the first hunk.
const HEADER_PREFIXES = [
  GIT_DIFF_PREFIX,
  "old mode ",
  "new mode ",
  "deleted file mode ",
  "new file mode ",
  "index ",
  "similarity index ",
  "dissimilarity index ",
  "rename from ",
  "rename to ",
  "copy from ",
  "copy to ",
  "--- ",
  "+++ ",
  "Binary files ",
  "GIT binary patch",
];

/**
 * Split a git-format diff (possibly multi-file, possibly with interleaved
 * non-diff annotation lines as produced by `jj operation diff`) into one clean
 * single-file patch per file. Each returned `patch` is trimmed to valid git
 * diff lines so jsdiff can parse it without choking on annotations.
 */
export function splitGitDiff(fullDiff: string): PreviewFilePatch[] {
  if (!fullDiff.trim()) {
    return [];
  }
  const normalizedDiff = normalizeIndentedGitDiff(fullDiff);
  const chunks = normalizedDiff.split(/\n(?=diff --git )/g);
  const result: PreviewFilePatch[] = [];
  for (const chunk of chunks) {
    if (!chunk.startsWith(GIT_DIFF_PREFIX)) {
      // Leading annotation before the first file diff (e.g. op-diff headers).
      continue;
    }
    const patch = trimToPatch(chunk);
    result.push({ path: parseGitDiffPath(patch), patch });
  }
  return result;
}

function normalizeIndentedGitDiff(fullDiff: string): string {
  const lines = fullDiff.split("\n");
  const out: string[] = [];
  let activeIndent: string | null = null;

  for (const line of lines) {
    if (activeIndent !== null) {
      if (line.startsWith(activeIndent)) {
        out.push(line.slice(activeIndent.length));
        continue;
      }
      activeIndent = null;
    }

    const header = line.match(/^(\s*)diff --git /);
    if (header) {
      activeIndent = header[1] ?? "";
      out.push(line.slice(activeIndent.length));
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

/**
 * Count how many rows OpenTUI's `<diff>` renders for a single-file unified
 * patch: exactly the in-hunk `+`/`-`/space lines (it omits `@@`, `diff --git`,
 * `---`/`+++`, and `\ No newline…` lines). Requires the `<diff>` be rendered
 * with `wrapMode="none"` so one logical line maps to one row.
 */
export function countDiffRows(patch: string): number {
  let inHunk = false;
  let rows = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk) {
      continue;
    }
    if (isDiffBodyLine(line)) {
      rows += 1;
    }
  }
  return rows;
}

export function splitPatchIntoDiffSections(patch: string): DiffSection[] {
  const lines = patch.split("\n");
  const firstHunkIndex = lines.findIndex((line) => line.startsWith("@@"));
  if (firstHunkIndex === -1) {
    return [];
  }

  const headerLines = lines.slice(0, firstHunkIndex);
  const hunks: Array<Readonly<{ header: HunkHeader; lines: string[] }>> = [];
  let currentHeader: HunkHeader | null = null;
  let currentLines: string[] = [];

  const pushCurrent = () => {
    if (currentHeader) {
      hunks.push({ header: currentHeader, lines: currentLines });
    }
  };

  for (let i = firstHunkIndex; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("@@")) {
      const header = parseHunkHeader(line);
      if (!header) {
        break;
      }
      pushCurrent();
      currentHeader = header;
      currentLines = [line];
      continue;
    }
    if (!currentHeader) {
      continue;
    }
    if (isDiffBodyLine(line) || line[0] === "\\") {
      currentLines.push(line);
      continue;
    }
    break;
  }
  pushCurrent();

  const sections: DiffSection[] = [];
  for (let i = 0; i < hunks.length; i++) {
    const hunk = hunks[i]!;
    const previous = hunks[i - 1];
    if (previous) {
      const omittedLineCount = countUnchangedLinesBetween(previous.header, hunk.header);
      if (omittedLineCount > 0) {
        sections.push({ kind: "omission", omittedLineCount });
      }
    }
    sections.push({ kind: "hunk", patch: [...headerLines, ...hunk.lines].join("\n") });
  }
  return sections;
}

export function formatOmittedLineSeparator(omittedLineCount: number, width = 0): string {
  const label = ` ${omittedLineCount} more lines `;
  const ruleWidth = Math.max(6, width - label.length);
  const leftWidth = Math.floor(ruleWidth / 2);
  const rightWidth = ruleWidth - leftWidth;
  return `${"⋮".repeat(leftWidth)}${label}${"⋮".repeat(rightWidth)}`;
}

// Extra columns a `<diff>` adds around content: the line-number gutter plus the
// trailing `" +"`/`" -"` sign. Over-estimated so long lines never truncate.
const DIFF_CHROME_WIDTH = 12;

/**
 * Estimate the widest rendered line across all files' diffs, so the preview's
 * horizontally-scrollable content box can be sized to fit long lines. Slightly
 * over-estimates (empty scroll space is harmless; truncation is not).
 */
export function estimateDiffWidth(files: readonly PreviewFilePatch[]): number {
  let max = 0;
  for (const file of files) {
    max = Math.max(max, file.path.length);
    for (const section of splitPatchIntoDiffSections(file.patch)) {
      if (section.kind === "omission") {
        max = Math.max(max, formatOmittedLineSeparator(section.omittedLineCount).length + 2);
        continue;
      }
      let inHunk = false;
      for (const line of section.patch.split("\n")) {
        if (line.startsWith("@@")) {
          inHunk = true;
          continue;
        }
        if (!inHunk) {
          continue;
        }
        if (isDiffBodyLine(line)) {
          max = Math.max(max, line.length - 1 + DIFF_CHROME_WIDTH);
        }
      }
    }
  }
  return max;
}

/** Canonical OpenTUI filetype for `<diff>`'s syntax hint. */
export function fileTypeForPath(path: string): string {
  return pathToFiletype(path) ?? "";
}

// Keep only lines belonging to this file's patch, discarding trailing
// annotation lines that a split chunk may have absorbed from the next section.
function trimToPatch(chunk: string): string {
  const lines = chunk.split("\n");
  const out: string[] = [];
  let inHunk = false;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      inHunk = true;
      out.push(line);
      continue;
    }
    if (!inHunk) {
      if (HEADER_PREFIXES.some((prefix) => line.startsWith(prefix))) {
        out.push(line);
        continue;
      }
      break; // unrecognized header-region line => end of this patch
    }
    // Keep body lines plus `\ No newline at end of file` continuation markers.
    if (isDiffBodyLine(line) || line[0] === "\\") {
      out.push(line);
      continue;
    }
    break; // non-body line inside hunks => end of this patch
  }
  return out.join("\n");
}

function parseGitDiffPath(patch: string): string {
  const plus = patch.match(/^\+\+\+ b\/(.+)$/m);
  if (plus?.[1] && plus[1] !== "/dev/null") {
    return plus[1];
  }
  const header = patch.match(/^diff --git a\/.+ b\/(.+)$/m);
  if (header?.[1]) {
    return header[1];
  }
  return "";
}

type HunkHeader = Readonly<{
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
}>;

function parseHunkHeader(line: string): HunkHeader | null {
  const match = line.match(HUNK_HEADER_PATTERN);
  if (!match) {
    return null;
  }
  return {
    oldStart: Number.parseInt(match[1]!, 10),
    oldLines: match[2] === undefined ? 1 : Number.parseInt(match[2], 10),
    newStart: Number.parseInt(match[3]!, 10),
    newLines: match[4] === undefined ? 1 : Number.parseInt(match[4], 10),
  };
}

function countUnchangedLinesBetween(previous: HunkHeader, next: HunkHeader): number {
  const oldGap = next.oldStart - (previous.oldStart + previous.oldLines);
  const newGap = next.newStart - (previous.newStart + previous.newLines);
  return Math.max(0, Math.min(oldGap, newGap));
}
