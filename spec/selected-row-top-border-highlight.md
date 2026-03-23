# Selected row top border should include background fill

## Problem

When a revision is selected (e.g. during rebase mode), the green background
highlight fills the content area but does not extend to the top border row.
The focused row's blue highlight does cover its top border, so the two states
are visually inconsistent.

## How to reproduce

1. `bun run index.ts --sample`
2. Navigate to the 4th entry
3. Press `r` then `s` to start a rebase-with-descendants
4. The selected (green) row's top border has default background, not green

## Expected

The selected row's top border should be fully green-highlighted, matching how
the focused row's top border is fully blue-highlighted.

## What we know

- The focused row uses connected border corners (├ ┤) via `useConnectedCorners`.
  Its `drawBox` call fills the border area with `backgroundColor`.
- The selected row uses disconnected corners (┌ ┐) because
  `useConnectedCorners = rowState !== "selected"`.
- Changing selected to also use connected corners (`useConnectedCorners = true`)
  did NOT fix the issue in testing, despite the code paths being identical.
- opentui's `drawBox` (Zig native) receives `backgroundColor` and `borderColor`
  separately. There is no `borderBackgroundColor` option on `Box`. The
  `TextTable` renderable does support `borderBackgroundColor` via `drawGrid`,
  but `Box` does not use `drawGrid`.
- Wrapping the bordered box in a parent with `backgroundColor` and setting
  `shouldFill={false}` on the inner box did not help.
- Moving `backgroundColor` to the outer row container did not help.

## Possible approaches not yet tried

- Investigate why `drawBox` behaves differently for the focused vs selected
  box at the native/Zig level — the props appear identical aside from color
  values, so there may be a subtle rendering order or state issue.
- Request `borderBackgroundColor` support on `Box` in opentui upstream.
- Render the top border as a manual content row with explicit `bg`, placed
  above the bordered box in a column wrapper (prototype existed but was
  reverted to avoid new machinery).
