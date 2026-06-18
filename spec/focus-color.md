# Focus Color

## A Row State Has One Accent Color, Expressed as Shades

Each revision-row state — focused, selected, command-target — is keyed to a
single base accent color. Every part of that state's appearance is then a
*shade* of that one color: the row fill, the box border, and the highlighted
text (for the focused state, the revision-id prefix) are not independently
chosen colors but the same accent rendered at different intensities.

The shades are produced by blending the accent toward the terminal background
at decreasing opacity. For the focused state today the accent is magenta
(ANSI 5, the same source as the revision-id prefix), and its surfaces are:

- `rowFocusedFill` — accent at low opacity, mostly background (the faint fill)
- `rowBorderFocus` — accent at medium opacity (the box border)
- `revsetPrefix` — accent at full opacity (the revision-id prefix)

The command bar carries the same accent: when a composed `jj` command references
the focused revision (the `target` segment), that token is drawn in the
full-opacity accent too, mirroring how a `selected` token is drawn in the
full-opacity selection accent. The focused revision reads as one color whether
it appears in the log or in the command being assembled against it.

The point is that the focus color is a *variable*, call it X, not three fixed
hex values that happen to look related. If X changed — say from magenta to red —
the fill, the border, and the revision-id prefix would all move with it,
staying coherent automatically. The earlier scheme used blue for all three for
exactly this reason; the family was migrated from blue to magenta as a unit, not
recolored piece by piece.

The same structure governs the other row states: the selected state derives
`rowSelectedFill`, `rowBorderSelected`, and `rowSelectedAccent` from green, and
the command-target state derives its fill and border from yellow. A row state
introduces or changes its color by changing the one accent and letting the
shades follow.

### Implications

- When recoloring a row state, change the single base accent and keep every
  surface a shade of it. Do not hard-code unrelated colors for the fill, the
  border, and the highlighted text.
- New per-state surfaces should be defined as a new opacity of the existing
  accent, not as a fresh color, so the state stays a single visual family.
- Opacity, not hue, distinguishes a state's surfaces from one another: lower
  opacity for large fills, higher opacity for thin borders and text.
- The accent for the focused state is the same color used for the revision-id
  prefix; keep those two in sync so the focused revision reads as one color.
