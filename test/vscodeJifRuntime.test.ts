import path from "node:path";
import { expect, test } from "bun:test";
import {
  bundledJifRelativePath,
  resolveBundledJifPath,
  resolveGraphLaunchTarget,
  resolveVscodeConfigOverridePath,
} from "../ext/vscode/src/jifRuntime.ts";

test("bundledJifRelativePath uses dist/bin/jif on unix platforms", () => {
  expect(bundledJifRelativePath("darwin")).toBe(path.join("dist", "bin", "jif"));
  expect(bundledJifRelativePath("linux")).toBe(path.join("dist", "bin", "jif"));
});

test("bundledJifRelativePath adds .exe on windows", () => {
  expect(bundledJifRelativePath("win32")).toBe(path.join("dist", "bin", "jif.exe"));
});

test("resolveBundledJifPath resolves from the extension root", () => {
  expect(resolveBundledJifPath("/tmp/jif-ext", "darwin")).toBe("/tmp/jif-ext/dist/bin/jif");
});

test("resolveVscodeConfigOverridePath resolves from the extension root", () => {
  expect(resolveVscodeConfigOverridePath("/tmp/jif-ext")).toBe(
    "/tmp/jif-ext/assets/jif-vscode.config.ts",
  );
});

test("resolveGraphLaunchTarget prefers a bundled jif binary when present", () => {
  const target = resolveGraphLaunchTarget({
    extensionRoot: "/tmp/jif-ext",
    shellPath: "/bin/zsh",
    platform: "darwin",
    exists: (filePath) => filePath === "/tmp/jif-ext/dist/bin/jif" || filePath === "/bin/zsh",
  });

  expect(target).toEqual({
    command: "/bin/zsh",
    args: ["-lc", "exec '/tmp/jif-ext/dist/bin/jif'"],
    jifCommand: "/tmp/jif-ext/dist/bin/jif",
    source: "bundled",
    configOverridePath: null,
  });
});

test("resolveGraphLaunchTarget appends --config-override when the override file exists", () => {
  const overridePath = "/tmp/jif-ext/assets/jif-vscode.config.ts";
  const target = resolveGraphLaunchTarget({
    extensionRoot: "/tmp/jif-ext",
    shellPath: "/bin/zsh",
    platform: "darwin",
    exists: (filePath) =>
      filePath === "/tmp/jif-ext/dist/bin/jif" ||
      filePath === "/bin/zsh" ||
      filePath === overridePath,
  });

  expect(target.configOverridePath).toBe(overridePath);
  expect(target.args).toEqual([
    "-lc",
    `exec '/tmp/jif-ext/dist/bin/jif' --config-override '${overridePath}'`,
  ]);
});

test("resolveGraphLaunchTarget falls back to jif on PATH when no bundled binary exists", () => {
  const target = resolveGraphLaunchTarget({
    extensionRoot: "/tmp/jif-ext",
    shellPath: "/bin/zsh",
    platform: "darwin",
    exists: (filePath) => filePath === "/bin/zsh",
  });

  expect(target).toEqual({
    command: "/bin/zsh",
    args: ["-lc", "exec 'jif'"],
    jifCommand: "jif",
    source: "path",
    configOverridePath: null,
  });
});

test("resolveGraphLaunchTarget falls back to /bin/sh when the configured shell is unavailable", () => {
  const target = resolveGraphLaunchTarget({
    extensionRoot: "/tmp/jif-ext",
    shellPath: "/missing/zsh",
    platform: "darwin",
    exists: () => false,
  });

  expect(target.command).toBe("/bin/sh");
  expect(target.args).toEqual(["-lc", "exec 'jif'"]);
  expect(target.configOverridePath).toBeNull();
});