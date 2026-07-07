import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import {
  DEFAULT_PREVIEW_PANE_FILL_OPACITY,
  defaultAppConfig,
  loadAppConfig,
  resolveAppConfig,
  resolveConfiguredKeymap,
  FALLBACK_PALETTE_DARK,
  FALLBACK_PALETTE_LIGHT,
  type AppConfig,
} from "../src/config/index.ts";
import { runCommand } from "../src/jj/process.ts";

async function initJjWorkspace(parentDir: string, name = "repo"): Promise<string> {
  await runCommand(parentDir, ["jj", "git", "init", name]);
  return join(parentDir, name);
}

test("resolveAppConfig resolves semantic colors from dark fallback palette", () => {
  const resolved = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });

  expect(typeof resolved.colorScheme.semanticColors.chromeFillOne).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.graphWorkingCopy).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.rowSelectedFill).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.rowSelectedAccent).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.promptSuggestionFocusedFill).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.previewPaneFill).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.statusError).toBe("string");
});

test("resolveAppConfig produces different colors for light vs dark palettes", () => {
  const dark = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });
  const light = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_LIGHT,
  });

  expect(dark.colorScheme.semanticColors.chromeFillOne).not.toBe(
    light.colorScheme.semanticColors.chromeFillOne,
  );
  expect(dark.colorScheme.semanticColors.textPrimary).not.toBe(
    light.colorScheme.semanticColors.textPrimary,
  );
  expect(dark.colorScheme.semanticColors.chromeScrollbarThumb).not.toBe(
    light.colorScheme.semanticColors.chromeScrollbarThumb,
  );
});

test("resolveAppConfig applies user hex overrides", () => {
  const config: AppConfig = {
    colorScheme: {
      colors: {
        statusError: "#ff0000",
      },
    },
  };

  const resolved = resolveAppConfig(config, {
    palette: FALLBACK_PALETTE_DARK,
  });

  expect(resolved.colorScheme.semanticColors.statusError).toBe("#ff0000");
});

test("resolveAppConfig applies user palette ref overrides", () => {
  const config: AppConfig = {
    colorScheme: {
      colors: {
        chromeBorderFocus: { source: "cyan", opacity: 1.0 },
      },
    },
  };

  const resolved = resolveAppConfig(config, {
    palette: FALLBACK_PALETTE_DARK,
  });

  // Cyan in the dark fallback palette is #00cdcd
  expect(resolved.colorScheme.semanticColors.chromeBorderFocus).toBe("#00cdcd");
});

test("resolveAppConfig blends colors at sub-1.0 opacity against background", () => {
  const resolved = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });

  // chromeFillOne is background @ 1.0 → should be the background color directly
  expect(resolved.colorScheme.semanticColors.chromeFillOne).toBe("#000000");

  // chromeFillTwo is foreground @ 0.08 → should be very close to background
  const fillTwo = resolved.colorScheme.semanticColors.chromeFillTwo!;
  expect(fillTwo).not.toBe("#000000");
  expect(fillTwo).not.toBe("#e5e5e5");
  // Should be a very dark gray (foreground #e5e5e5 at 8% over #000000)
  expect(fillTwo.startsWith("#")).toBe(true);
});

test("resolveAppConfig derives preview pane fill from the default opacity", () => {
  const dark = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });
  const light = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_LIGHT,
  });

  expect(DEFAULT_PREVIEW_PANE_FILL_OPACITY).toBe(0.03);
  expect(dark.colorScheme.semanticColors.previewPaneFill).toBe("#070707");
  expect(light.colorScheme.semanticColors.previewPaneFill).toBe("#f7f7f7");
});

test("resolveAppConfig applies preview pane fill overrides", () => {
  const resolved = resolveAppConfig({
    colorScheme: {
      colors: {
        previewPaneFill: "#123456",
      },
    },
  }, {
    palette: FALLBACK_PALETTE_DARK,
  });

  expect(resolved.colorScheme.semanticColors.previewPaneFill).toBe("#123456");
});

test("resolveAppConfig makes the scrollbar thumb three steps more prominent than the track", () => {
  const dark = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });
  const light = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_LIGHT,
  });

  expect(dark.colorScheme.semanticColors.chromeFillThree).toBe("#1b1b1b");
  expect(dark.colorScheme.semanticColors.chromeScrollbarThumb).toBe("#373737");
  expect(light.colorScheme.semanticColors.chromeFillThree).toBe("#e0e0e0");
  expect(light.colorScheme.semanticColors.chromeScrollbarThumb).toBe("#c2c2c2");
});

