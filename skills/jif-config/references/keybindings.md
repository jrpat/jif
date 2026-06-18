# Keybindings reference

Keybindings live under `keymap` in `Jif.Config`. User keymaps are deep-merged into jif's built-in defaults, so a single entry adds or overrides exactly one key — it does not replace the rest of the map.

```ts
export default {
  keymap: {
    normal: {
      // entries go here
    },
  },
} satisfies Jif.Config;
```

## Three shapes a binding can take

### 1. Rebind a built-in command by id

```ts
keymap: {
  normal: {
    J: "move-down",
  },
}
```

The value is one of jif's command ids (see the full list below).

### 2. Inline command

Defines a brand-new command on the spot. Required: `title`, `run`. Optional: `id`, `canExecute`, `canonical`, `group`.

```ts
keymap: {
  normal: {
    "ctrl-g": {
      id: "show-focused",
      title: "Show Focused Revision",
      run: (cmd, app) => {
        const rev = app.rev;
        if (!rev) return;
        return cmd.jji(`show -r ${rev.revisionId}`);
      },
    },
  },
}
```

The `run` handler receives:

- `cmd` — the command controller. The most useful methods:
  - `cmd.jj("...")` — run a jj command non-interactively.
  - `cmd.jji("...")` — run a jj command interactively (gives it the full terminal; use for `show`, `log`, anything that paints output).
  - `cmd.sh("...")` — run a shell command through `$SHELL -lc` from the cwd jif was launched from.
- `app` — the full `AppState`. The two ergonomic shortcuts you will almost always want:
  - `app.rev` — the focused revision (or `null`).
  - `app.file` — the focused changed file (or `null`).

### 3. Alias (hidden from the shortcut panel)

```ts
keymap: {
  normal: {
    x: { command: "move-down", canonical: false },
  },
}
```

Same applies to inline commands — add `canonical: false` to keep them off the shortcut panel. Useful for muscle-memory aliases without cluttering `?`.

## Scopes (modes)

The top-level keys under `keymap` are scopes. Each scope is a mode in the UI. Pick the most specific scope that fits the user's intent.

| Scope | When the binding is active |
|-------|----------------------------|
| `_global` | Every mode. Mode-specific bindings can shadow these. |
| `normal` | Browsing the revision log (the default mode). |
| `files` | A revision is expanded and a file is focused. Inherits Normal. |
| `op-log` | The operation log panel is open. Does not inherit Normal. |
| `evolog` | The evolog panel is open. Does not inherit Normal. |
| `inline-confirmation` | An inline confirmation prompt is open. |
| `rebase` | Previewing a rebase. Inherits Normal. |
| `restore` | Previewing a restore. Inherits Normal. |
| `squash` | Previewing a squash. Inherits Normal. |
| `interdiff` | Previewing an interdiff. Inherits Normal. |
| `command` | Command bar (`:`) is focused. Input passthrough. |
| `revset` | Revset prompt (`L`) is focused. Input passthrough. |
| `search` | Search prompt (`/`) is focused. Input passthrough. |
| `search-results` | Cycling through revision-log search matches. Inherits Normal. |
| `op-log-search-results` | Cycling through op-log search matches. |
| `evolog-search-results` | Cycling through evolog search matches. |
| `diff-viewer` | Full-screen diff viewer is open. Does not inherit Normal. |
| `notifications` | Notifications panel is open. Does not inherit Normal. |
| `bookmark` | After pressing `b` in Normal. |
| `bookmark-move` | After starting a bookmark-move flow. |
| `extra` | A clean-slate scope (entered with `;`). See below. |

### Extra mode

Pressing `;` in Normal enters Extra — a scope dedicated entirely to user bindings. Unlike most scopes, Extra does **not** inherit Normal, so the whole alphabet is available without shadowing built-ins. Use this for "your stuff" — project scripts, custom workflows.

```ts
keymap: {
  extra: {
    d: {
      title: "Deploy",
      run: (cmd) => cmd.sh("./scripts/deploy.sh"),
    },
  },
}
```

## Key syntax

- Bare letters and punctuation: `j`, `J`, `?`, `~`, `>`, `;`.
- Arrows and named keys: `down`, `up`, `left`, `right`, `enter`, `escape`, `tab`, `space`.
- Modifiers join with `-`: `ctrl-r`, `ctrl-z`, `ctrl-o`, `ctrl-'`.
- Case matters: `J` is shift-j, not the same as `j`.

## Command ids

These are the built-in ids you can bind keys to. (Scopes in parentheses are the modes where the command is normally available; bindings outside those scopes will be ignored.)

### Navigation
- `move-down`, `move-up` — list navigation in any list view.
- `move-parent`, `move-child` — skip-to-parent / skip-to-child in the revision log.
- `jump-to-next-divergent` — cycle visible siblings sharing a change-id.
- `jump-to-bottom` — last entry in the current list.
- `jump-to-working-copy` — jump to `@` in the revision log.

### View
- `expand`, `collapse` — open/close the focused detail view.
- `edit-revset` — change which revisions display.
- `search`, `search-next`, `search-prev` — incremental list search.
- `cycle-layout` — rotate expanded / condensed / super-condensed.
- `shortcut-panel` — expand or collapse the `?` panel.

### Revision ops (Normal)
- `abandon`, `absorb`, `commit`, `describe`, `edit-revision`, `new-revision`.
- `rebase`, `restore-revision`, `split`, `squash`, `interdiff`.
- `show-revision-diff`, `show-file-diff`.
- `toggle-revision-selection`, `toggle-file-selection`.
- `undo`, `redo`.
- `restore` (only in `files` scope: restore the focused/selected files).

### Diff viewer
- `scroll-down`, `scroll-up`, `scroll-left`, `scroll-right`.
- `scroll-down-large`, `scroll-up-large`, `scroll-left-large`, `scroll-right-large`.

### Bookmark mode
- `enter-bookmark-mode`.
- `bookmark-create`, `bookmark-move-from`, `bookmark-move-to`, `bookmark-delete`, `bookmark-forget`, `bookmark-set`, `bookmark-track`, `bookmark-untrack`.

### Op log / Evolog
- `open-operation-log`, `open-evolog`.
- `restore-operation`, `revert-operation`, `show-operation-diff`.

### Notifications
- `open-notifications`, `expand-notification`, `collapse-notification`.

### Command bar
- `command-bar` (`:`), `shell-command-bar` (`>`), `force-last-command` (`!`).
- `toggle-flags` (`-`) — short ↔ long flag names while composing.

### Inline confirmation
- `inline-confirmation-prev-option`, `inline-confirmation-next-option`, `confirm`.

### Other
- `enter-extra-mode`, `refresh-repository`, `cancel`, `quit`, `suspend`.

## Common recipes

**Swap j/k:**

```ts
keymap: {
  normal: {
    j: "move-up",
    k: "move-down",
  },
}
```

**Make `Y` a hidden alias of yank-via-shell:**

```ts
keymap: {
  normal: {
    Y: {
      title: "Copy change-id",
      canonical: false,
      run: (cmd, app) => {
        const rev = app.rev;
        if (!rev) return;
        return cmd.sh(`printf %s ${rev.revisionId} | pbcopy`);
      },
    },
  },
}
```

**Bind a project-specific deploy under Extra:**

```ts
keymap: {
  extra: {
    d: {
      title: "Deploy",
      run: (cmd) => cmd.sh("./scripts/deploy.sh"),
    },
  },
}
```
