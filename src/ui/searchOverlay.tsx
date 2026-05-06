import {
  RGBA,
  isRenderable,
  type OptimizedBuffer,
  type Renderable,
  type ScrollBoxRenderable,
} from "@opentui/core";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { AppState, SearchScopeId } from "../domain/types.ts";
import { findTextMatchRanges, getActiveSearchScope, getSearchMatchItemIds } from "../search/matching.ts";

type TextRenderableLike = Renderable & Readonly<{
  plainText?: string;
  truncate?: boolean;
}>;

type TextSegment = Readonly<{
  x: number;
  y: number;
  text: string;
  start: number;
  end: number;
}>;

type LineGroup = {
  y: number;
  text: string;
  segments: TextSegment[];
};

const DEFAULT_FG = RGBA.fromValues(1, 1, 1, 1);
const DEFAULT_BG = RGBA.fromValues(0, 0, 0, 1);

type SearchHighlightColors = Readonly<{
  fg: RGBA;
  bg: RGBA;
}>;

export function SearchHighlightLayer(props: Readonly<{
  state: AppState;
  config: ResolvedAppConfig;
  getViewport: () => ScrollBoxRenderable | undefined;
}>) {
  return (
    <box
      id="search-highlight-layer"
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      zIndex={5}
      renderAfter={function (this: Renderable, buffer: OptimizedBuffer) {
        drawSearchHighlights({
          buffer,
          state: props.state,
          colors: getSearchHighlightColors(props.config),
          viewport: props.getViewport(),
        });
      }}
    />
  );
}

export function drawSearchHighlights(args: Readonly<{
  buffer: OptimizedBuffer;
  state: AppState;
  colors: SearchHighlightColors;
  viewport: ScrollBoxRenderable | undefined;
}>): void {
  const query = args.state.searchQuery;
  const viewport = args.viewport;
  if (query.length === 0 || !viewport) {
    return;
  }

  const matchedItemIds = getSearchMatchItemIds(args.state);
  if (matchedItemIds.size === 0) {
    return;
  }

  const scope = getActiveSearchScope(args.state);
  const groups = collectSearchLineGroups({
    scope,
    root: viewport.content,
    matchedItemIds,
  });

  for (const group of groups) {
    if (group.y < viewport.viewport.y || group.y >= viewport.viewport.y + viewport.viewport.height) {
      continue;
    }

    for (const range of findTextMatchRanges(group.text, query)) {
      for (const segment of group.segments) {
        const start = Math.max(range.start, segment.start);
        const end = Math.min(range.end, segment.end);
        if (start >= end) {
          continue;
        }

        drawClippedMatch({
          buffer: args.buffer,
          colors: args.colors,
          viewport,
          x: segment.x + start - segment.start,
          y: segment.y,
          text: segment.text.slice(start - segment.start, end - segment.start),
        });
      }
    }
  }
}

function collectSearchLineGroups(args: Readonly<{
  scope: SearchScopeId;
  root: Renderable;
  matchedItemIds: ReadonlySet<string>;
}>): readonly LineGroup[] {
  const groupsByKey = new Map<string, TextSegment[]>();

  for (const renderable of collectTextRenderables(args.root)) {
    const itemId = findSearchItemAncestorId(renderable, args.scope);
    if (!itemId || !args.matchedItemIds.has(itemId)) {
      continue;
    }

    const text = getVisibleText(renderable);
    if (text.length === 0) {
      continue;
    }

    const key = `${itemId}:${renderable.y}`;
    const segments = groupsByKey.get(key) ?? [];
    segments.push({
      x: renderable.x,
      y: renderable.y,
      text,
      start: 0,
      end: 0,
    });
    groupsByKey.set(key, segments);
  }

  return [...groupsByKey.values()].map(buildLineGroup);
}

function buildLineGroup(segments: readonly TextSegment[]): LineGroup {
  const sorted = [...segments].sort((a, b) => a.x - b.x);
  const left = sorted[0]?.x ?? 0;
  let text = "";
  const nextSegments: TextSegment[] = [];

  for (const segment of sorted) {
    const expectedOffset = segment.x - left;
    if (expectedOffset > text.length) {
      text += " ".repeat(expectedOffset - text.length);
    }

    const start = text.length;
    text += segment.text;
    nextSegments.push({
      ...segment,
      start,
      end: text.length,
    });
  }

  return {
    y: sorted[0]?.y ?? 0,
    text,
    segments: nextSegments,
  };
}

function collectTextRenderables(root: Renderable): TextRenderableLike[] {
  const results: TextRenderableLike[] = [];
  for (const child of root.getChildren()) {
    if (!isRenderable(child)) {
      continue;
    }

    if (isTextRenderableLike(child)) {
      results.push(child);
    }

    results.push(...collectTextRenderables(child));
  }

  return results;
}

function isTextRenderableLike(value: Renderable): value is TextRenderableLike {
  return typeof (value as TextRenderableLike).plainText === "string";
}

function getVisibleText(renderable: TextRenderableLike): string {
  const text = renderable.plainText ?? "";
  if (text.length === 0 || renderable.width <= 0 || renderable.height <= 0) {
    return "";
  }

  if (renderable.truncate && text.length > renderable.width) {
    return text.slice(0, Math.max(0, renderable.width - 3));
  }

  return text.slice(0, renderable.width);
}

function findSearchItemAncestorId(renderable: Renderable, scope: SearchScopeId): string | null {
  const prefix = scope === "operation-log" ? "operation-log-entry-" : "revision-";
  let current: Renderable | null = renderable;

  while (current) {
    if (current.id.startsWith(prefix)) {
      return current.id;
    }
    current = current.parent;
  }

  return null;
}

function drawClippedMatch(args: Readonly<{
  buffer: OptimizedBuffer;
  colors: SearchHighlightColors;
  viewport: ScrollBoxRenderable;
  x: number;
  y: number;
  text: string;
}>): void {
  const viewportLeft = args.viewport.viewport.x;
  const viewportRight = viewportLeft + args.viewport.viewport.width;
  const left = Math.max(args.x, viewportLeft);
  const right = Math.min(args.x + args.text.length, viewportRight);
  if (left >= right) {
    return;
  }

  const start = left - args.x;
  const end = right - args.x;
  args.buffer.drawText(
    args.text.slice(start, end),
    left,
    args.y,
    args.colors.fg,
    args.colors.bg,
  );
}

function getSearchHighlightColors(config: ResolvedAppConfig): SearchHighlightColors {
  const colors = config.colorScheme.semanticColors;
  const defaultFg = parseResolvedColor(colors.textPrimary, DEFAULT_FG);
  const defaultBg = parseResolvedColor(colors.chromeFillOne, DEFAULT_BG);
  return {
    fg: defaultBg,
    bg: defaultFg,
  };
}

function parseResolvedColor(value: string | undefined, fallback: RGBA): RGBA {
  if (!value) {
    return fallback;
  }

  try {
    return RGBA.fromHex(value);
  } catch {
    return fallback;
  }
}
