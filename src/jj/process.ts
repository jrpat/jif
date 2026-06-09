import { existsSync } from "node:fs";

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

export async function executeShellCommand(
  cwd: string,
  commandText: string,
  options?: { color?: boolean },
): Promise<string> {
  const result = await runCommand(cwd, [resolveShellPath(), "-lc", commandText], options);
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();
  return stderr || stdout || `Executed: ${commandText.trim()}`;
}

// Run a command interactively: stdin and stdout are inherited so any TUI the
// child program draws (e.g. jj's builtin diff editor or $EDITOR) renders to
// the real terminal. stderr is piped so we can attach the captured text to a
// failure toast without it ever scrolling the user's screen during the run.
//
// We deliberately do NOT wrap the child in `script(1)` or any pty mediator.
// An earlier implementation did so to capture a transcript, but the pty layer
// left the parent terminal's mode tracking subtly out of sync after the child
// exited with non-zero (e.g. q/ctrl-c from `jj split`, :cq from vim), which
// broke the renderer's diff baseline on resume.
export async function runInteractiveCommand(
  cwd: string,
  command: readonly string[],
): Promise<void> {
  const proc = Bun.spawn({
    cmd: [...command],
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "pipe",
    env: { ...process.env },
  });

  const [exitCode, stderr] = await Promise.all([
    proc.exited,
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
}

// A bare argument needs quoting if it contains anything outside this safe set
// (e.g. whitespace, glob/shell metacharacters). Shared with command-bar
// completion so accepted values quote identically to how we render commands.
export function needsQuoting(arg: string): boolean {
  return !/^[A-Za-z0-9_./:-]+$/.test(arg);
}

export function quoteArg(arg: string): string {
  return needsQuoting(arg) ? JSON.stringify(arg) : arg;
}

export function quoteCommand(command: readonly string[]): string {
  return command.map(quoteArg).join(" ");
}

function resolveShellPath(): string {
  const shellPath = process.env.SHELL;
  if (shellPath && shellPath.startsWith("/") && existsSync(shellPath)) {
    return shellPath;
  }

  return "/bin/sh";
}
