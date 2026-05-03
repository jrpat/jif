import { expect, test } from "bun:test";
import {
  createBuildConfig,
  defaultInstallOutfile,
  resolveInstallBinDir,
} from "../scripts/buildBinary.ts";

test("resolveInstallBinDir uses XDG_BIN_HOME when set", () => {
  const binDir = resolveInstallBinDir({
    XDG_BIN_HOME: "/tmp/custom-bin",
    HOME: "/tmp/home",
  });

  expect(binDir).toBe("/tmp/custom-bin");
});

test("resolveInstallBinDir falls back to HOME/.local/bin", () => {
  const binDir = resolveInstallBinDir({
    HOME: "/tmp/home",
  });

  expect(binDir).toBe("/tmp/home/.local/bin");
});

test("defaultInstallOutfile writes a jif executable into the install bin dir", () => {
  const outfile = defaultInstallOutfile({
    XDG_BIN_HOME: "/tmp/custom-bin",
    HOME: "/tmp/home",
  });

  expect(outfile).toBe("/tmp/custom-bin/jif");
});

test("createBuildConfig disables Bun autoloads for standalone binaries", () => {
  const config = createBuildConfig({
    target: "bun-darwin-arm64",
    outfile: "/tmp/jif",
  });

  expect(config.compile?.autoloadBunfig).toBeFalse();
  expect(config.compile?.autoloadDotenv).toBeFalse();
});
