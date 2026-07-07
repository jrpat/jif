// Renders Formula/jif.rb for jrpat/homebrew-jif-tap from a release's
// SHA256SUMS and (with --push) commits it to the tap. Run by the tap job in
// release.yml; without --push it prints the formula for local inspection.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFlagValue } from "../buildBinary.ts";
import { parseChecksums, renderFormula } from "./tapFormula.ts";

const TAP_REPO = "jrpat/homebrew-jif-tap";

async function run(command: readonly string[], options?: { cwd?: string }): Promise<string> {
  const proc = Bun.spawn([...command], {
    cwd: options?.cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    // Never echo the command: the clone URL embeds the tap token.
    throw new Error(`${command[0]} exited with code ${exitCode}\n${stderr.trim()}`);
  }
  return stdout;
}

const argv = process.argv.slice(2);
const tag = readFlagValue(argv, "--tag");
const checksumsPath = readFlagValue(argv, "--checksums");
const push = argv.includes("--push");

if (!tag || !checksumsPath) {
  console.error(
    "Usage: bun run scripts/release/updateTap.ts --tag vX.Y.Z --checksums <SHA256SUMS> [--push]",
  );
  process.exit(2);
}

const checksums = parseChecksums(await Bun.file(checksumsPath).text());
const formula = renderFormula({ tag, checksums });

if (!push) {
  console.log(formula);
  process.exit(0);
}

const token = process.env.HOMEBREW_TAP_TOKEN;
if (!token) {
  console.error("HOMEBREW_TAP_TOKEN is required with --push");
  process.exit(1);
}

const cloneDir = await mkdtemp(join(tmpdir(), "jif-tap-"));
try {
  await run([
    "git",
    "clone",
    "--depth",
    "1",
    `https://x-access-token:${token}@github.com/${TAP_REPO}.git`,
    cloneDir,
  ]);
  await mkdir(join(cloneDir, "Formula"), { recursive: true });
  await writeFile(join(cloneDir, "Formula", "jif.rb"), formula);

  const status = await run(["git", "-C", cloneDir, "status", "--porcelain"]);
  if (status.trim() === "") {
    console.log(`Formula already up to date for ${tag}; nothing to push.`);
    process.exit(0);
  }

  await run(["git", "-C", cloneDir, "add", "Formula/jif.rb"]);
  await run([
    "git",
    "-C",
    cloneDir,
    "-c",
    "user.name=jif-release",
    "-c",
    "user.email=jif-release@users.noreply.github.com",
    "commit",
    "-m",
    `jif ${tag}`,
  ]);
  await run(["git", "-C", cloneDir, "push"]);
  console.log(`Pushed Formula/jif.rb for ${tag} to ${TAP_REPO}.`);
} finally {
  await rm(cloneDir, { recursive: true, force: true });
}
