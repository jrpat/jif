# UX Philosophy

## Do the Thing, Rely on Undo

When the user asks jif to perform an operation, execute it immediately. Do not
prompt for confirmation. Jujutsu has strong built-in undo/redo support (`jj undo`,
`jj redo`), and jif exposes these as nearby shortcuts (`u` / `alt-u`).

This is a deliberate departure from tools that confirm before acting. Confirmation
dialogs interrupt flow and teach users to press Enter reflexively, which defeats
their purpose. Immediate execution paired with reliable undo keeps the user in
control without slowing them down.

### Edge Cases

There are rare situations where `jj undo` is unavailable or insufficient. Handle
these as they arise rather than adding preventive prompts. If a specific operation
proves genuinely dangerous in practice, consider guarding that operation
specifically instead of adding blanket confirmation to everything.

### Implications

- File-level operations (restore, etc.) execute on keypress.
- Revision-level operations (rebase, squash) execute on Enter after composing
  the command, but do not ask "are you sure?"
- The command bar shows what will happen before execution, serving as a
  lightweight preview rather than a gate.

## Let Modes Own the Keyboard

Keyboard behavior should be explained by the current mode. If a key means
different things in different contexts, model those contexts as distinct modes
and define the bindings on those modes directly.

The runtime model should be a mode stack. There is exactly one active mode at
any given time: the mode on the top of the stack. When a local interaction
temporarily changes what the keyboard should do, push a new mode. When that
interaction ends, pop it and return to the previous mode. `Escape` should
normally mean "pop the top mode".

Avoid a design where a broad shortcut handler receives a key and then asks,
"what state are we in?" to decide what it should mean. That pushes mode logic
down into individual commands and makes the active keymap harder to reason
about. Users should be able to understand the keyboard from the current mode,
which means the top of the mode stack, not from hidden disambiguation rules.

Global shortcuts still have a place, but only as fallback behavior. The active
mode should define the primary bindings, and truly global bindings should apply
only when the current mode does not claim the key. If multiple modes share
bindings, that reuse should be encoded in the mode definitions themselves,
rather than reconstructed later by per-command state checks.

### Implications

- Introduce or reuse a first-class mode when local UI state changes what keys
  should do.
- Model temporary keyboard states by pushing and popping modes instead of
  scattering conditional shortcut logic through command handlers.
- `Escape` should usually pop the top mode and restore the previous one.
- Resolve keys against the mode at the top of the stack first, with global
  shortcuts used only as fallback.
- Shortcut/help surfaces should show the effective bindings for the current
  mode rather than a union of every possible meaning.
- Avoid per-command disambiguation that re-derives active keyboard context from
  incidental state after the key has already been matched.

## Reward the Resident Hand

jif is a tool to be lived in: opened early, kept open, reached for dozens of
times an hour. That changes what "good ergonomics" means. For a tool a user
visits occasionally, the right optimization target is discoverability — easy
to learn, easy to remember. For a tool a user lives in, the right target is
the *rhythm of frequent sequences*: the tiny finger transitions between one
action and the next, repeated thousands of times a day, are the thing that
adds up.

Concretely: any time a frequent sequence of actions can be expressed as a
chord that keeps the user's hand anchored on a modifier, jif should offer a
spelling that supports that chord — even if a more "discoverable" spelling
already exists for the same action. Keep the discoverable spelling for
teaching and for first contact; add the chord-friendly spelling alongside
it for the resident.

These alternate spellings are intentionally not advertised in the shortcut
panel. The shortcut panel is a teaching surface; the chord is for the user
who has already internalized the action and is reaching past discovery into
flow. Surfacing both spellings would clutter the teaching surface without
helping the resident, who already knows.

### Example: Ctrl-Anchored Prompt Entry

The text-input prompts (command, shell, revset) navigate history with
`Ctrl-J` / `Ctrl-K`. Reaching one of those prompts in the first place,
however, requires releasing Ctrl: the canonical bindings are `:` (Shift+`;`),
`>` (Shift+`.`), and `L` (Shift+`l`). A user who wants to "open the command
bar and rerun the most recent command" must press `:`, release Shift,
press `Ctrl-K`, then `Enter` — three distinct hand states.

The alternate ctrl-anchored spellings collapse that into a single chord:

- `Ctrl-;` opens the command prompt
- `Ctrl-.` opens the shell prompt
- `Ctrl-L` opens the revset prompt

With the hand already anchored on Ctrl from these bindings, `Ctrl-K Enter`
flows directly into rerunning the most recent history entry without the
hand changing posture. The bookmark prompt deliberately does *not* get an
alternate, because its autocomplete is over bookmarks rather than history,
so the chord with `Ctrl-K` would not produce a recall action.

