import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class CommandExecutionError extends Error {
  readonly command: readonly string[];
  readonly cwd: string;
  readonly exitCode: number;
  readonly stderr: string;

  constructor(init: {
    command: readonly string[];
    cwd: string;
    exitCode: number;
    stderr: string;
  }) {
    super(
      `Command failed (${init.exitCode}): ${quoteCommand(init.command)}\n${init.stderr}`.trim(),
    );
    this.name = "CommandExecutionError";
    this.command = init.command;
    this.cwd = init.cwd;
    this.exitCode = init.exitCode;
    this.stderr = init.stderr;
  }
}

export type CommandOutput = Readonly<{
  stdout: string;
  stderr: string;
  exitCode: number;
}>;

export async function runCommand(
  cwd: string,
  command: readonly string[],
  options?: { color?: boolean },
): Promise<CommandOutput> {
  const proc = Bun.spawn({
    cmd: [...command],
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      ...(options?.color ? {} : { NO_COLOR: "1" }),
    },
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (exitCode !== 0) {
    throw new CommandExecutionError({
      command,
      cwd,
      exitCode,
      stderr: stderr.trim(),
    });
  }

  return {
    stdout,
    stderr,
    exitCode,
  };
}

export async function runInteractiveCommand(
  cwd: string,
  command: readonly string[],
): Promise<void> {
  const capture = await createInteractiveTranscriptCapture();
  const stopObserve = observeTTYChanges();
  const proc = Bun.spawn({
    cmd: capture ? [capture.scriptPath, "-q", capture.outputPath, ...command] : [...command],
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env },
  });
  const exitCode = await proc.exited;
  const rawModeChanged = stopObserve?.() ?? false;
  const transcript = capture ? await readInteractiveTranscript(capture.outputPath) : "";
  if (capture) {
    await rm(capture.tempDir, { recursive: true, force: true }).catch(() => {});
  }

  if (exitCode !== 0) {
    if (!rawModeChanged) {
      process.stderr.write("\nPress any key to continue... ");
      await waitForKeypress();
    }
    throw new CommandExecutionError({
      command,
      cwd,
      exitCode,
      stderr: transcript,
    });
  }

  if (!rawModeChanged) {
    process.stderr.write("\nPress any key to continue... ");
    await waitForKeypress();
  }
}

async function createInteractiveTranscriptCapture(): Promise<{
  scriptPath: string;
  tempDir: string;
  outputPath: string;
} | null> {
  const scriptPath = typeof Bun.which === "function" ? Bun.which("script") : null;
  if (!scriptPath) {
    return null;
  }

  const tempDir = await mkdtemp(join(tmpdir(), "jif-script-"));
  return {
    scriptPath,
    tempDir,
    outputPath: join(tempDir, "transcript"),
  };
}

async function readInteractiveTranscript(outputPath: string): Promise<string> {
  try {
    return (await readFile(outputPath, "utf8"))
      .replace(/\r/g, "\n")
      .trim();
  } catch {
    return "";
  }
}

function waitForKeypress(): Promise<void> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.once("data", () => {
      stdin.setRawMode(wasRaw);
      stdin.pause();
      resolve();
    });
  });
}

function observeTTYChanges(): (() => boolean) | null {
  if (!process.stdin.isTTY) return null;

  const initial = getTerminalState();
  if (!initial) return null;

  let changed = false;
  const interval = setInterval(() => {
    const current = getTerminalState();
    if (!current) return;
    for (let i = 0; i < initial.length; i++) {
      if (initial[i] !== current[i]) {
        changed = true;
        clearInterval(interval);
        return;
      }
    }
  }, 100);

  return () => {
    clearInterval(interval);
    return changed;
  };
}

// macOS struct termios is 72 bytes. tcgetattr reads the terminal state
// so we can detect when a child process (like a pager) enters raw mode.
const TERMIOS_SIZE = 72;
const STDIN_FD = 0;

let _tcgetattr: ((fd: number, buf: ReturnType<typeof import("bun:ffi").ptr>) => number) | null =
  null;
let _ffiLoaded = false;

function loadFFI() {
  if (_ffiLoaded) return;
  _ffiLoaded = true;
  try {
    const ffi = require("bun:ffi");
    const lib = ffi.dlopen("libSystem.B.dylib", {
      tcgetattr: {
        args: [ffi.FFIType.i32, ffi.FFIType.pointer],
        returns: ffi.FFIType.i32,
      },
    });
    _tcgetattr = (fd, bufPtr) => lib.symbols.tcgetattr(fd, bufPtr);
  } catch {
    // FFI unavailable — prompting will be skipped
  }
}

function getTerminalState(): Uint8Array | null {
  loadFFI();
  if (!_tcgetattr) return null;
  const ffi = require("bun:ffi");
  const buf = new Uint8Array(TERMIOS_SIZE);
  const result = _tcgetattr(STDIN_FD, ffi.ptr(buf));
  return result === 0 ? buf : null;
}

export function quoteCommand(command: readonly string[]): string {
  return command
    .map((part) => {
      if (/^[A-Za-z0-9_./:-]+$/.test(part)) {
        return part;
      }

      return JSON.stringify(part);
    })
    .join(" ");
}
