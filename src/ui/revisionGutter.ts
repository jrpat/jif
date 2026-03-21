export type RevisionGutterPlan = Readonly<{
  topDivider: string | null;
  title: string;
  subtitle: string;
  tail: readonly string[];
  detail: readonly string[];
  bottomDivider: string | null;
}>;

const GRAPH_VERTICAL = "│";
const NODE_MARKERS = new Set(["@", "○", "◆", "*"]);
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
  previousGraphHead: string | null;
  nextGraphHead: string | null;
}>): RevisionGutterPlan {
  const title = normalizeGraphLine(options.graphHead);
  const titleContinuation = deriveGraphContinuationLine(title);
  const graphTail = options.graphTail.map(normalizeGraphLine);
  const subtitle = graphTail[0] ?? titleContinuation;
  const tail = graphTail.slice(1);
  const detailContinuation = deriveGraphContinuationLine(graphTail.at(-1) ?? title);
  const bottomDivider = options.nextGraphHead === null
    ? ""
    : deriveGraphContinuationLine(options.nextGraphHead);

  return {
    topDivider: options.ownsTop ? (options.previousGraphHead !== null ? titleContinuation : "") : null,
    title,
    subtitle,
    tail,
    detail: Array.from({ length: options.detailRowCount }, () => detailContinuation),
    bottomDivider: options.ownsBottom ? bottomDivider : null,
  };
}