test("resolveAppConfig derives adaptive diff preview colors from the palette", () => {
  const dark = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });
  const light = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_LIGHT,
  });

  // Added/removed line fills blend the palette's green/red against the
  // terminal background, so they stay dark on dark and light on light rather
  // than using OpenTUI's hardcoded dark-background defaults (#1a4d1a/#4d1a1a).
  expect(dark.colorScheme.semanticColors.diffAddedFill).toBe("#001f00");
  expect(dark.colorScheme.semanticColors.diffRemovedFill).toBe("#1f0000");
  expect(light.colorScheme.semanticColors.diffAddedFill).toBe("#d9f8d9");
  expect(light.colorScheme.semanticColors.diffRemovedFill).toBe("#f8d9d9");

  // The +/- signs stay at full palette strength on both themes.
  expect(dark.colorScheme.semanticColors.diffAddedSign).toBe("#00cd00");
  expect(dark.colorScheme.semanticColors.diffRemovedSign).toBe("#cd0000");

  // The line-number gutter follows the foreground, so it flips with the theme.
  expect(dark.colorScheme.semanticColors.diffLineNumber).toBe("#5c5c5c");
  expect(light.colorScheme.semanticColors.diffLineNumber).toBe("#999999");
});

test("resolveAppConfig keeps the focused row fill subtle", () => {
  const dark = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });
  const light = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_LIGHT,
  });

  expect(dark.colorScheme.semanticColors.rowFocusedFill).toBe("#120012");
  expect(light.colorScheme.semanticColors.rowFocusedFill).toBe("#fbe8fb");
});

test("resolveAppConfig keeps prompt suggestion focus on the old blue fill", () => {
  const dark = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });
  const light = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_LIGHT,
  });

  expect(dark.colorScheme.semanticColors.promptSuggestionFocusedFill).toBe("#000024");
  expect(light.colorScheme.semanticColors.promptSuggestionFocusedFill).toBe("#d9d9fc");
  expect(dark.colorScheme.semanticColors.promptSuggestionFocusedFill).not.toBe(
    dark.colorScheme.semanticColors.rowFocusedFill,
  );
});

test("resolveAppConfig defaults log.scrollMargin to 1", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.log.scrollMargin).toBe(1);
});

test("resolveAppConfig defaults log.revisionIdAdditionalChars to 0", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.log.revisionIdAdditionalChars).toBe(0);
});

test("resolveAppConfig defaults scroll settings", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.scroll).toEqual({
    step: 2,
    acceleration: true,
  });
});

test("resolveAppConfig floors and clamps scroll.step", () => {
  expect(resolveAppConfig({ scroll: { step: 3.9 } }).scroll.step).toBe(3);
  expect(resolveAppConfig({ scroll: { step: 0 } }).scroll.step).toBe(1);
  expect(resolveAppConfig({ scroll: { step: -5 } }).scroll.step).toBe(1);
  expect(resolveAppConfig({ scroll: { step: Number.NaN } }).scroll.step).toBe(1);
});

test("resolveAppConfig applies scroll.acceleration", () => {
  const resolved = resolveAppConfig({
    scroll: {
      acceleration: false,
    },
  });

  expect(resolved.scroll.acceleration).toBeFalse();
});

test("resolveAppConfig defaults refresh.intervalMs to 0", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.refresh.intervalMs).toBe(0);
});

test("resolveAppConfig applies refresh.intervalMs", () => {
  const config: AppConfig = {
    refresh: {
      intervalMs: 5000,
    },
  };

  const resolved = resolveAppConfig(config);

  expect(resolved.refresh.intervalMs).toBe(5000);
});

test("resolveAppConfig defaults refresh.watch to true", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.refresh.watch).toBeTrue();
});

test("resolveAppConfig applies refresh.watch", () => {
  expect(resolveAppConfig({ refresh: { watch: false } }).refresh.watch).toBeFalse();
  expect(resolveAppConfig({ refresh: { watch: true } }).refresh.watch).toBeTrue();
});

test("resolveAppConfig disables invalid refresh intervals", () => {
  expect(resolveAppConfig({ refresh: { intervalMs: 0 } }).refresh.intervalMs).toBe(0);
  expect(resolveAppConfig({ refresh: { intervalMs: -1 } }).refresh.intervalMs).toBe(0);
  expect(resolveAppConfig({ refresh: { intervalMs: Number.NaN } }).refresh.intervalMs).toBe(0);
  expect(resolveAppConfig({ refresh: { intervalMs: Number.POSITIVE_INFINITY } }).refresh.intervalMs).toBe(0);
});

