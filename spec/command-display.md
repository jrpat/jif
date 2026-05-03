# Command Display Should Match What the User Typed

## Problem

The README promises that the command shown in jif's command bar is run
verbatim:

> "When you confirm, jif runs that command verbatim." — README.md

That promise is broken in one specific place: every `jj` command jif runs
on the user's behalf is invoked with `--color=always` injected into argv.
We do this so colorized stderr/stdout can be rendered in toast notifications.

`jj` records the argv it receives in its operation log. So a user who
types `rebase -r q -d n` and confirms it sees this in jif's op-log view:

    args: jj --color always rebase -r q -d n

This contradicts the verbatim promise and is visible noise wherever
recorded operations are surfaced.

## Why It Matters

The op-log view is one of jif's primary surfaces for understanding what
has happened to a repository. It should reflect the user's intent, not
the tool's implementation. An implementation flag like `--color always`
is plumbing; a user reading their op log should not have to mentally
filter it out of every action they ever took.

It also makes the op log inconsistent: a command run via jif has the
flag; the same command run from the shell does not. That diff is purely
cosmetic, but it undermines the readability of the log.

## What We Considered

### Stop injecting `--color=always`, accept uncolored toasts

Rejected. Colored output in toast notifications is a real UX win — `jj`
uses color heavily to communicate revision identity, status, and
structure. Stripping that is a regression.

### Use an env var to force colors

We checked every plausible env var on jj 0.40:

- `CLICOLOR_FORCE=1` — not honored by jj.
- `JJ_CONFIG_TOML=...` — does not exist.
- `JJ_CONFIG=<file>` — works, but replaces the user's entire config
  layer (loses aliases, templates, personal settings). Unacceptable.

There is no env var equivalent to `--color always` that layers on top of
user config.

### Use `--config ui.color=always` or `--config-file <path>`

Both work. Both leak into the recorded args line the same way
`--color always` does. No improvement.

### Set `TERM` to fool `isatty`

Doesn't work. `isatty()` is a kernel-level check on the file descriptor;
it inspects whether the fd is bound to a tty device, not what env vars
are set. `TERM` only tells programs what terminal capabilities to assume
once they have already decided they are talking to one.

### Run `jj` under a pseudo-terminal

The cleanest path in principle: with a PTY, `isatty()` returns true on
the child side, so `jj`'s default `ui.color = "auto"` emits colors with
no flag at all. The recorded argv would be exactly what the user typed.

Bun 1.3.10 has native PTY support (`Bun.spawn` `terminal` option) and we
verified it works. Rejected anyway because it pulls in real complexity:

- PTY line discipline turns `\n` into `\r\n` — every captured byte
  stream needs CR stripping.
- Pager-mode commands emit DECCKM and keypad mode-set/reset escapes
  that show up in toast text and need separate stripping.
- Stdout and stderr merge through a PTY. Several callers depend on
  that separation.
- A platform-specific PTY path is a meaningful surface for bugs given
  jif's small core.

### `PATH`-injected wrapper script

Same issue as the flag-based options. `jj` records the argv it received,
so a wrapper that calls real-`jj` with `--color always` injects the flag
in jj's view; the leak is identical. The only way a wrapper helps is if
it does PTY internally — which is the previous option in shell form,
with the same costs.

## What We're Doing

Strip `--color <value>` from the `args:` line of operation log entries
during parsing.

The injection in `executeCommandArgs` stays as-is. Toasts continue to
receive colorized output. `jj`'s own op log records the full argv (we
cannot change that). But the moment that text crosses into jif's display
layer, the implementation flag is removed.

This means:

- The user's view of their op log shows what they typed.
- Old operations recorded before this change retroactively display cleanly.
- No new mechanisms, no PTY, no platform branching.
- The README's verbatim claim becomes true as far as the user can observe
  in jif.

The narrow scope is intentional. The filter targets a known internal flag
and runs only on the `args:` line. If we ever start injecting other flags
(for example, `--config-file <temp-path>` for some future feature), this
list extends.
