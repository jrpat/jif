// Release preflight: the jif-release skill runs this before cutting a release.
// One quiet line per step; full command output is shown only on failure.
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { buildBinary } from "../buildBinary.ts";

class StepFailure extends Error {}

async function run(command: readonly string[]): Promise<string> {
  const proc = Bun.spawn([...command], {
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const output = `${stdout}${stderr}`.trim();
  if (exitCode !== 0) {
    throw new StepFailure(output || `${command.join(" ")} exited with code ${exitCode}`);
  }
  return output;
}

async function checkWorkingCopyClean(): Promise<void> {
  const empty = await run(["jj", "log", "--no-graph", "-r", "@", "-T", "empty"]);
  if (empty !== "true") {
    const status = await run(["jj", "status"]).catch(() => "");
    throw new StepFailure(
      `The working copy has uncommitted changes; commit or abandon them first.\n${status}`,
    );
  }
}

async function checkBinarySmoke(): Promise<void> {
  const outfile = resolve(".tmp/preflight/jif");
  await rm(outfile, { force: true });
  await buildBinary({ outfile, version: "preflight" });

  const reported = await run([outfile, "--version"]);
  if (reported !== "jif preflight") {
    throw new StepFailure(`Expected "jif preflight" from ${outfile} --version, got "${reported}"`);
  }
}

const steps: ReadonlyArray<{ name: string; action: () => Promise<unknown> }> = [
  { name: "working copy clean", action: checkWorkingCopyClean },
  { name: "typecheck", action: () => run(["bun", "run", "typecheck"]) },
  { name: "tests", action: () => run(["bun", "test"]) },
  { name: "binary smoke (--version)", action: checkBinarySmoke },
];

for (const step of steps) {
  try {
    await step.action();
    console.log(`✓ ${step.name}`);
  } catch (error) {
    console.log(`✗ ${step.name}`);
    console.error(error instanceof StepFailure ? error.message : error);
    process.exit(1);
  }
}

console.log("Preflight passed.");
