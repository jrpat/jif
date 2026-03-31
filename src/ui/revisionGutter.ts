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

export function measureCoreGraphWidth(graphHead: string, graphTail: readonly string[]): number {
  return Math.max(measureGraphLineWidth(graphHead), ...graphTail.map(measureGraphLineWidth), 1);
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

export function buildCondensedGraphLine(graphHead: string, graphTail: readonly string[]): string {
  const title = normalizeGraphLine(graphHead);
  const subtitle = graphTail[0] ? normalizeGraphLine(graphTail[0]!) : "";
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
  graphHead: string;
  graphTail: readonly string[];
  detailRowCount: number;
  ownsTop: boolean;
  ownsBottom: boolean;
  previousGraphBottom: string | null;
  hasNextRevision: boolean;
}>): RevisionGutterPlan {
  const title = normalizeGraphLine(options.graphHead);
  const titleContinuation = deriveGraphContinuationLine(title);
  const graphTail = options.graphTail.map(normalizeGraphLine);
  const subtitle = graphTail[0] ?? titleContinuation;
  const tail = graphTail.slice(1);
  const detailContinuation = deriveGraphContinuationLine(graphTail.at(-1) ?? title);

  return {
    topDivider: options.ownsTop ? (options.previousGraphBottom !== null ? deriveGraphContinuationLine(options.previousGraphBottom) : "") : null,
    title,
    subtitle,
    tail,
    detail: Array.from({ length: options.detailRowCount }, () => detailContinuation),
    bottomDivider: options.ownsBottom ? (options.hasNextRevision ? detailContinuation : "") : null,
  };
}
