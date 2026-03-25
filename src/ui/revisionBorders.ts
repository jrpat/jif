import {
  BorderChars,
  getBorderFromSides,
  type BorderCharacters,
  type BorderSides,
} from "@opentui/core";

export type RevisionRowState = "default" | "affected" | "focused" | "selected";

export function getRevisionBorderPolicy(options: Readonly<{
  rowState: RevisionRowState;
  previousRowState: RevisionRowState | null;
  nextRowState: RevisionRowState | null;
  currentGraphWidth: number;
  previousGraphWidth: number | null;
  nextGraphWidth: number | null;
}>): Readonly<{
  ownsTop: boolean;
  ownsBottom: boolean;
  borderSides: boolean | BorderSides[];
  borderChars: BorderCharacters;
}> {
  const myPriority = getRowStatePriority(options.rowState);
  const prevPriority = options.previousRowState !== null
    ? getRowStatePriority(options.previousRowState) : null;
  const nextPriority = options.nextRowState !== null
    ? getRowStatePriority(options.nextRowState) : null;

  // When priorities are equal, the wider box (smaller graphWidth) wins ownership
  // so it can draw T-junctions connecting to the narrower neighbor's border.
  const ownsTop =
    prevPriority === null ||
    myPriority > prevPriority ||
    (myPriority === prevPriority &&
      options.previousGraphWidth !== null &&
      options.currentGraphWidth < options.previousGraphWidth);
  const ownsBottom =
    nextPriority === null ||
    myPriority > nextPriority ||
    (myPriority === nextPriority &&
      (options.nextGraphWidth === null ||
        options.currentGraphWidth <= options.nextGraphWidth));

  const borderSides = getBorderFromSides({
    top: ownsTop,
    right: true,
    bottom: ownsBottom,
    left: true,
  });

  return {
    ownsTop,
    ownsBottom,
    borderSides,
    borderChars: getBorderChars({
      rowState: options.rowState,
      ownsTop,
      ownsBottom,
      hasPreviousRow: options.previousRowState !== null,
      hasNextRow: options.nextRowState !== null,
      currentGraphWidth: options.currentGraphWidth,
      previousGraphWidth: options.previousGraphWidth,
      nextGraphWidth: options.nextGraphWidth,
    }),
  };
}

function getBorderChars(options: Readonly<{
  rowState: RevisionRowState;
  ownsTop: boolean;
  ownsBottom: boolean;
  hasPreviousRow: boolean;
  hasNextRow: boolean;
  currentGraphWidth: number;
  previousGraphWidth: number | null;
  nextGraphWidth: number | null;
}>): BorderCharacters {
  const chars: BorderCharacters = { ...BorderChars.single };
  const useConnectedCorners = options.rowState !== "selected";

  if (options.ownsTop && options.hasPreviousRow && useConnectedCorners) {
    if (options.previousGraphWidth === options.currentGraphWidth) {
      // Same column: vertical T-junction connects the two left borders
      chars.topLeft = BorderChars.single.leftT;
    } else if (options.previousGraphWidth !== null && options.previousGraphWidth < options.currentGraphWidth) {
      // Wider neighbor above: connector path arrives from the left, so use ┬
      chars.topLeft = BorderChars.single.topT;
    }
    // else: neighbor narrower or absent — ┌ (default, no connection from above)
    chars.topRight = BorderChars.single.rightT;
  }

  if (options.ownsBottom && options.hasNextRow && useConnectedCorners) {
    if (options.nextGraphWidth === options.currentGraphWidth) {
      chars.bottomLeft = BorderChars.single.leftT;
    } else if (options.nextGraphWidth !== null && options.nextGraphWidth < options.currentGraphWidth) {
      // Wider neighbor below: connector path arrives from the left, so use ┴
      chars.bottomLeft = BorderChars.single.bottomT;
    }
    // else: neighbor narrower or absent — └ (default, no connection from below)
    chars.bottomRight = BorderChars.single.rightT;
  }

  return chars;
}

function getRowStatePriority(rowState: RevisionRowState): number {
  switch (rowState) {
    case "selected":
      return 3;
    case "focused":
      return 2;
    case "affected":
      return 1;
    default:
      return 0;
  }
}
