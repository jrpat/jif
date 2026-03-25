# Command And Revset History Autocomplete

## Summary

Add persisted history for both direct command-bar submissions and revset submissions, and surface that history through a reusable autocomplete list component.

The implementation should:

- store command history in `.jj/jif/command-history`
- store revset history in `.jj/jif/revset-history`
- persist only direct command-bar `Enter` submissions for command history
- persist revset submissions when the revset input is applied
- show most-recently-used entries before any text is entered
- use a shared autocomplete UI that handles list directionality and consistent keyboard navigation

## Key Changes

- Replace the command-specific persistence idea with a general history storage utility, e.g. under `src/history/`:
  - resolve the current workspace’s `.jj/jif/` directory and ensure it exists
  - expose simple load/record helpers parameterized by history kind (`command-history`, `revset-history`, and future kinds)
  - store plain UTF-8 text files, one entry per line
  - use exact-entry dedupe with recency promotion so the most recent unique entry is always first
  - keep the persisted list in MRU order so blank-input autocomplete can use it directly
  - cap stored history at 200 entries
- Add revset history alongside command history:
  - command history records only manual command-bar submissions
  - revset history records revset applies from the revset input
  - shortcut/generated JJ commands remain unsaved
- Extract the repeated dropdown behavior into a reusable autocomplete list component:
  - own rendering, scrolling, selection, empty-selection state, and keyboard navigation behavior
  - support directionality so the list can render top-to-bottom for the command bar and bottom-to-top where that still makes sense elsewhere
  - define “next” and “previous” in terms of visual order, not array index
  - make `Tab` move to the next item in visual order, or select the first visible item if nothing is selected
  - make `Shift-Tab` move to the previous item in visual order, or select the last visible item if nothing is selected
  - keep arrow keys and `Ctrl-j` / `Ctrl-k` aligned with that same visual-order model
- Update command-bar behavior in `src/ui/render.tsx`:
  - when `:` focuses a blank command bar, load/show command history immediately
  - render the command history list top-to-bottom because the command bar sits at the top of the window
  - do not preselect any history item on open or on blank input
  - `Enter` always submits the current command as typed unless the user has explicitly navigated to a history item first
  - selecting a history item fills the input only; a later `Enter` submits it
  - typing filters against the full command string and clears any existing selection
- Update revset input to use the same shared autocomplete list component:
  - keep its current completion/history placement behavior, but route scrolling and navigation through the shared component
  - add revset-history MRU suggestions before any text is entered
  - integrate revset history with the existing completion/filtering model without losing current revset-specific completions

## Interfaces / Type Changes

- Add a general history-store interface such as:
  - `loadHistory(kind: HistoryKind): Promise<string[]>`
  - `recordHistory(kind: HistoryKind, value: string): Promise<string[]>`
- Add a shared autocomplete-list component API that accepts:
  - visible items
  - selected index or no selection
  - directionality
  - item renderer metadata
  - callbacks for selection and acceptance
- Extend command-bar and revset UI state to track:
  - loaded history entries
  - filtered visible entries
  - nullable selected index
  - whether the current list is top-to-bottom or bottom-to-top

## Test Plan

- History utility tests:
  - stores histories under `.jj/jif/`
  - keeps newest unique entries first
  - promotes an existing entry to the front when re-recorded
  - trims to 200 entries
  - command and revset histories are isolated in separate files
  - missing history files return empty lists
- Autocomplete component tests:
  - top-to-bottom and bottom-to-top navigation honor visual order
  - `Tab` selects the next visual item, or the first item when nothing is selected
  - `Shift-Tab` selects the previous visual item, or the last item when nothing is selected
  - arrow keys and `Ctrl-j` / `Ctrl-k` stay consistent with directionality
  - no item is selected by default
- Command-bar tests:
  - `:` on blank input shows MRU command history with no preselection
  - `Enter` submits typed text when no history row is selected
  - navigating to a history row and accepting it fills the input without executing
  - only direct command-bar submits are recorded
- Revset tests:
  - applying a revset records it in revset history
  - blank revset input shows MRU revset history
  - revset history and existing revset completions coexist correctly

## Assumptions

- Storing under the current workspace’s `.jj` directory replaces the earlier repo-path slug filename idea.
- MRU order means the most recently used visible entry is shown first when the list is presented with no filter text.
- “Next” and “previous” navigation are defined by on-screen order so the same key model works across different list directions.
