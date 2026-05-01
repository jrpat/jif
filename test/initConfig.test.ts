import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { createTempDir } from "./helpers/tempRepo.ts";
import { initUserConfig } from "../src/config/initConfig.ts";

test("initUserConfig creates placeholder config.ts and jif.d.ts", async () => {
  const configDir = await createTempDir("init-config");

  const result = await initUserConfig({ configDir });

  expect(result.configDir).toBe(configDir);
  expect(result.configPath).toBe(join(configDir, "config.ts"));
  expect(result.typesPath).toBe(join(configDir, "jif.d.ts"));
  expect(result.createdConfig).toBeTrue();
  expect(result.createdTypes).toBeTrue();
  expect(result.updatedTypes).toBeFalse();

  const configText = await readFile(result.configPath, "utf8");
  const typesText = await readFile(result.typesPath, "utf8");

  expect(configText).toContain('/// <reference path="./jif.d.ts" />');
  expect(configText).toContain("satisfies Jif.Config");
  expect(configText).toContain("colorScheme: {");
  expect(configText).toContain("colors: {");
  expect(configText).toContain("log: {");
  expect(configText).toContain("commands: {");
  expect(configText).toContain("keymap: {");
  expect(configText).toContain("normal: {");
  expect(configText).toContain('// chromeBorderFocus: "#00cdcd",');
  expect(configText).toContain('// scrollMargin: 1,');
  expect(configText).toContain('// layout: "condensed",');
  expect(configText).toContain("const rev = app.rev;");
  expect(typesText).toContain("declare global {");
  expect(typesText).toContain("namespace Jif {");
  expect(typesText).toContain("type Config = Readonly<{");
  expect(typesText).toContain("rev: RevisionSummary | null");
});

test("initUserConfig does not overwrite an existing config.ts", async () => {
  const configDir = await createTempDir("init-config-existing");
  const configPath = join(configDir, "config.ts");
  const existingConfig = "export default {}\n";
  await writeFile(configPath, existingConfig, "utf8");

  const result = await initUserConfig({ configDir });

  expect(result.createdConfig).toBeFalse();
  expect(result.createdTypes).toBeTrue();
  expect(result.updatedTypes).toBeFalse();
  expect(await readFile(configPath, "utf8")).toBe(existingConfig);
});

test("initUserConfig refreshes an existing jif.d.ts", async () => {
  const configDir = await createTempDir("init-config-existing-types");
  const typesPath = join(configDir, "jif.d.ts");
  await writeFile(typesPath, "export {};\n", "utf8");

  const result = await initUserConfig({ configDir });

  expect(result.createdTypes).toBeFalse();
  expect(result.updatedTypes).toBeTrue();
  expect(await readFile(typesPath, "utf8")).toContain("declare global {");
  expect(await readFile(typesPath, "utf8")).toContain("namespace Jif {");
});

test("initUserConfig generates a standalone config that typechecks", async () => {
  const configDir = await createTempDir("init-config-types");
  const result = await initUserConfig({ configDir });

  const proc = Bun.spawn({
    cmd: ["bunx", "tsc", "--noEmit", result.configPath],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  expect(exitCode).toBe(0);
  expect(stdout).toBe("");
  expect(stderr).toBe("");
});