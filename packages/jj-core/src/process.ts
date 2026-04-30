import { spawn } from "node:child_process";
import type { CommandOutput } from "./types.ts";

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

export async function runCommand(
  cwd: string,
  command: readonly string[],
  options?: { color?: boolean },
): Promise<CommandOutput> {
  return await new Promise<CommandOutput>((resolve, reject) => {
    const child = spawn(command[0]!, command.slice(1), {
      cwd,
      env: {
        ...process.env,
        ...(options?.color ? {} : { NO_COLOR: "1" }),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      const resolvedExitCode = exitCode ?? 1;
      if (resolvedExitCode !== 0) {
        reject(new CommandExecutionError({
          command,
          cwd,
          exitCode: resolvedExitCode,
          stderr: stderr.trim(),
        }));
        return;
      }

      resolve({
        stdout,
        stderr,
        exitCode: resolvedExitCode,
      });
    });
  });
}

function quoteCommand(command: readonly string[]): string {
  return command
    .map((part) => {
      if (/^[A-Za-z0-9_./:-]+$/.test(part)) {
        return part;
      }

      return JSON.stringify(part);
    })
    .join(" ");
}