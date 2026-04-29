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
