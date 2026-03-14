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
): Promise<CommandOutput> {
  const proc = Bun.spawn({
    cmd: [...command],
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      NO_COLOR: "1",
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
