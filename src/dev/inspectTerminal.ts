import {
  currentBuildExecutablePath,
  runTerminalScenario,
  terminalScenarios,
  type TerminalScenarioId,
  type TerminalThemeName,
  type TerminalViewport,
} from "./terminalHarness.ts";

const args = process.argv.slice(2);
const scenarioId = readScenarioId(readFlagValue(args, "--scenario") ?? "startup_loaded");
const theme = readTheme(readFlagValue(args, "--theme") ?? "light");
const viewport = readViewport(readFlagValue(args, "--viewport"));
const builtPath = readFlagValue(args, "--built");
const captureFrameAudit = args.includes("--frame-audit");

const result = await runTerminalScenario({
  scenarioId,
  theme,
  ...(viewport ? { viewport } : {}),
  ...(builtPath || args.includes("--built-default")
    ? {
        runner: {
          kind: "binary",
          executablePath: builtPath ?? currentBuildExecutablePath(),
        } as const,
      }
    : {}),
  captureFrameAudit,
});

process.stdout.write(`${result.normalizedScreen}\n`);
console.error(`artifactDir=${result.artifactDir}`);

function readFlagValue(argv: readonly string[], flag: string): string | undefined {
  const exactIndex = argv.indexOf(flag);
  if (exactIndex >= 0) {
    return argv[exactIndex + 1];
  }

  const inline = argv.find((value) => value.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}

function readScenarioId(value: string): TerminalScenarioId {
  if (value in terminalScenarios) {
    return value as TerminalScenarioId;
  }

  throw new Error(`Unknown scenario: ${value}`);
}

function readTheme(value: string): TerminalThemeName {
  if (value === "light" || value === "dark") {
    return value;
  }

  throw new Error(`Unknown theme: ${value}`);
}

function readViewport(value: string | undefined): TerminalViewport | undefined {
  if (!value) {
    return undefined;
  }

  const match = /^(\d+)x(\d+)$/u.exec(value);
  if (!match) {
    throw new Error(`Invalid viewport: ${value}`);
  }

  return {
    cols: Number(match[1]),
    rows: Number(match[2]),
  };
}
