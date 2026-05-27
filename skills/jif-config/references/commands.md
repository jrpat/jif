# Commands reference

Settings for the command composition bar live under `commands` in `Jif.Config`.

```ts
export default {
  commands: {
    shortFlags: true,
    layout: "condensed",
  },
} satisfies Jif.Config;
```

## Fields

### `shortFlags` (boolean, default `true`)

When `true`, the command bar shows the short form of jj flags (`-r`, `-f`, `-t`, etc.). When `false`, it shows the long form (`--revision`, `--from`, `--to`). Either way, the user can flip on the fly with `-`.

### `layout` (string, default `"condensed"`)

Controls how much vertical space the command-composition area occupies. Allowed values:

- `"expanded"` — full layout with the most context visible.
- `"condensed"` — middle ground, the default.
- `"super-condensed"` — minimum chrome, gives more room to the log.

The user can also rotate through these at runtime with `_` (the `cycle-layout` command).

## Recipes

**Prefer long flag names by default:**

```ts
commands: {
  shortFlags: false,
}
```

**Start in the super-condensed layout:**

```ts
commands: {
  layout: "super-condensed",
}
```