test("resolveAppConfig floors and clamps positive refresh intervals", () => {
  expect(resolveAppConfig({ refresh: { intervalMs: 1 } }).refresh.intervalMs).toBe(1000);
  expect(resolveAppConfig({ refresh: { intervalMs: 999 } }).refresh.intervalMs).toBe(1000);
  expect(resolveAppConfig({ refresh: { intervalMs: 1500.9 } }).refresh.intervalMs).toBe(1500);
});

test("resolveAppConfig applies log.revisionIdAdditionalChars", () => {
  const config: AppConfig = {
    log: {
      revisionIdAdditionalChars: 2,
    },
  };

  const resolved = resolveAppConfig(config);

  expect(resolved.log.revisionIdAdditionalChars).toBe(2);
});

test("resolveAppConfig defaults layout to condensed", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.commands.layout).toBe("normal");
});

test("resolveAppConfig applies commands.layout", () => {
  const config: AppConfig = {
    commands: {
      layout: "tight",
    },
  };

  const resolved = resolveAppConfig(config);

  expect(resolved.commands.layout).toBe("tight");
});

test("resolveAppConfig without palette falls back to dark xterm defaults", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  // Should produce the same result as explicitly passing the dark fallback
  const withExplicit = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });

  expect(resolved.colorScheme.semanticColors.chromeFillOne).toBe(
    withExplicit.colorScheme.semanticColors.chromeFillOne,
  );
  expect(resolved.colorScheme.semanticColors.textPrimary).toBe(
    withExplicit.colorScheme.semanticColors.textPrimary,
  );
});

test("resolveConfiguredKeymap preserves built-in bindings while adding inline commands", () => {
  const run = () => {};

  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Custom Search",
        run,
      },
    },
  });

  expect(resolved.keymap.normal.j).toBe("move-down");
  expect(resolved.keymap.normal.g).toBe("user:normal:g");

  const command = resolved.commands.find((entry) => entry.id === "user:normal:g");
  expect(command).toBeDefined();
  expect(command?.title).toBe("Custom Search");
  expect(command?.description).toBeUndefined();
  expect(typeof command?.run).toBe("function");
});

test("resolveConfiguredKeymap preserves explicit ids for inline commands", () => {
  const run = () => {};

  const resolved = resolveConfiguredKeymap({
    _global: {
      "ctrl-x": {
        id: "custom.refresh",
        title: "Refresh Everything",
        group: "global",
        run,
      },
    },
  });

  expect(resolved.keymap._global["ctrl-x"]).toBe("user:custom.refresh");

  const command = resolved.commands.find((entry) => entry.id === "user:custom.refresh");
  expect(command).toBeDefined();
  expect(command?.group).toBe("global");
  expect(typeof command?.run).toBe("function");
});

test("resolveConfiguredKeymap accepts alias bindings with canonical: false", () => {
  const resolved = resolveConfiguredKeymap({
    normal: {
      x: { command: "move-down", canonical: false },
    },
  });

  expect(resolved.keymap.normal.x).toEqual({ command: "move-down", canonical: false });
  expect(resolved.keymap.normal.j).toBe("move-down");
});

test("resolveConfiguredKeymap respects canonical: false on inline commands", () => {
  const run = () => {};

  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Hidden Command",
        canonical: false,
        run,
      },
    },
  });

  expect(resolved.keymap.normal.g).toEqual({ command: "user:normal:g", canonical: false });
  expect(resolved.commands.find((entry) => entry.id === "user:normal:g")).toBeDefined();
});

test("resolveConfiguredKeymap namespaces explicit user ids away from built-in command ids", () => {
  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        id: "move-up",
        title: "Custom Move Up",
        run: () => {},
      },
    },
  });

  expect(resolved.keymap.normal.g).toBe("user:move-up");
  expect(resolved.commands.find((entry) => entry.id === "move-up")?.title).toBe("Move Up");
  expect(resolved.commands.find((entry) => entry.id === "user:move-up")?.title).toBe("Custom Move Up");
});

test("resolveConfiguredKeymap lets users rebind built-in commands by id", () => {
  const resolved = resolveConfiguredKeymap({
    normal: {
      j: "move-up",
    },
  });

  expect(resolved.keymap.normal.j).toBe("move-up");
  expect(resolved.keymap.normal.k).toBe("move-up");
});

