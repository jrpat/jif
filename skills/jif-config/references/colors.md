# Color scheme reference

Colors live under `colorScheme.colors` in `Jif.Config`. Each entry overrides one *semantic* color slot — not the terminal palette itself. The user keeps their terminal theme; jif blends against it.

```ts
export default {
  colorScheme: {
    colors: {
      chromeBorderFocus: "#00cdcd",
    },
  },
} satisfies Jif.Config;
```

## Two override formats

Every slot accepts either of:

### 1. Hex string

```ts
chromeBorderFocus: "#00cdcd",
```

Used verbatim. No blending against the terminal background.

### 2. Palette-relative definition

```ts
rowFocusedFill: { source: "blue", opacity: 0.15 },
```

`source` resolves against the terminal's ANSI palette (or its default foreground/background). `opacity` blends the source color against the terminal background — `1.0` is pure source, `0.0` is pure background. This is how the built-in defaults stay readable on both light and dark terminal themes.

Allowed `source` values:

- `foreground`, `background`
- ANSI 8: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`
- ANSI 16: `brightBlack`, `brightRed`, `brightGreen`, `brightYellow`, `brightBlue`, `brightMagenta`, `brightCyan`, `brightWhite`

## Semantic slots

Group them by what they paint.

**Chrome (panels, borders, scrollbars)**
- `chromeFillOne`, `chromeFillTwo`, `chromeFillThree`
- `chromeScrollbarThumb`
- `chromeBorderIdle`, `chromeBorderFocus`

**Preview pane**
- `previewPaneFill` — the pane background and unchanged diff line fill.
- `diffFileName`, `diffAddedFill`, `diffRemovedFill`, `diffAddedSign`, `diffRemovedSign`, `diffLineNumber`

**Row states**
- `rowFocusedFill`
- `rowSelectedFill`, `rowSelectedAccent`
- `rowAffectedFill`
- `rowCommandTargetBorder`
- `rowBorderIdle`, `rowBorderFocus`, `rowBorderSelected`, `rowBorderCommandTarget`

**Graph markers (revision-log lines on the left)**
- `graphWorkingCopy` — the `@` row.
- `graphPlain` — ordinary revisions.
- `graphImmutable` — immutable revisions.
- `graphBookmark` — revisions carrying a bookmark.

**Tags (the colored chips beside revisions)**
- `bookmarkTagFill`, `bookmarkTagText`
- `workspaceTagFill`, `workspaceTagText`
- `conflictTagFill`, `conflictTagText`

**Text hierarchy**
- `textPrimary`, `textSecondary`, `textTertiary`, `textQuaternary`

**Accents**
- `revsetPrefix` — the `revset:` prefix in the prompt.
- `fileFocusMarker` — the marker beside the focused changed file.
- `fileStatusAccent` — the status letter (M/A/D/…) for changed files.

**Status messages**
- `statusInfo`, `statusSuccess`, `statusWarning`, `statusError` — text color.
- `statusInfoFill`, `statusSuccessFill`, `statusWarningFill`, `statusErrorFill` — background fill behind the text.

## Recipes

**Make the focus border green instead of blue:**

```ts
colorScheme: {
  colors: {
    chromeBorderFocus: { source: "green", opacity: 1.0 },
    rowBorderFocus:    { source: "green", opacity: 0.50 },
    rowFocusedFill:    { source: "green", opacity: 0.15 },
  },
}
```

**Lock the working-copy marker to a fixed cyan regardless of palette:**

```ts
colorScheme: {
  colors: {
    graphWorkingCopy: "#00cdcd",
  },
}
```

**Tone down secondary text:**

```ts
colorScheme: {
  colors: {
    textSecondary: { source: "foreground", opacity: 0.55 },
    textTertiary:  { source: "foreground", opacity: 0.38 },
  },
}
```

## Notes

- `colorScheme` is the only top-level field — there is no `mode: "light" | "dark"` selection at the config level. Jif auto-detects the terminal background on startup and falls back to dark.
- Changes take effect at jif startup. Restart jif to see them.
