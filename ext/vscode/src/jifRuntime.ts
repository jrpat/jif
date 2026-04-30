import { existsSync } from "node:fs";
import path from "node:path";

export type GraphLaunchTarget = {
  command: string;
  args: string[];
  jifCommand: string;
  source: "bundled" | "path";
};

type ResolveGraphLaunchTargetOptions = {
  extensionRoot: string;
  shellPath?: string;
  platform?: NodeJS.Platform;
  exists?: (filePath: string) => boolean;
  fallbackCommand?: string;
};

export function bundledJifRelativePath(platform: NodeJS.Platform = process.platform): string {
  const extension = platform === "win32" ? ".exe" : "";
  return path.join("dist", "bin", `jif${extension}`);
}

export function resolveBundledJifPath(
  extensionRoot: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return path.resolve(extensionRoot, bundledJifRelativePath(platform));
}

export function resolveGraphLaunchTarget(options: ResolveGraphLaunchTargetOptions): GraphLaunchTarget {
  const platform = options.platform ?? process.platform;
  const exists = options.exists ?? existsSync;
  const shellPath = options.shellPath ?? process.env.SHELL;
  const bundledJifPath = resolveBundledJifPath(options.extensionRoot, platform);
  const jifCommand = exists(bundledJifPath) ? bundledJifPath : (options.fallbackCommand ?? "jif");
  const source = exists(bundledJifPath) ? "bundled" : "path";

  if (shellPath && path.isAbsolute(shellPath) && exists(shellPath)) {
    return {
      command: shellPath,
      args: ["-lc", `exec ${quoteForPosixShell(jifCommand)}`],
      jifCommand,
      source,
    };
  }

  return {
    command: "/bin/sh",
    args: ["-lc", `exec ${quoteForPosixShell(jifCommand)}`],
    jifCommand,
    source,
  };
}

function quoteForPosixShell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}