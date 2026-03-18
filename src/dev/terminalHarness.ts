import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Terminal } from "@xterm/headless";
import { JjClient } from "../jj/client.ts";
import { materializeSampleRepo } from "./sampleRepo.ts";

export type TerminalThemeName = "light" | "dark";

export type TerminalViewport = Readonly<{
  cols: number;
  rows: number;
}>;

export type TerminalAction =
  | Readonly<{
      kind: "wait";
      contains?: string;
      idleMs?: number;
      timeoutMs?: number;
    }>
  | Readonly<{
      kind: "input";
      data: string;
    }>;

export type TerminalScenario = Readonly<{
  id: string;
  description: string;
  viewport?: TerminalViewport;
  actions: readonly TerminalAction[];
}>;

export type TerminalRunner =
  | Readonly<{
      kind: "bun";
    }>
  | Readonly<{
      kind: "binary";
      executablePath: string;
    }>;

export type TerminalStyledCell = Readonly<{
  x: number;
  y: number;
  chars: string;
  fg: number;
  bg: number;
  bold: boolean;
  underline: boolean;
}>;

export type TerminalScreenSnapshot = Readonly<{
  lines: readonly string[];
  styledCells: readonly TerminalStyledCell[];
  cursor: Readonly<{
    x: number;
    y: number;
  }>;
}>;

export type TerminalCaptureResult = Readonly<{
  artifactDir: string;
  normalizedScreen: string;
  rawScreen: string;
  rawAnsi: string;
  screen: TerminalScreenSnapshot;
  metadata: Readonly<{
    repoPath: string;
    scenarioId: string;
    theme: TerminalThemeName;
    viewport: TerminalViewport;
    runner: TerminalRunner["kind"];
    frameAuditLogPath: string | null;
  }>;
}>;

const DEFAULT_VIEWPORT: TerminalViewport = {
  cols: 120,
  rows: 40,
};

const DEFAULT_IDLE_MS = 400;
const DEFAULT_TIMEOUT_MS = 10_000;
const PROJECT_ROOT = resolve(import.meta.dir, "../..");
const INDEX_TS_PATH = resolve(PROJECT_ROOT, "index.ts");

const startupWait: TerminalAction = {
  kind: "wait",
  contains: "No commands executed yet",
  idleMs: 1_500,
  timeoutMs: 5_000,
};

const asyncCommandWait: TerminalAction = {
  kind: "wait",
  idleMs: 1_000,
  timeoutMs: 5_000,
};

export const terminalScenarios: Readonly<Record<string, TerminalScenario>> = Object.freeze({
  startup_loaded: {
    id: "startup_loaded",
    description: "Launch the app and wait for the initial screen to stabilize",
    actions: [startupWait],
  },
  move_focus_down: {
    id: "move_focus_down",
    description: "Start a rebase and move the target focus down",
    actions: [
      startupWait,
      { kind: "input", data: "r" },
      asyncCommandWait,
      { kind: "input", data: "j" },
      { kind: "wait" },
    ],
  },
  move_focus_up: {
    id: "move_focus_up",
    description: "Start a rebase, move down, and return to the original target",
    actions: [
      startupWait,
      { kind: "input", data: "r" },
      asyncCommandWait,
      { kind: "input", data: "j" },
      { kind: "wait" },
      { kind: "input", data: "k" },
      { kind: "wait" },
    ],
  },
  expand_revision: {
    id: "expand_revision",
    description: "Expand the focused revision to show changed files",
    actions: [startupWait, { kind: "input", data: "l" }, asyncCommandWait],
  },
  collapse_revision: {
    id: "collapse_revision",
    description: "Expand and collapse the focused revision",
    actions: [
      startupWait,
      { kind: "input", data: "l" },
      asyncCommandWait,
      { kind: "input", data: "h" },
      { kind: "wait" },
    ],
  },
  command_bar_edit: {
    id: "command_bar_edit",
    description: "Enter command mode and type into the command bar",
    actions: [
      startupWait,
      { kind: "input", data: ":" },
      { kind: "wait" },
      { kind: "input", data: "debug" },
      { kind: "wait" },
    ],
  },
  rebase_preview: {
    id: "rebase_preview",
    description: "Start a rebase preview from the focused revision",
    actions: [startupWait, { kind: "input", data: "r" }, asyncCommandWait],
  },
  rebase_toggle_descendants: {
    id: "rebase_toggle_descendants",
    description: "Toggle descendant inclusion in a rebase preview",
    actions: [
      startupWait,
      { kind: "input", data: "r" },
      asyncCommandWait,
      { kind: "input", data: "s" },
      asyncCommandWait,
    ],
  },
  escape_cancel: {
    id: "escape_cancel",
    description: "Enter command mode, type text, and cancel with Escape",
    actions: [
      startupWait,
      { kind: "input", data: ":" },
      { kind: "wait" },
      { kind: "input", data: "debug" },
      { kind: "wait" },
      { kind: "input", data: keyEscape() },
      { kind: "wait" },
    ],
  },
});

