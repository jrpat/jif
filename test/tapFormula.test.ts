import { expect, test } from "bun:test";
import { parseChecksums, renderFormula } from "../scripts/release/tapFormula.ts";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);

const FULL_SUMS = [
  `${SHA_A}  jif-v0.2.0-darwin-arm64.tar.gz`,
  `${SHA_B}  jif-v0.2.0-darwin-x64.tar.gz`,
  `${SHA_C}  jif-v0.2.0-linux-arm64.tar.gz`,
  `${SHA_D}  jif-v0.2.0-linux-x64.tar.gz`,
  `${"e".repeat(64)}  jif-v0.2.0-windows-x64.zip`,
  `${"f".repeat(64)}  jif-vscode-darwin-arm64-0.0.1.vsix`,
].join("\n");

test("parseChecksums maps file names to hashes", () => {
  const sums = parseChecksums(FULL_SUMS);
  expect(sums.get("jif-v0.2.0-darwin-arm64.tar.gz")).toBe(SHA_A);
  expect(sums.get("jif-v0.2.0-linux-x64.tar.gz")).toBe(SHA_D);
  expect(sums.size).toBe(6);
});

test("parseChecksums tolerates blank lines and single-space separators", () => {
  const sums = parseChecksums(`\n${SHA_A} one.tar.gz\n\n${SHA_B}  two.tar.gz\n`);
  expect(sums.get("one.tar.gz")).toBe(SHA_A);
  expect(sums.get("two.tar.gz")).toBe(SHA_B);
});

test("renderFormula produces a binary formula for all four brew platforms", () => {
  const formula = renderFormula({ tag: "v0.2.0", checksums: parseChecksums(FULL_SUMS) });

  expect(formula).toContain("class Jif < Formula");
  expect(formula).toContain(`version "0.2.0"`);
  expect(formula).toContain(`license "MIT"`);
  expect(formula).toContain(`depends_on "jj"`);
  expect(formula).toContain(
    `url "https://github.com/jrpat/jif/releases/download/v0.2.0/jif-v0.2.0-darwin-arm64.tar.gz"`,
  );
  expect(formula).toContain(
    `url "https://github.com/jrpat/jif/releases/download/v0.2.0/jif-v0.2.0-linux-x64.tar.gz"`,
  );
  expect(formula).toContain(`sha256 "${SHA_A}"`);
  expect(formula).toContain(`sha256 "${SHA_B}"`);
  expect(formula).toContain(`sha256 "${SHA_C}"`);
  expect(formula).toContain(`sha256 "${SHA_D}"`);
  expect(formula).toContain(`bin.install "jif"`);
  expect(formula).toContain("on_macos");
  expect(formula).toContain("on_linux");
});

test("renderFormula throws when a platform archive is missing from the checksums", () => {
  const missingLinuxArm = FULL_SUMS.split("\n")
    .filter((line) => !line.includes("linux-arm64"))
    .join("\n");

  expect(() =>
    renderFormula({ tag: "v0.2.0", checksums: parseChecksums(missingLinuxArm) }),
  ).toThrow("jif-v0.2.0-linux-arm64.tar.gz");
});

test("renderFormula rejects prerelease tags", () => {
  expect(() =>
    renderFormula({ tag: "v0.2.0-beta.1", checksums: parseChecksums(FULL_SUMS) }),
  ).toThrow(/prerelease/i);
});
