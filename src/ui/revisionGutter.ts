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

export function buildRevisionGutterPlan(options: Readonly<{
  graphRows: readonly string[];
  baseGraphRowCount: number;
  visibleGraphMode: "direct" | "fold-first-two";
  detailRowCount: number;
  ownsTop: boolean;
  ownsBottom: boolean;
  previousGraphBottom: string | null;
  hasNextRevision: boolean;
}>): RevisionGutterPlan {
  const normalizedRows = options.graphRows.map(normalizeGraphLine);
  const baseRows = normalizedRows.slice(0, options.baseGraphRowCount);
  const tailStart = options.visibleGraphMode === "direct" ? options.baseGraphRowCount : Math.min(options.baseGraphRowCount, 2);
  const title =
    options.visibleGraphMode === "fold-first-two"
      ? buildCondensedGraphLine(baseRows)
      : (baseRows[0] ?? "");
  const titleContinuation = deriveGraphContinuationLine(title);
  const subtitle = baseRows[1] ?? titleContinuation;
  const tail = normalizedRows.slice(tailStart);
  const detailContinuation = deriveGraphContinuationLine(normalizedRows.at(-1) ?? title);

  return {
    topDivider: options.ownsTop ? (options.previousGraphBottom !== null ? deriveGraphContinuationLine(options.previousGraphBottom) : "") : null,
    title,
    subtitle,
    tail,
    detail: Array.from({ length: options.detailRowCount }, () => detailContinuation),
    bottomDivider: options.ownsBottom ? (options.hasNextRevision ? detailContinuation : "") : null,
  };
}