export type TerminalScenarioId = keyof typeof terminalScenarios;

export async function runTerminalScenario(options: Readonly<{
  scenarioId: TerminalScenarioId;
  runner?: TerminalRunner;
  viewport?: TerminalViewport;
  theme: TerminalThemeName;
  repoPath?: string;
  captureFrameAudit?: boolean;
}>): Promise<TerminalCaptureResult> {
  const scenario = terminalScenarios[options.scenarioId];
  if (!scenario) {
    throw new Error(`Unknown terminal scenario: ${options.scenarioId}`);
  }
  const runner = options.runner ?? { kind: "bun" };
  const viewport = options.viewport ?? scenario.viewport ?? DEFAULT_VIEWPORT;
  const artifactDir = await createArtifactDir(options.scenarioId, options.theme);
  const repoPath =
    options.repoPath ??
    (await materializeSampleRepo({
      baseDir: await createScenarioTempDir(options.scenarioId),
    })).repoPath;

  const frameAuditLogPath = options.captureFrameAudit
    ? join(artifactDir, "frame-audit.ndjson")
    : null;
  const normalizationAliases = await loadChangeIdAliases(repoPath);
  const terminal = new Terminal({
    cols: viewport.cols,
    rows: viewport.rows,
    scrollback: 0,
    allowProposedApi: true,
    windowOptions: {
      getWinSizeChars: true,
    },
  });

  try {
    const rawAnsi = await runPtyCapture({
      artifactDir,
      captureFrameAudit: options.captureFrameAudit ?? false,
      frameAuditLogPath,
      repoPath,
      runner,
      theme: options.theme,
      viewport,
      actions: scenario.actions,
    });
    await new Promise<void>((resolveWrite) => {
      terminal.write(rawAnsi, resolveWrite);
    });
    const screen = readScreenSnapshot(terminal, viewport);
    const rawScreen = screen.lines.join("\n");
    const normalizedScreen = normalizeTerminalScreen(rawScreen, normalizationAliases);

    await writeArtifactBundle({
      artifactDir,
      frameAuditLogPath,
      metadata: {
        repoPath,
        runner: runner.kind,
        scenarioId: scenario.id,
        theme: options.theme,
        viewport,
      },
      normalizedScreen,
      rawAnsi,
      rawScreen,
      screen,
      terminal,
    });

    return {
      artifactDir,
      normalizedScreen,
      rawScreen,
      rawAnsi,
      screen,
      metadata: {
        repoPath,
        scenarioId: scenario.id,
        theme: options.theme,
        viewport,
        runner: runner.kind,
        frameAuditLogPath,
      },
    };
  } finally {
    terminal.dispose();
  }
}

export function currentBuildExecutablePath(): string {
  const extension = process.platform === "win32" ? ".exe" : "";
  return resolve(PROJECT_ROOT, `dist/jif-${currentCompileTarget()}${extension}`);
}

async function runPtyCapture(options: Readonly<{
  artifactDir: string;
  actions: readonly TerminalAction[];
  captureFrameAudit: boolean;
  frameAuditLogPath: string | null;
  repoPath: string;
  runner: TerminalRunner;
  theme: TerminalThemeName;
  viewport: TerminalViewport;
}>): Promise<string> {
  const env = {
    ...process.env,
    HOME: resolve(PROJECT_ROOT, ".home"),
    TMPDIR: resolve(PROJECT_ROOT, ".tmp"),
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    COLORFGBG: options.theme === "light" ? "0;15" : "15;0",
    REZI_FRAME_AUDIT: options.captureFrameAudit ? "1" : "0",
    ...(options.frameAuditLogPath ? { REZI_FRAME_AUDIT_LOG: options.frameAuditLogPath } : {}),
  };
  const command =
    options.runner.kind === "binary"
      ? [options.runner.executablePath, "--repo", options.repoPath]
      : [process.execPath, "run", INDEX_TS_PATH, "--repo", options.repoPath];
  const payload = {
    command,
    cwd: PROJECT_ROOT,
    env,
    viewport: options.viewport,
    actions: options.actions.map((action) =>
      action.kind === "input"
        ? action
        : {
            kind: action.kind,
            idleMs: action.idleMs ?? DEFAULT_IDLE_MS,
            timeoutMs: action.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          },
    ),
  };

  const proc = Bun.spawn({
    cmd: ["python3", resolve(PROJECT_ROOT, "scripts/terminal_session.py")],
    cwd: PROJECT_ROOT,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.stdin.write(new TextEncoder().encode(JSON.stringify(payload)));
  proc.stdin.end();

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`terminal_session.py failed (${exitCode})\n${stderr}`.trim());
  }

  const result = JSON.parse(stdout) as Readonly<{
    rawAnsiBase64: string;
  }>;
  return new TextDecoder().decode(Uint8Array.fromBase64(result.rawAnsiBase64));
}