### Implications

- When a frequent action can be combined into a chord with an adjacent
  follow-up action, provide an alternate binding that completes the chord
  without breaking hand posture.
- Keep the discoverable spelling as the primary binding and as the entry
  in the shortcut panel.
- Do not surface the alternate spelling in the shortcut panel; let it stay
  an easter egg for the resident user.
- Document the alternate in the spec so the rationale is recoverable, even
  if the in-app help does not announce it.

## Keep Inverses Apart

Default keybindings should respect the physical keyboard, not just mnemonic
logic. Two keys that perform opposing or undoing actions — open vs. dismiss,
advance vs. retreat — must not sit adjacent on a US QWERTY layout. A single
fat-finger slip should never produce the inverse of the intended outcome.

This compounds with jif's other ergonomics commitments. "Reward the Resident
Hand" assumes the keyboard is lived in for hours; small physical missteps
happen constantly, and the cost of each one is paid thousands of times.
"Do the Thing, Rely on Undo" trades confirmation prompts for trust in undo,
but undo only forgives the *intended* action — a slip that opens what you
meant to close (or vice versa) is recoverable in keystrokes but not in
flow, because the user's mental state was already correct. The tool ends up
fighting the user instead of carrying them.

The relevant question for any new default binding is therefore not only "is
this letter mnemonic?" but "what's adjacent, and what does it do?" If the
adjacent key inverts the action, choose a different key.

### Example: Notifications History

The notifications panel was originally opened with `` ` ``, the unshifted
backtick in the upper-left corner. `Escape` is the global cancel/dismiss,
sits immediately above the backtick, and is also the key that closes the
notifications panel once open. A user reaching for one and landing on the
other did the *opposite* of what they intended — opened a panel they meant
to close, or closed a panel they meant to open.

The fix was to move the binding to `~` (Shift+`` ` ``). The action stays in
the same corner of the keyboard, preserving the mnemonic and the muscle
memory, but the Shift requirement means a slip onto `Escape` no longer
fires the notification toggle. The modifier acts as a guard against drift.

### Implications

- Audit physical neighbors, not just letter mnemonics, when introducing a
  default binding — especially for global bindings and for any
  "open dismissable surface" / "dismiss" pair.
- Same-key + modifier pairs (`u` / `alt-u` for undo / redo) can keep related
  actions on the same conceptual axis, but still audit the specific modifier.
- When a corner key is the natural choice but its unshifted form sits next
  to `Escape` or another inverse, prefer the shifted form. The modifier is
  the guard.
- Do not paper over a layout problem with confirmation prompts — that fights
  "Do the Thing, Rely on Undo". Fix the layout instead.

## Reserve the Double Border for Complete-at-Point

A text-input prompt's border style is a visual signal of *what kind of list* it
is offering, readable at a glance before the user parses any row. The double
border is reserved for complete-at-point: structured completion of what belongs
at the cursor — jj subcommands, flags, and flag values in the command bar, and
revset tokens in the revset prompt. Every other state, including the history
view that recalls whole past entries, uses the default single border.

The two views answer different questions. Complete-at-point answers "what can go
*here*?"; history answers "what did I run before?". Tying the heavier border to
complete-at-point lets a resident user distinguish the two instantly, in any
prompt and regardless of which view happened to open first.

This replaces an earlier inversion where the *history* view carried the double
border. That mis-signaled recall as the special mode and gave it visual
prominence even when it was merely the default view on open — exactly backwards
from where the emphasis belongs.

### Implications

- Use the double border only for complete-at-point / structured completion; use
  the single border for history recall and other default states.
- Apply the rule in every prompt that offers both views (the jj command bar and
  the revset prompt today), not only the surface where the feature was first
  introduced.
- The border tracks the active view, not how the prompt was opened: a prompt
  that opens straight into history shows a single border; one that opens into
  complete-at-point shows a double border.

## Protect Left-Side Density

In revision rows, the left edge carries the densest and most decision-relevant
information: revision identity, workspace or bookmark context, and the opening
words of the description. Layout decisions should protect that area first.

Secondary status or mode markers should yield to that hierarchy. If a chip or
badge can either displace or cover high-value left-side content, prefer placing
it on the right edge instead, even when it overlays the row.

### Implications

- Preserve the left-to-right scan order of revision id, context chips, then
  commit message.
- Mode-based chips should be flush-right so they do not hide or displace the
  highest-value text.
- Overlay treatments are acceptable when they preserve the left-side content
  hierarchy.
