import type { ResolvedAppConfig } from "../config/schema.ts";

type SemanticColors = ResolvedAppConfig["colorScheme"]["semanticColors"];

export function getRevisionRowBackgroundColor(options: Readonly<{
  focused: boolean;
  selected: boolean;
  commandRoleFill: string | undefined;
  affected: boolean;
  colors: Pick<SemanticColors, "rowFocusedFill" | "rowSelectedFill" | "rowAffectedFill">;
}>): string | undefined {
  // A chip-bearing row is tinted with the dim version of its chip color; that
  // pairing wins even under the focus cursor so chip and background never
  // disagree.
  if (options.commandRoleFill !== undefined) {
    return options.commandRoleFill;
  }

  if (options.focused) {
    return options.colors.rowFocusedFill;
  }

  if (options.selected) {
    return options.colors.rowSelectedFill;
  }

  if (options.affected) {
    return options.colors.rowAffectedFill;
  }

  return undefined;
}

export function getChangedFileRowBackgroundColor(options: Readonly<{
  focused: boolean;
  selected: boolean;
  colors: Pick<SemanticColors, "rowFocusedFill" | "rowSelectedFill">;
}>): string | undefined {
  if (options.focused) {
    return options.colors.rowFocusedFill;
  }

  if (options.selected) {
    return options.colors.rowSelectedFill;
  }

  return undefined;
}