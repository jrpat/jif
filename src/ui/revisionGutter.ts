export type RevisionGutterPlan = Readonly<{
  topDivider: string | null;
  title: string;
  subtitle: string;
  tail: readonly string[];
  detail: readonly string[];
  bottomDivider: string | null;
}>;

const GRAPH_VERTICAL = "│";
const NODE_MARKERS = new Set(["@", "○", "◆", "*", "×"]);
const DOWNWARD_CONTINUATION_CHARS = new Set([
  "|",
  "│",
  "├",
  "┤",
  "┬",
  "┼",
  "┌",
  "┐",
  "╭",
  "╮",
  "╷",
  "╻",
]);

export function normalizeGraphLine(graphLine: string): string {
  return graphLine.trimEnd();
}

export function measureGraphLineWidth(graphLine: string): number {
  return normalizeGraphLine(graphLine).length;
}

export function measureCoreGraphWidth(graphRows: readonly string[]): number {
  return Math.max(...graphRows.map(measureGraphLineWidth), 1);
}

export function measureBoxedGraphWidth(options: Readonly<{
  graphRows: readonly string[];
  baseGraphRowCount: number;
  visibleGraphMode: "direct" | "fold-first-two" | "keep-second-row";
}>): number {
  const normalizedRows = options.graphRows.map(normalizeGraphLine);
  const baseRows = normalizedRows.slice(0, options.baseGraphRowCount);
  const title = options.visibleGraphMode === "fold-first-two"
    ? buildCondensedGraphLine(baseRows)
    : (baseRows[0] ?? "");
  const titleContinuation = deriveGraphContinuationLine(title);
  const subtitle =
    options.visibleGraphMode === "keep-second-row"
      ? titleContinuation
      : (baseRows[1] ?? titleContinuation);
  const tail = options.visibleGraphMode === "direct"
    ? normalizedRows.slice(options.baseGraphRowCount)
    : options.visibleGraphMode === "keep-second-row"
      ? []
      : normalizedRows.slice(Math.min(options.baseGraphRowCount, 2));

  return Math.max(
    measureGraphLineWidth(title),
    measureGraphLineWidth(subtitle),
    ...tail.map(measureGraphLineWidth),
    1,
  );
}

export function measureGutterPlanWidth(plan: RevisionGutterPlan): number {
  return Math.max(
    plan.topDivider !== null ? measureGraphLineWidth(plan.topDivider) : 0,
    measureGraphLineWidth(plan.title),
    measureGraphLineWidth(plan.subtitle),
    ...plan.tail.map(measureGraphLineWidth),
    ...plan.detail.map(measureGraphLineWidth),
    plan.bottomDivider !== null ? measureGraphLineWidth(plan.bottomDivider) : 0,
    1,
  );
}

export function buildCondensedGraphLine(graphRows: readonly string[]): string {
  const title = normalizeGraphLine(graphRows[0] ?? "");
  const subtitle = graphRows[1] ? normalizeGraphLine(graphRows[1]!) : "";
  if (subtitle.length === 0) {
    return title;
  }

  const output = [...subtitle];
  for (let index = 0; index < title.length; index += 1) {
    const titleChar = title[index] ?? " ";
    if (NODE_MARKERS.has(titleChar)) {
      output[index] = titleChar;
    }
  }

  return normalizeGraphLine(output.join(""));
}

export function shouldCondenseGraphRows(graphRows: readonly string[]): boolean {
  const title = normalizeGraphLine(graphRows[0] ?? "");
  const subtitle = normalizeGraphLine(graphRows[1] ?? "");

  if (subtitle.length === 0) {
    return true;
  }

  return normalizeContinuationGlyphs(subtitle) === normalizeContinuationGlyphs(deriveGraphContinuationLine(title));
}

export function deriveGraphContinuationLine(graphHead: string): string {
  return normalizeGraphLine(
    [...normalizeGraphLine(graphHead)]
      .map((char) => {
        if (NODE_MARKERS.has(char) || DOWNWARD_CONTINUATION_CHARS.has(char)) {
          return GRAPH_VERTICAL;
        }

        return char === " " ? char : " ";
      })
      .join("")
  );
}

function normalizeContinuationGlyphs(graphLine: string): string {
  return graphLine.replaceAll("|", GRAPH_VERTICAL);
}

export function buildRevisionGutterPlan(options: Readonly<{
  graphRows: readonly string[];
  baseGraphRowCount: number;
  visibleGraphMode: "direct" | "fold-first-two" | "keep-second-row";
  detailRowCount: number;
  ownsTop: boolean;
  ownsBottom: boolean;
  previousGraphBottom: string | null;
  hasNextRevision: boolean;
}>): RevisionGutterPlan {
  const normalizedRows = options.graphRows.map(normalizeGraphLine);
  const baseRows = normalizedRows.slice(0, options.baseGraphRowCount);
  const title = options.visibleGraphMode === "fold-first-two"
    ? buildCondensedGraphLine(baseRows)
    : (baseRows[0] ?? "");
  const titleContinuation = deriveGraphContinuationLine(title);
  const subtitle =
    options.visibleGraphMode === "keep-second-row"
      ? titleContinuation
      : (baseRows[1] ?? titleContinuation);
  const tail = options.visibleGraphMode === "direct"
    ? normalizedRows.slice(options.baseGraphRowCount)
    : options.visibleGraphMode === "keep-second-row"
      ? normalizedRows.slice(1, 2)
      : normalizedRows.slice(Math.min(options.baseGraphRowCount, 2));
  const inlineContinuation = options.visibleGraphMode === "keep-second-row"
    ? titleContinuation
    : deriveGraphContinuationLine(normalizedRows.at(-1) ?? title);
  const topDivider = options.ownsTop
    ? (options.previousGraphBottom !== null ? deriveGraphContinuationLine(options.previousGraphBottom) : "")
    : null;

  return {
    topDivider,
    title,
    subtitle,
    tail,
    detail: Array.from({ length: options.detailRowCount }, () => inlineContinuation),
    bottomDivider: options.ownsBottom ? (options.hasNextRevision ? inlineContinuation : "") : null,
  };
}
