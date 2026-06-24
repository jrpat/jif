# Inline Search

## Intent

Inline search is a layer over the current searchable view. It should feel like
searching "what I am looking at" without requiring every row component to know
about search-specific rendering.

The first supported searchable views are:

- the revision log
- the operation log

Future searchable views should plug into the same search-scope model rather
than adding more mode-specific branches to the reducer or renderer.

## User Model

Pressing `/` enters search when the active view supports it. The query updates
incrementally as the user types. Matches are highlighted in visible rows, and
focus moves to the first matching item for the active search scope.

Pressing Enter confirms the search. The focused match remains focused and the
query remains active, so search-result navigation can continue with `n` and
`p`.

Pressing `f` enters fast jump when the active view supports search. Fast jump
uses the same incremental matching and focus movement as search, but pressing
Enter clears the query and highlights immediately after accepting the focused
match.

Pressing Escape cancels the active search. The query is cleared and focus
returns to the item that was focused when search started.

If a view does not support search, it should not be possible to enter search
mode from that view.

## Design Constraints

### Keep Row Components Unaware of Search

Revision rows, bookmark chips, revision-id renderers, operation-log entries, and
other leaf UI components should not split text into match spans. That would
spread search-specific rendering logic across the UI and make each future
searchable component pay the same boilerplate cost.

Instead, row components continue to render normal text. Search highlighting is
drawn by a separate overlay layer that inspects the already-built render tree.

### Search Scope Is Not the Same as Visible Text

Search is scoped to the active view, not just the exact terminal cells currently
visible. A user should be able to search for an item that exists in the current
view but is below the scroll position.

Highlighting, however, can only draw what is visible. If a matching substring is
horizontally truncated, the item can still match and receive focus, but the
hidden part should not be highlighted.

### Search Must Layer Over Multiple Views

Search should be reusable across full-screen list-like views. The operation log
and revision log are both list views with different row components and different
focus indices. Planned bookmark-focused views should fit the same shape.

For that reason, search behavior is organized by search scope. A scope defines:

- which focus modes it applies to
- how to get and set the focused index
- how many items it owns
- how to produce searchable item text

Adding a new searchable mode should normally mean adding a new scope definition,
not adding new conditionals to search navigation.

### Unsupported Views Should Not Need Renderer Exceptions

The renderer should not hard-code cases such as "not diff viewer." Whether
search can be entered, whether the search prompt should show, and whether
highlights should be visible should all derive from search scope visibility.

This matters because unsupported full-screen views will grow over time. Each new
view should not require a new search exclusion in the render tree.

### The Overlay Must Be Truly Passive When Inactive

OpenTUI renderables can affect the buffer even when they appear visually empty.
In particular, a full-screen `box` with default filling can corrupt wide glyph
cells such as emoji.

The overlay therefore should not be mounted unless there is an active visible
search query. The overlay box must also set `shouldFill={false}` as a guard so
it remains a draw hook instead of a painted layer.

## Matching

Matching is case-insensitive substring search.

Revision-log items search:

- revision id
- first line of the commit description
- bookmarks
- workspaces

Operation-log items search their rendered operation text with ANSI escape
sequences stripped.

Commit descriptions intentionally use only the first line. Full commit-message
search is not part of the current design.

## Highlight Rendering

Highlights are drawn by `SearchHighlightLayer` in `src/ui/searchOverlay.tsx`.
The layer:

- only considers renderables inside matched item ancestors
- groups visible text renderables by row
- reconstructs row text with spacing based on renderable positions
- finds matching ranges in that visible row text
- redraws only the matching visible substring

The highlight color is the default foreground/background inverted explicitly:
normal background as text color and normal foreground as fill color. Do not rely
on ANSI inverse attributes over a transparent background; OpenTUI compositing can
leave the background visually missing.

The overlay draws only visible text. It should not synthesize highlights for
characters that are outside the viewport or truncated away.

## Focus And Cancellation

Search records the focused item index when search mode opens. The existing
search scope says which focus index that value belongs to.

When search text changes, focus can move to matching items. When search is
confirmed, that moved focus is accepted. When search is canceled from search
mode, the recorded starting index is restored before the query and scope are
cleared.

This behavior is intentionally scoped to active search cancellation. Clearing an
already-finalized search query should clear the query without trying to restore
old focus.

## Keyboard Model

Search follows the mode-stack model described in `spec/ux-philosophy.md`.

- `/` enters search only in searchable modes.
- `f` enters fast jump only in searchable modes.
- Text input is handled by search mode.
- Enter finalizes search and returns to the underlying browse mode.
- Escape cancels search and returns to the underlying browse mode.
- After a search is finalized, search-result modes layer `n` and `p` over the
  active searchable view.

The keymap should explain the behavior through modes rather than through hidden
per-command disambiguation.

## Extension Points

To add another searchable view:

1. Add or reuse a first-class focus mode for the view.
2. Add a search scope id if the view has its own focus/index space.
3. Add a scope definition with focus getter, focus setter, item count, and item
   text extraction.
4. Ensure visible row ancestors have stable ids that the overlay can associate
   with searchable item ids.
5. Add focused tests for matching, navigation, cancellation, and visible
   highlighting.

Avoid adding new `if scope === ...` logic outside the search scope definition
unless the behavior genuinely differs from the generic search contract.

## Known Limitations

The overlay currently relies on renderable positions and plain text from the
OpenTUI render tree. It is designed for row-oriented text views, not arbitrary
canvas-like views.

Visible substring reconstruction assumes text segments on a row can be ordered
by x position and joined with spaces. That matches the current revision and
operation-log renderers, but future layouts with overlapping text or complex
wrapping may need a more precise text-cell mapping.

Highlighting uses string offsets, while terminal cells and grapheme clusters can
have different widths. The current implementation avoids drawing when there is
no visible text and clips to the viewport, but future work may need a
grapheme-aware range mapper if search is extended to text with many wide or
combining characters.
