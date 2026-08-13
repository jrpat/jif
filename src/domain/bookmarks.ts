/**
 * The bookmark name behind a log label.
 *
 * jj's `bookmarks` template decorates a label with sync state: `*` when the
 * local bookmark has diverged from its remote, `??` when it is conflicted.
 * Neither is part of the name a `jj bookmark` command (or a clipboard paste)
 * takes. A `@remote` suffix IS part of the name, so it stays.
 */
export function bookmarkNameFromLabel(label: string): string {
  return label.replace(/[?*]+$/, "");
}
