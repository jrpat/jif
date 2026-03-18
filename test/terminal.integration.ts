import { resolve } from "node:path";
import { expect, test } from "bun:test";
import {
  currentBuildExecutablePath,
  runTerminalScenario,
  type TerminalCaptureResult,
} from "../src/dev/terminalHarness.ts";
import { materializeSampleRepo } from "../src/dev/sampleRepo.ts";
import { createTempDir } from "./helpers/tempRepo.ts";

const DEFAULT_VIEWPORT = {
  cols: 120,
  rows: 40,
} as const;

let repoPathPromise: Promise<string> | null = null;

test("terminal startup renders the command bar and sample revisions", async () => {
  const result = await runTerminalScenario({
    scenarioId: "startup_loaded",
    theme: "light",
    viewport: DEFAULT_VIEWPORT,
    repoPath: await getSharedRepoPath(),
  });

  assertScreenContains(result, "command <empty>");
  assertScreenContains(result, "REV01");
  assertScreenContains(result, "REV10");
  expect(result.screen.lines).toHaveLength(DEFAULT_VIEWPORT.rows);
  expect(result.screen.styledCells.length).toBeGreaterThan(100);
}, 30_000);

test("terminal capture includes styled cells and cursor coordinates", async () => {
  const result = await runTerminalScenario({
    scenarioId: "startup_loaded",
    theme: "light",
    viewport: DEFAULT_VIEWPORT,
    repoPath: await getSharedRepoPath(),
  });

  const foregroundColors = new Set(result.screen.styledCells.map((cell) => cell.fg));
  const backgroundColors = new Set(result.screen.styledCells.map((cell) => cell.bg));

  expect(foregroundColors.size).toBeGreaterThan(2);
  expect(backgroundColors.size).toBeGreaterThan(1);
  expect(result.screen.cursor.x).toBeGreaterThanOrEqual(0);
  expect(result.screen.cursor.x).toBeLessThan(DEFAULT_VIEWPORT.cols);
  expect(result.screen.cursor.y).toBeGreaterThanOrEqual(0);
  expect(result.screen.cursor.y).toBeLessThan(DEFAULT_VIEWPORT.rows);
}, 30_000);

test("terminal startup in dark theme still renders styled chrome and revisions", async () => {
  const result = await runTerminalScenario({
    scenarioId: "startup_loaded",
    theme: "dark",
    viewport: DEFAULT_VIEWPORT,
    repoPath: await getSharedRepoPath(),
  });

  assertScreenContains(result, "command <empty>");
  assertScreenContains(result, "REV01");
  assertScreenContains(result, "REV10");
  expect(result.screen.styledCells.length).toBeGreaterThan(100);
}, 30_000);

test("terminal startup in a narrow viewport still renders the first page of history", async () => {
  const result = await runTerminalScenario({
    scenarioId: "startup_loaded",
    theme: "light",
    viewport: {
      cols: 80,
      rows: 24,
    },
    repoPath: await getSharedRepoPath(),
  });

  assertScreenContains(result, "command <empty>");
  assertScreenContains(result, "REV01");
  assertScreenContains(result, "REV05");
  expect(result.screen.lines).toHaveLength(24);
}, 30_000);

test("terminal startup works the same way in the built binary", async () => {
  await Bun.$`env TMPDIR=${resolve(".tmp")} HOME=${resolve(".home")} ${process.execPath} run ${resolve("build.ts")}`.cwd(resolve("."));
  const result = await runTerminalScenario({
    scenarioId: "startup_loaded",
    theme: "light",
    viewport: DEFAULT_VIEWPORT,
    repoPath: await getSharedRepoPath(),
    runner: {
      kind: "binary",
      executablePath: currentBuildExecutablePath(),
    },
  });

  assertScreenContains(result, "command <empty>");
  assertScreenContains(result, "REV01");
  assertScreenContains(result, "REV10");
  expect(result.screen.styledCells.length).toBeGreaterThan(100);
}, 60_000);

async function getSharedRepoPath(): Promise<string> {
  if (!repoPathPromise) {
    repoPathPromise = materializeSampleRepo({
      baseDir: await createTempDir("terminal-suite"),
    }).then((result) => result.repoPath);
  }

  return await repoPathPromise;
}

function assertScreenContains(
  result: TerminalCaptureResult,
  text: string,
) {
  if (!result.normalizedScreen.includes(text)) {
    console.error(`terminal artifactDir=${result.artifactDir}`);
  }
  expect(result.normalizedScreen).toContain(text);
}
