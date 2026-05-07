import type { BookmarkSuggestion, BookmarkSuggestionBucket } from "../domain/types.ts";

export type BookmarkTarget = Readonly<{ name: string; changeId: string }>;

export function buildBookmarkSuggestions(
  bookmarks: readonly BookmarkTarget[],
  focusedChangeId: string,
  ancestors: readonly string[],
  descendants: readonly string[],
  options: { includeCurrent: boolean },
): readonly BookmarkSuggestion[] {
  const behindDist = new Map<string, number>();
  ancestors.forEach((id, index) => {
    if (!behindDist.has(id)) {
      behindDist.set(id, index + 1);
    }
  });
  const aheadDist = new Map<string, number>();
  descendants.forEach((id, index) => {
    if (!aheadDist.has(id)) {
      aheadDist.set(id, index + 1);
    }
  });

  const items: BookmarkSuggestion[] = [];
  for (const bookmark of bookmarks) {
    const bucket = classify(bookmark.changeId, focusedChangeId, behindDist, aheadDist);
    if (bucket === "current" && !options.includeCurrent) {
      continue;
    }
    const distance = bucket === "current"
      ? 0
      : bucket === "behind"
        ? behindDist.get(bookmark.changeId) ?? Number.POSITIVE_INFINITY
        : bucket === "ahead"
          ? aheadDist.get(bookmark.changeId) ?? Number.POSITIVE_INFINITY
          : Number.POSITIVE_INFINITY;
    items.push({
      name: bookmark.name,
      targetChangeId: bookmark.changeId,
      bucket,
      distance,
    });
  }

  return sortBookmarkSuggestions(items);
}

function classify(
  changeId: string,
  focusedChangeId: string,
  behindDist: ReadonlyMap<string, number>,
  aheadDist: ReadonlyMap<string, number>,
): BookmarkSuggestionBucket {
  if (changeId === focusedChangeId) return "current";
  if (behindDist.has(changeId)) return "behind";
  if (aheadDist.has(changeId)) return "ahead";
  return "other";
}

const BUCKET_PRIORITY: Record<BookmarkSuggestionBucket, number> = {
  current: 0,
  behind: 1,
  ahead: 2,
  other: 3,
};

function sortBookmarkSuggestions(items: readonly BookmarkSuggestion[]): readonly BookmarkSuggestion[] {
  return [...items].sort((a, b) => {
    const bucketDelta = BUCKET_PRIORITY[a.bucket] - BUCKET_PRIORITY[b.bucket];
    if (bucketDelta !== 0) return bucketDelta;
    if (a.bucket === "current" || a.bucket === "other") {
      return a.name.localeCompare(b.name);
    }
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.name.localeCompare(b.name);
  });
}
