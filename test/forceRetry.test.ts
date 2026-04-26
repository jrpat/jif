import { expect, test } from "bun:test";
import { buildForceRetryPlan } from "../src/jj/forceRetry.ts";
import { CommandExecutionError, quoteCommand, runCommand, runInteractiveCommand } from "../src/jj/process.ts";
import { createTempDir } from "./helpers/tempRepo.ts";

test("buildForceRetryPlan appends allow-backwards for bookmark-backwards failures", () => {
  const plan = buildForceRetryPlan({
    commandArgs: ["bookmark", "set", "main", "-r", "bookmark main"],
    stderr: "Error: Refusing to move bookmark backwards or sideways: main\nHint: Use --allow-backwards to allow it.",
  });

  expect(plan?.ruleId).toBe("bookmark-backwards");
  expect(plan?.commandArgs).toEqual([
    "bookmark",
    "set",
    "main",
    "-r",
    "bookmark main",
    "--allow-backwards",
  ]);
  expect(quoteCommand(["jj", ...(plan?.commandArgs ?? [])])).toBe(
    'jj bookmark set main -r "bookmark main" --allow-backwards',
  );
});

test("buildForceRetryPlan appends ignore-immutable for immutable failures", () => {
  const plan = buildForceRetryPlan({
    commandArgs: ["describe", "-r", "@-", "-m", "changed"],
    stderr: "Error: Commit @- is immutable\nHint: Use --ignore-immutable to allow it.",
  });

  expect(plan?.ruleId).toBe("immutable");
  expect(plan?.commandArgs).toEqual([
    "describe",
    "-r",
    "@-",
    "-m",
    "changed",
    "--ignore-immutable",
  ]);
});

test("buildForceRetryPlan does not duplicate an existing force flag", () => {
  const plan = buildForceRetryPlan({
    commandArgs: ["bookmark", "set", "main", "-r", "main-", "--allow-backwards"],
    stderr: "Hint: Use --allow-backwards to allow it.",
  });

  expect(plan?.commandArgs).toEqual([
    "bookmark",
    "set",
    "main",
    "-r",
    "main-",
    "--allow-backwards",
  ]);
});

test("buildForceRetryPlan returns null for unrelated failures", () => {
  expect(
    buildForceRetryPlan({
      commandArgs: ["log"],
      stderr: "Error: no such revision: nope",
    }),
  ).toBeNull();
});

test("buildForceRetryPlan matches the real JJ bookmark-backwards error", async () => {
  const baseDir = await createTempDir("force-retry-bookmark");
  await runCommand(baseDir, ["jj", "git", "init", "repo"]);

  const repoPath = `${baseDir}/repo`;
  await Bun.write(`${repoPath}/file.txt`, "one\n");
  await runCommand(repoPath, ["jj", "commit", "-m", "first"]);
  await Bun.write(`${repoPath}/file.txt`, "two\n");
  await runCommand(repoPath, ["jj", "commit", "-m", "second"]);
  await runCommand(repoPath, ["jj", "bookmark", "create", "main", "-r", "@-"]);

  try {
    await runCommand(repoPath, ["jj", "bookmark", "set", "main", "-r", "main-"]);
    throw new Error("expected bookmark move to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(CommandExecutionError);
    const retry = buildForceRetryPlan({
      commandArgs: ["bookmark", "set", "main", "-r", "main-"],
      stderr: (error as CommandExecutionError).stderr,
    });

    expect(retry?.ruleId).toBe("bookmark-backwards");
    expect(retry?.commandArgs.at(-1)).toBe("--allow-backwards");
  }
}, 20000);

test("runInteractiveCommand captures failure output for interactive retries", async () => {
  try {
    await runInteractiveCommand(process.cwd(), [
      process.execPath,
      "-e",
      "console.error('Error: Commit abcdef12 is immutable\\nHint: Use --ignore-immutable to allow it.'); process.exit(1)",
    ]);
    throw new Error("expected interactive command to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(CommandExecutionError);
    expect((error as CommandExecutionError).stderr).toContain("Use --ignore-immutable to allow it.");
  }
});