test("resolveConfiguredKeymap deep-merges user bindings into the default keymap", () => {
  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        title: "Custom Action",
        run: () => {},
      },
    },
    files: {
      x: "restore",
    },
  });

  expect(resolved.keymap._global.escape).toBe("cancel");
  expect(resolved.keymap.normal.j).toBe("move-down");
  expect(resolved.keymap.normal.g).toBe("user:normal:g");
  expect(resolved.keymap.files["ctrl-s"]).toBe("split");
  expect(resolved.keymap.files.x).toBe("restore");
});

test("loadAppConfig reads config.ts from XDG_CONFIG_HOME/jif", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-config-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;
  const previousHome = process.env.HOME;

  try {
    const configDir = join(tempDir, "jif");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "config.ts"),
      "export default { log: { scrollMargin: 7 } };\n",
      "utf8",
    );

    process.env.XDG_CONFIG_HOME = tempDir;
    process.env.HOME = join(tempDir, "home-ignored");

    const { raw, resolved } = await loadAppConfig();

    expect(raw.log?.scrollMargin).toBe(7);
    expect(resolved.log.scrollMargin).toBe(7);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }

    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    await rm(tempDir, { recursive: true, force: true });
  }
});

test("loadAppConfig reloads modified config files", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-config-reload-"));

  try {
    const configPath = join(tempDir, "config.ts");
    await writeFile(
      configPath,
      "export default { keymap: { extra: { d: { title: 'Deploy', run: () => {} } } } };\n",
      "utf8",
    );

    const first = await loadAppConfig({ replaceUserConfigPath: configPath });
    const firstKeymap = resolveConfiguredKeymap(first.raw.keymap).keymap;
    expect(firstKeymap.extra.d).toBe("user:extra:d");

    await writeFile(
      configPath,
      "export default { keymap: { extra: { x: { title: 'Xray', run: () => {} } } } };\n",
      "utf8",
    );

    const second = await loadAppConfig({ replaceUserConfigPath: configPath });
    const secondKeymap = resolveConfiguredKeymap(second.raw.keymap).keymap;
    expect(secondKeymap.extra.x).toBe("user:extra:x");
    expect(secondKeymap.extra.d).toBeUndefined();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("loadAppConfig with replaceUserConfigPath bypasses discovery", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-replace-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;

  try {
    const xdgDir = join(tempDir, "xdg");
    const xdgConfigDir = join(xdgDir, "jif");
    await mkdir(xdgConfigDir, { recursive: true });
    await writeFile(
      join(xdgConfigDir, "config.ts"),
      "export default { log: { scrollMargin: 99 } };\n",
      "utf8",
    );

    const explicitPath = join(tempDir, "explicit.ts");
    await writeFile(
      explicitPath,
      "export default { log: { scrollMargin: 3 } };\n",
      "utf8",
    );

    process.env.XDG_CONFIG_HOME = xdgDir;

    const { raw, resolved } = await loadAppConfig({ replaceUserConfigPath: explicitPath });

    expect(raw.log?.scrollMargin).toBe(3);
    expect(resolved.log.scrollMargin).toBe(3);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("loadAppConfig layers base under user and override above user", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-layers-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;

  try {
    const xdgDir = join(tempDir, "xdg");
    const xdgConfigDir = join(xdgDir, "jif");
    await mkdir(xdgConfigDir, { recursive: true });
    await writeFile(
      join(xdgConfigDir, "config.ts"),
      "export default { log: { scrollMargin: 5, revisionIdAdditionalChars: 5 } };\n",
      "utf8",
    );

    const basePath = join(tempDir, "base.ts");
    await writeFile(
      basePath,
      "export default { log: { scrollMargin: 1, revisionIdAdditionalChars: 1 }, commands: { layout: 'tight' } };\n",
      "utf8",
    );

    const overridePath = join(tempDir, "override.ts");
    await writeFile(
      overridePath,
      "export default { log: { revisionIdAdditionalChars: 9 } };\n",
      "utf8",
    );

    process.env.XDG_CONFIG_HOME = xdgDir;

    const { raw, resolved } = await loadAppConfig({
      baseLayerPaths: [basePath],
      overrideLayerPaths: [overridePath],
    });

    // user (5) wins over base (1) for scrollMargin; override doesn't touch it
    expect(raw.log?.scrollMargin).toBe(5);
    expect(resolved.log.scrollMargin).toBe(5);
    // override (9) wins over user (5) for revisionIdAdditionalChars
    expect(raw.log?.revisionIdAdditionalChars).toBe(9);
    expect(resolved.log.revisionIdAdditionalChars).toBe(9);
    // base-only key still flows through
    expect(raw.commands?.layout).toBe("tight");
    expect(resolved.commands.layout).toBe("tight");
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("loadAppConfig applies repeated base layers in argv order", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-base-order-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;

  try {
    const xdgDir = join(tempDir, "xdg");
    await mkdir(join(xdgDir, "jif"), { recursive: true });
    process.env.XDG_CONFIG_HOME = xdgDir;

    const a = join(tempDir, "a.ts");
    const b = join(tempDir, "b.ts");
    await writeFile(a, "export default { log: { scrollMargin: 1 } };\n", "utf8");
    await writeFile(b, "export default { log: { scrollMargin: 2 } };\n", "utf8");

    const { resolved } = await loadAppConfig({ baseLayerPaths: [a, b] });
    expect(resolved.log.scrollMargin).toBe(2);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("loadAppConfig applies repeated override layers in argv order", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-override-order-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;

  try {
    const xdgDir = join(tempDir, "xdg");
    await mkdir(join(xdgDir, "jif"), { recursive: true });
    process.env.XDG_CONFIG_HOME = xdgDir;

    const a = join(tempDir, "a.ts");
    const b = join(tempDir, "b.ts");
    await writeFile(a, "export default { log: { scrollMargin: 1 } };\n", "utf8");
    await writeFile(b, "export default { log: { scrollMargin: 2 } };\n", "utf8");

    const { resolved } = await loadAppConfig({ overrideLayerPaths: [a, b] });
    expect(resolved.log.scrollMargin).toBe(2);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("loadAppConfig combines replaceUserConfigPath with base and override layers", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-replace-mix-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;

  try {
    const xdgDir = join(tempDir, "xdg");
    const xdgConfigDir = join(xdgDir, "jif");
    await mkdir(xdgConfigDir, { recursive: true });
    // Discovered file is intentionally bogus to prove it's bypassed
    await writeFile(
      join(xdgConfigDir, "config.ts"),
      "export default { log: { scrollMargin: 99, revisionIdAdditionalChars: 99 } };\n",
      "utf8",
    );

    const replacement = join(tempDir, "replacement.ts");
    await writeFile(
      replacement,
      "export default { log: { scrollMargin: 5 } };\n",
      "utf8",
    );

    const base = join(tempDir, "base.ts");
    await writeFile(
      base,
      "export default { log: { revisionIdAdditionalChars: 1 } };\n",
      "utf8",
    );

    const override = join(tempDir, "override.ts");
    await writeFile(
      override,
      "export default { log: { revisionIdAdditionalChars: 7 } };\n",
      "utf8",
    );

    process.env.XDG_CONFIG_HOME = xdgDir;

    const { resolved } = await loadAppConfig({
      replaceUserConfigPath: replacement,
      baseLayerPaths: [base],
      overrideLayerPaths: [override],
    });

    expect(resolved.log.scrollMargin).toBe(5);
    expect(resolved.log.revisionIdAdditionalChars).toBe(7);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("loadAppConfig throws when a layer file is missing", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-missing-"));
  try {
    const missing = join(tempDir, "does-not-exist.ts");
    await expect(loadAppConfig({ baseLayerPaths: [missing] })).rejects.toThrow(missing);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("loadAppConfig auto-loads .jj/jif/config.ts from the workspace root resolved via jj", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-project-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;

  try {
    const xdgDir = join(tempDir, "xdg");
    await mkdir(join(xdgDir, "jif"), { recursive: true });
    process.env.XDG_CONFIG_HOME = xdgDir;

    const workspace = await initJjWorkspace(tempDir);
    await mkdir(join(workspace, ".jj", "jif"), { recursive: true });
    await writeFile(
      join(workspace, ".jj", "jif", "config.ts"),
      "export default { log: { scrollMargin: 11 } };\n",
      "utf8",
    );

    // Start from a nested subdir to confirm jj resolves the workspace root.
    const nested = join(workspace, "deep", "nested");
    await mkdir(nested, { recursive: true });

    const { resolved } = await loadAppConfig({ projectStartDir: nested });
    expect(resolved.log.scrollMargin).toBe(11);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}, 20000);

test("loadAppConfig auto-loads .jj/jif/config.js when .ts is absent", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-project-js-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;

  try {
    const xdgDir = join(tempDir, "xdg");
    await mkdir(join(xdgDir, "jif"), { recursive: true });
    process.env.XDG_CONFIG_HOME = xdgDir;

    const workspace = await initJjWorkspace(tempDir);
    await mkdir(join(workspace, ".jj", "jif"), { recursive: true });
    await writeFile(
      join(workspace, ".jj", "jif", "config.js"),
      "export default { log: { scrollMargin: 12 } };\n",
      "utf8",
    );

    const { resolved } = await loadAppConfig({ projectStartDir: workspace });
    expect(resolved.log.scrollMargin).toBe(12);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}, 20000);

test("loadAppConfig project-local layer overrides user but is overridden by --config-override", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-project-layer-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;

  try {
    const xdgDir = join(tempDir, "xdg");
    const xdgConfigDir = join(xdgDir, "jif");
    await mkdir(xdgConfigDir, { recursive: true });
    await writeFile(
      join(xdgConfigDir, "config.ts"),
      "export default { log: { scrollMargin: 1, revisionIdAdditionalChars: 1 } };\n",
      "utf8",
    );
    process.env.XDG_CONFIG_HOME = xdgDir;

    const workspace = await initJjWorkspace(tempDir);
    await mkdir(join(workspace, ".jj", "jif"), { recursive: true });
    await writeFile(
      join(workspace, ".jj", "jif", "config.ts"),
      "export default { log: { scrollMargin: 2, revisionIdAdditionalChars: 2 } };\n",
      "utf8",
    );

    const overridePath = join(tempDir, "override.ts");
    await writeFile(
      overridePath,
      "export default { log: { revisionIdAdditionalChars: 9 } };\n",
      "utf8",
    );

    const { resolved } = await loadAppConfig({
      projectStartDir: workspace,
      overrideLayerPaths: [overridePath],
    });

    expect(resolved.log.scrollMargin).toBe(2);
    expect(resolved.log.revisionIdAdditionalChars).toBe(9);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}, 20000);

test("loadAppConfig prefers .jj/jif/config.ts over .jj/jif/config.js when both exist", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-project-precedence-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;

  try {
    const xdgDir = join(tempDir, "xdg");
    await mkdir(join(xdgDir, "jif"), { recursive: true });
    process.env.XDG_CONFIG_HOME = xdgDir;

    const workspace = await initJjWorkspace(tempDir);
    await mkdir(join(workspace, ".jj", "jif"), { recursive: true });
    await writeFile(
      join(workspace, ".jj", "jif", "config.ts"),
      "export default { log: { scrollMargin: 21 } };\n",
      "utf8",
    );
    await writeFile(
      join(workspace, ".jj", "jif", "config.js"),
      "export default { log: { scrollMargin: 22 } };\n",
      "utf8",
    );

    const { resolved } = await loadAppConfig({ projectStartDir: workspace });
    expect(resolved.log.scrollMargin).toBe(21);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}, 20000);

test("loadAppConfig is a no-op when projectStartDir is not inside a jj workspace", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-project-none-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;

  try {
    const xdgDir = join(tempDir, "xdg");
    const xdgConfigDir = join(xdgDir, "jif");
    await mkdir(xdgConfigDir, { recursive: true });
    await writeFile(
      join(xdgConfigDir, "config.ts"),
      "export default { log: { scrollMargin: 7 } };\n",
      "utf8",
    );
    process.env.XDG_CONFIG_HOME = xdgDir;

    const isolated = join(tempDir, "isolated");
    await mkdir(isolated, { recursive: true });

    const { resolved } = await loadAppConfig({ projectStartDir: isolated });
    expect(resolved.log.scrollMargin).toBe(7);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}, 20000);

test("loadAppConfig falls back to ~/.config/jif when XDG_CONFIG_HOME is unset", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "jif-home-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;
  const previousHome = process.env.HOME;

  try {
    const homeDir = join(tempDir, "home");
    const configDir = join(homeDir, ".config", "jif");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "config.ts"),
      "export default { log: { revisionIdAdditionalChars: 4 } };\n",
      "utf8",
    );

    delete process.env.XDG_CONFIG_HOME;
    process.env.HOME = homeDir;

    const { raw, resolved } = await loadAppConfig();

    expect(raw.log?.revisionIdAdditionalChars).toBe(4);
    expect(resolved.log.revisionIdAdditionalChars).toBe(4);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }

    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    await rm(tempDir, { recursive: true, force: true });
  }
});
