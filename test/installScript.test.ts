import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const INSTALL_SH = resolve("install.sh");
const TAG = "v0.0.0-test";

function platformSuffix(): string {
  const os = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return `${os}-${arch}`;
}

async function runInstaller(env: Record<string, string>) {
  const proc = Bun.spawn(["sh", INSTALL_SH], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function makeFixtureRelease(dir: string, options?: { corruptChecksum?: boolean }) {
  const asset = `jif-${TAG}-${platformSuffix()}.tar.gz`;
  const stageDir = join(dir, "stage");
  await mkdir(stageDir, { recursive: true });
  await writeFile(join(stageDir, "jif"), `#!/bin/sh\necho "jif 0.0.0-test"\n`, { mode: 0o755 });

  const assetPath = join(dir, asset);
  await Bun.$`tar -czf ${assetPath} -C ${stageDir} jif`.quiet();

  const hash = options?.corruptChecksum
    ? "0".repeat(64)
    : new Bun.CryptoHasher("sha256").update(await Bun.file(assetPath).bytes()).digest("hex");
  await writeFile(join(dir, "SHA256SUMS"), `${hash}  ${asset}\n`);

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === `/${TAG}/${asset}`) return new Response(Bun.file(assetPath));
      if (path === `/${TAG}/SHA256SUMS`) return new Response(Bun.file(join(dir, "SHA256SUMS")));
      return new Response("not found", { status: 404 });
    },
  });
  return { server, asset };
}

test("install.sh has valid sh syntax", async () => {
  const proc = Bun.spawn(["sh", "-n", INSTALL_SH], { stderr: "pipe" });
  expect(await proc.exited).toBe(0);
});

test("install.sh passes shellcheck when available", async () => {
  if (!Bun.which("shellcheck")) return;
  const proc = Bun.spawn(["shellcheck", INSTALL_SH], { stdout: "pipe", stderr: "pipe" });
  const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  expect(exitCode, stdout).toBe(0);
});

test("install.sh downloads, verifies, and installs the binary", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jif-install-"));
  const { server } = await makeFixtureRelease(dir);
  const installDir = join(dir, "bin");

  try {
    const result = await runInstaller({
      JIF_BASE_URL: `http://localhost:${server.port}`,
      JIF_VERSION: TAG,
      JIF_INSTALL_DIR: installDir,
    });

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toContain("jif 0.0.0-test");

    const installed = await stat(join(installDir, "jif"));
    expect(installed.isFile()).toBeTrue();
    expect(installed.mode & 0o111).toBeGreaterThan(0);
  } finally {
    server.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
});

test("install.sh normalizes a bare version to the v-prefixed tag", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jif-install-"));
  const { server } = await makeFixtureRelease(dir);
  const installDir = join(dir, "bin");

  try {
    const result = await runInstaller({
      JIF_BASE_URL: `http://localhost:${server.port}`,
      JIF_VERSION: TAG.slice(1),
      JIF_INSTALL_DIR: installDir,
    });

    expect(result.exitCode, result.stderr).toBe(0);
    expect(await stat(join(installDir, "jif")).then((s) => s.isFile())).toBeTrue();
  } finally {
    server.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
});

test("install.sh rejects a corrupted checksum and installs nothing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jif-install-"));
  const { server } = await makeFixtureRelease(dir, { corruptChecksum: true });
  const installDir = join(dir, "bin");

  try {
    const result = await runInstaller({
      JIF_BASE_URL: `http://localhost:${server.port}`,
      JIF_VERSION: TAG,
      JIF_INSTALL_DIR: installDir,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("checksum");
    expect(await stat(join(installDir, "jif")).catch(() => null)).toBeNull();
  } finally {
    server.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
});

test("install.sh fails cleanly when the asset is missing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jif-install-"));
  const server = Bun.serve({ port: 0, fetch: () => new Response("nope", { status: 404 }) });
  const installDir = join(dir, "bin");

  try {
    const result = await runInstaller({
      JIF_BASE_URL: `http://localhost:${server.port}`,
      JIF_VERSION: TAG,
      JIF_INSTALL_DIR: installDir,
    });

    expect(result.exitCode).not.toBe(0);
    expect(await stat(join(installDir, "jif")).catch(() => null)).toBeNull();
  } finally {
    server.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
});
