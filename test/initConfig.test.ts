import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { createTempDir } from "./helpers/tempRepo.ts";
import { initProjectConfig, initUserConfig, refreshUserConfigTypes } from "../src/config/initConfig.ts";
import { DEFAULT_PREVIEW_PANE_FILL_OPACITY } from "../src/config/index.ts";
import { runCommand } from "../src/jj/process.ts";

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
  expect(configText).toContain("scroll: {");
  expect(configText).toContain("refresh: {");
  expect(configText).toContain("commands: {");
  expect(configText).toContain("keymap: {");
  expect(configText).toContain("normal: {");
  expect(configText).toContain('// chromeBorderFocus: "#00cdcd",');
  expect(configText).toContain(
    `// previewPaneFill: { source: "foreground", opacity: ${DEFAULT_PREVIEW_PANE_FILL_OPACITY} },`,
  );
  expect(configText).toContain('// scrollMargin: 1,');
  expect(configText).toContain("// step: 2,");
  expect(configText).toContain("// acceleration: true,");
  expect(configText).toContain("// intervalMs: 0,");
  expect(configText).toContain('// layout: "normal",');
  expect(configText).toContain("// wordWrap: false,");
  expect(configText).toContain("if (!app.rev) return;");
  expect(configText).toContain("return cmd.jji(`show -r ${app.rev}`);");
  expect(typesText).toContain("declare global {");
  expect(typesText).toContain("namespace Jif {");
  expect(typesText).toContain("type Config = Readonly<{");
  expect(typesText).toContain('"promptSuggestionFocusedFill"');
  expect(typesText).toContain('"previewPaneFill"');
  expect(typesText).toContain("scroll?: Readonly<{");
  expect(typesText).toContain("step?: number");
  expect(typesText).toContain("acceleration?: boolean");
  expect(typesText).toContain("intervalMs?: number");
  expect(typesText).toContain("wordWrap?: boolean");
  expect(typesText).toContain("rev: string");
  expect(typesText).toContain("file: string");
  expect(typesText).toContain("focusedRevision: RevisionSummary | null");
  expect(typesText).toContain("focusedFile: ChangedFile | null");
  expect(typesText).toContain("type UserKeyBinding = string | UserAliasBinding | UserKeybindingCommand | null");
  expect(typesText).toContain('| "revision-draft"');
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

test("refreshUserConfigTypes rewrites jif.d.ts without creating config.ts", async () => {
  const configDir = await createTempDir("refresh-user-config-types");
  const typesPath = join(configDir, "jif.d.ts");
  await writeFile(typesPath, "export {};\n", "utf8");

  const result = await refreshUserConfigTypes({ configDir });

  expect(result.configDir).toBe(configDir);
  expect(result.typesPath).toBe(typesPath);
  expect(result.createdTypes).toBeFalse();
  expect(result.updatedTypes).toBeTrue();
  expect(await readFile(typesPath, "utf8")).toContain("type Config = Readonly<{");
  expect(await Bun.file(join(configDir, "config.ts")).exists()).toBeFalse();
});

test("refreshUserConfigTypes writes jif.d.ts next to an explicit config path", async () => {
  const configDir = await createTempDir("refresh-explicit-config-types");
  const configPath = join(configDir, "custom-config.ts");
  await writeFile(configPath, "export default {};\n", "utf8");

  const result = await refreshUserConfigTypes({ configPath });

  expect(result.configDir).toBe(configDir);
  expect(result.typesPath).toBe(join(configDir, "jif.d.ts"));
  expect(result.createdTypes).toBeTrue();
  expect(result.updatedTypes).toBeFalse();
  expect(await readFile(result.typesPath, "utf8")).toContain("namespace Jif {");
});

test("initProjectConfig seeds config.ts under the workspace .jj/jif directory", async () => {
  const baseDir = await createTempDir("init-project-config");
  await runCommand(baseDir, ["jj", "git", "init", "repo"]);
  const workspaceRoot = join(baseDir, "repo");

  const result = await initProjectConfig({ startDir: workspaceRoot });

  expect(result.workspaceRoot).toBe(workspaceRoot);
  expect(result.configDir).toBe(join(workspaceRoot, ".jj", "jif"));
  expect(result.configPath).toBe(join(workspaceRoot, ".jj", "jif", "config.ts"));
  expect(result.typesPath).toBe(join(workspaceRoot, ".jj", "jif", "jif.d.ts"));
  expect(result.createdConfig).toBeTrue();
  expect(result.createdTypes).toBeTrue();

  const configText = await readFile(result.configPath, "utf8");
  expect(configText).toContain('/// <reference path="./jif.d.ts" />');
  expect(configText).toContain("satisfies Jif.Config");

  const typesText = await readFile(result.typesPath, "utf8");
  expect(typesText).toContain("namespace Jif {");
}, 20000);

test("initProjectConfig resolves the workspace root from a nested subdirectory", async () => {
  const baseDir = await createTempDir("init-project-nested");
  await runCommand(baseDir, ["jj", "git", "init", "repo"]);
  const workspaceRoot = join(baseDir, "repo");
  const nested = join(workspaceRoot, "src", "deep");
  await mkdir(nested, { recursive: true });

  const result = await initProjectConfig({ startDir: nested });

  expect(result.workspaceRoot).toBe(workspaceRoot);
  expect(result.configPath).toBe(join(workspaceRoot, ".jj", "jif", "config.ts"));
}, 20000);

test("initProjectConfig throws when not inside a JJ workspace", async () => {
  const baseDir = await mkdtemp(join(tmpdir(), "init-project-not-workspace-"));

  await expect(initProjectConfig({ startDir: baseDir })).rejects.toThrow(
    /Not inside a JJ workspace/,
  );
});

test("initProjectConfig leaves an existing project config in place", async () => {
  const baseDir = await createTempDir("init-project-existing");
  await runCommand(baseDir, ["jj", "git", "init", "repo"]);
  const workspaceRoot = join(baseDir, "repo");
  const projectDir = join(workspaceRoot, ".jj", "jif");
  await mkdir(projectDir, { recursive: true });
  const existingPath = join(projectDir, "config.ts");
  const existing = "export default {};\n";
  await writeFile(existingPath, existing, "utf8");

  const result = await initProjectConfig({ startDir: workspaceRoot });

  expect(result.createdConfig).toBeFalse();
  expect(result.configPath).toBe(existingPath);
  expect(await readFile(existingPath, "utf8")).toBe(existing);
}, 20000);

test("initUserConfig generates a standalone config that typechecks", async () => {
  const configDir = await createTempDir("init-config-types");
  const result = await initUserConfig({ configDir });

  const proc = Bun.spawn({
    cmd: [
      process.execPath,
      join(process.cwd(), "node_modules", "typescript", "bin", "tsc"),
      "--noEmit",
      result.configPath,
    ],
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
}, 20000);
