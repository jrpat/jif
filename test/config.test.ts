import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import {
  defaultAppConfig,
  loadAppConfig,
  resolveAppConfig,
  resolveConfiguredKeymap,
  FALLBACK_PALETTE_DARK,
  FALLBACK_PALETTE_LIGHT,
  type AppConfig,
} from "../src/config/index.ts";

test("resolveAppConfig resolves semantic colors from dark fallback palette", () => {
  const resolved = resolveAppConfig(defaultAppConfig, {
    palette: FALLBACK_PALETTE_DARK,
  });

  expect(typeof resolved.colorScheme.semanticColors.chromeFillOne).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.graphWorkingCopy).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.rowSelectedFill).toBe("string");
  expect(typeof resolved.colorScheme.semanticColors.rowSelectedAccent).toBe("string");
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

test("resolveAppConfig defaults log.scrollMargin to 1", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.log.scrollMargin).toBe(1);
});

test("resolveAppConfig defaults log.revisionIdAdditionalChars to 0", () => {
  const resolved = resolveAppConfig(defaultAppConfig);

  expect(resolved.log.revisionIdAdditionalChars).toBe(0);
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

  expect(resolved.commands.layout).toBe("condensed");
});

test("resolveAppConfig applies commands.layout", () => {
  const config: AppConfig = {
    commands: {
      layout: "super-condensed",
    },
  };

  const resolved = resolveAppConfig(config);

  expect(resolved.commands.layout).toBe("super-condensed");
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
        description: "Run a custom search action",
        run,
      },
    },
  });

  expect(resolved.keymap.normal.j).toBe("move-down");
  expect(resolved.keymap.normal.g).toBe("user:normal:g");

  const command = resolved.commands.find((entry) => entry.id === "user:normal:g");
  expect(command).toBeDefined();
  expect(command?.title).toBe("Custom Search");
  expect(command?.description).toBe("Run a custom search action");
  expect(command?.canonicalKeys).toEqual(["g"]);
  expect(typeof command?.run).toBe("function");
});

test("resolveConfiguredKeymap preserves explicit ids for inline commands", () => {
  const run = () => {};

  const resolved = resolveConfiguredKeymap({
    _global: {
      "ctrl-x": {
        id: "custom.refresh",
        title: "Refresh Everything",
        description: "Refresh the repository view",
        group: "global",
        run,
      },
    },
  });

  expect(resolved.keymap._global["ctrl-x"]).toBe("user:custom.refresh");

  const command = resolved.commands.find((entry) => entry.id === "user:custom.refresh");
  expect(command).toBeDefined();
  expect(command?.canonicalKeys).toEqual(["ctrl-x"]);
  expect(command?.group).toBe("global");
  expect(typeof command?.run).toBe("function");
});

test("resolveConfiguredKeymap namespaces explicit user ids away from built-in command ids", () => {
  const resolved = resolveConfiguredKeymap({
    normal: {
      g: {
        id: "move-up",
        title: "Custom Move Up",
        description: "Do not collide with the built-in command id",
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
        description: "Run a custom action",
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
  expect(resolved.keymap.files.s).toBe("split");
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
