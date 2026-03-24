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
