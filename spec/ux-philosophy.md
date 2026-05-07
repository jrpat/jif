# UX Philosophy

## Do the Thing, Rely on Undo

When the user asks jif to perform an operation, execute it immediately. Do not
prompt for confirmation. Jujutsu has strong built-in undo/redo support (`jj undo`,
`jj redo`), and jif exposes these as single-key shortcuts (`u` / `U`).

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
