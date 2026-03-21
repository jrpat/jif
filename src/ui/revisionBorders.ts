import {
  BorderChars,
  getBorderFromSides,
  type BorderCharacters,
  type BorderSides,
} from "@opentui/core";

export type RevisionRowState = "default" | "focused" | "selected";

export function getRevisionBorderPolicy(options: Readonly<{
  rowState: RevisionRowState;
  previousRowState: RevisionRowState | null;
  nextRowState: RevisionRowState | null;
}>): Readonly<{
  ownsTop: boolean;
  ownsBottom: boolean;
  borderSides: boolean | BorderSides[];
  borderChars: BorderCharacters;
}> {
  const ownsTop =
    options.previousRowState === null ||
    getRowStatePriority(options.rowState) > getRowStatePriority(options.previousRowState);
  const ownsBottom =
    options.nextRowState === null ||
    getRowStatePriority(options.rowState) >= getRowStatePriority(options.nextRowState);

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
    }),
  };
}

function getBorderChars(options: Readonly<{
  rowState: RevisionRowState;
  ownsTop: boolean;
  ownsBottom: boolean;
  hasPreviousRow: boolean;
  hasNextRow: boolean;
}>): BorderCharacters {
  const chars: BorderCharacters = { ...BorderChars.single };
  const useConnectedCorners = options.rowState !== "selected";

  if (options.ownsTop && options.hasPreviousRow && useConnectedCorners) {
    chars.topLeft = BorderChars.single.leftT;
    chars.topRight = BorderChars.single.rightT;
  }

  if (options.ownsBottom && options.hasNextRow && useConnectedCorners) {
    chars.bottomLeft = BorderChars.single.leftT;
    chars.bottomRight = BorderChars.single.rightT;
  }

  return chars;
}

function getRowStatePriority(rowState: RevisionRowState): number {
  switch (rowState) {
    case "selected":
      return 2;
    case "focused":
      return 1;
    default:
      return 0;
  }
}