function readScreenSnapshot(
  terminal: Terminal,
  viewport: TerminalViewport,
): TerminalScreenSnapshot {
  const buffer = terminal.buffer.active;
  const startLine = buffer.viewportY;
  const lines: string[] = [];

  for (let row = 0; row < viewport.rows; row += 1) {
    const line = buffer.getLine(startLine + row);
    const text = line?.translateToString(false, 0, viewport.cols) ?? "";
    lines.push(text.replace(/\s+$/u, ""));
  }

  return {
    lines,
    styledCells: collectStyledCells(terminal),
    cursor: {
      x: buffer.cursorX,
      y: buffer.cursorY,
    },
  };
}

function normalizeTerminalScreen(
  rawScreen: string,
  aliases: ReadonlyMap<string, string>,
): string {
  let normalized = rawScreen;
  for (const [value, alias] of [...aliases.entries()].sort((left, right) => right[0].length - left[0].length)) {
    normalized = normalized.replaceAll(value, alias);
  }

  return normalized;
}

async function loadChangeIdAliases(repoPath: string): Promise<ReadonlyMap<string, string>> {
  const client = new JjClient(repoPath);
  const repositoryData = await client.loadRepository();
  return new Map(
    repositoryData.revisions.map((revision, index) => [
      revision.changeId,
      `REV${String(index + 1).padStart(2, "0")}`,
    ]),
  );
}

async function writeArtifactBundle(options: Readonly<{
  artifactDir: string;
  frameAuditLogPath: string | null;
  metadata: Readonly<{
    repoPath: string;
    scenarioId: string;
    theme: TerminalThemeName;
    viewport: TerminalViewport;
    runner: TerminalRunner["kind"];
  }>;
  normalizedScreen: string;
  rawAnsi: string;
  rawScreen: string;
  screen: TerminalScreenSnapshot;
  terminal: Terminal;
}>): Promise<void> {
  await Promise.all([
    writeFile(join(options.artifactDir, "screen.normalized.txt"), options.normalizedScreen, "utf8"),
    writeFile(join(options.artifactDir, "screen.raw.txt"), options.rawScreen, "utf8"),
    writeFile(join(options.artifactDir, "raw.ansi"), options.rawAnsi, "utf8"),
    writeFile(
      join(options.artifactDir, "screen.json"),
      `${JSON.stringify(
        {
          ...options.metadata,
          cursor: options.screen.cursor,
          lines: options.screen.lines,
          styledCells: options.screen.styledCells,
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    writeFile(
      join(options.artifactDir, "summary.json"),
      `${JSON.stringify(
        {
          ...options.metadata,
          frameAuditLogPath: options.frameAuditLogPath,
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);
}

function collectStyledCells(terminal: Terminal): readonly TerminalStyledCell[] {
  const buffer = terminal.buffer.active;
  const cells: TerminalStyledCell[] = [];
  const cell = buffer.getNullCell();

  for (let y = 0; y < terminal.rows; y += 1) {
    const line = buffer.getLine(buffer.viewportY + y);
    if (!line) {
      continue;
    }

    for (let x = 0; x < terminal.cols; x += 1) {
      const value = line.getCell(x, cell);
      if (!value) {
        continue;
      }

      const chars = value.getChars();
      if (chars.length === 0 && value.isAttributeDefault()) {
        continue;
      }
      if (chars === " " && value.isAttributeDefault()) {
        continue;
      }

      cells.push({
        x,
        y,
        chars,
        fg: value.getFgColor(),
        bg: value.getBgColor(),
        bold: value.isBold() === 1,
        underline: value.isUnderline() === 1,
      });
    }
  }

  return cells;
}

async function createArtifactDir(
  scenarioId: string,
  theme: TerminalThemeName,
): Promise<string> {
  const root = resolve(PROJECT_ROOT, ".tmp/terminal-artifacts");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, `${scenarioId}-${theme}-`));
  return dir;
}

async function createScenarioTempDir(prefix: string): Promise<string> {
  const root = resolve(PROJECT_ROOT, ".tmp/runtime");
  await mkdir(root, { recursive: true });
  return await mkdtemp(join(root, `${prefix}-`));
}

function currentCompileTarget(): string {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "bun-darwin-arm64";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "bun-darwin-x64";
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return "bun-linux-arm64";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "bun-linux-x64";
  }
  if (process.platform === "win32" && process.arch === "arm64") {
    return "bun-windows-arm64";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "bun-windows-x64";
  }

  throw new Error(`Unsupported Bun compile target for ${process.platform}/${process.arch}`);
}

function keyEscape(): string {
  return "\u001b";
}
