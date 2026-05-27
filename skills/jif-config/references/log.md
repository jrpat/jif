# Log reference

Settings that affect the revision log view live under `log` in `Jif.Config`.

```ts
export default {
  log: {
    scrollMargin: 1,
    revisionIdAdditionalChars: 0,
  },
} satisfies Jif.Config;
```

## Fields

### `scrollMargin` (number, default `1`)

Minimum number of rows kept visible above the top and below the bottom edge of the viewport when navigating with `j`/`k`. Higher values keep more context around the focused revision; `0` lets focus reach the very edge.

Typical sane range: `0`–`5`. Anything bigger is allowed but starts to feel sluggish on short windows.

### `revisionIdAdditionalChars` (number, default `0`)

Jif renders revision ids at the shortest unique prefix across the visible log. This setting adds N extra characters on top. Use a value of `1` or `2` if you want stable, copy-pasteable prefixes even as the log changes.

## Recipes

**Keep three rows of context around the focused revision:**

```ts
log: {
  scrollMargin: 3,
}
```

**Show 2 extra change-id characters everywhere:**

```ts
log: {
  revisionIdAdditionalChars: 2,
}
```
