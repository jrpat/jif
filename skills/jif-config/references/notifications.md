# Notifications reference

Settings for the notifications history panel live under `notifications` in `Jif.Config`. Press `~` in any mode to open the panel.

```ts
export default {
  notifications: {
    historyLimit: 50,
  },
} satisfies Jif.Config;
```

## Fields

### `historyLimit` (number, default `50`)

How many past notifications jif retains in the history panel. Older entries fall off the end. Values are clamped to a minimum of `1` and floored to an integer.

## Recipes

**Keep a long scrollback:**

```ts
notifications: {
  historyLimit: 500,
}
```

**Minimum (only the latest):**

```ts
notifications: {
  historyLimit: 1,
}
```
