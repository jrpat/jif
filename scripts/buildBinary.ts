import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import solidPlugin from "@opentui/solid/bun-plugin";

export type CompileTarget =
  | "bun-darwin-arm64"
  | "bun-darwin-x64"
  | "bun-linux-arm64"
  | "bun-linux-x64"
  | "bun-windows-arm64"
  | "bun-windows-x64";

type InstallEnv = {
  HOME?: string;
  XDG_BIN_HOME?: string;
};

type BuildBinaryOptions = {
  target?: CompileTarget;
  outfile?: string;
  minify?: boolean;
  bytecode?: boolean;
  version?: string;
};

export async function buildBinary(options: BuildBinaryOptions = {}): Promise<{
  outfile: string;
  target: CompileTarget;
}> {
  const config = createBuildConfig(options);
  const target = config.compile.target;
  const outfile = config.compile.outfile;

  await mkdir(dirname(outfile), { recursive: true });

  const result = await Bun.build(config);

  if (!result.success) {
    const messages = result.logs.map((log) => log.message).join("\n");
    throw new Error(messages || `Failed to build ${basename(outfile)}`);
  }

  return { outfile, target };
}

export function createBuildConfig(options: BuildBinaryOptions = {}) {
  const target = options.target ?? currentBunTarget();
  const outfile = resolve(options.outfile ?? defaultOutfile(target));
  const minify = options.minify ?? false;
  const bytecode = options.bytecode ?? true;

  return {
    entrypoints: ["./index.ts", "./src/opentuiParserWorker.ts"],
    target: "bun" as const,
    format: "esm" as const,
    sourcemap: "linked" as const,
    minify,
    bytecode,
    define: {
      "process.env.JIF_VERSION": JSON.stringify(options.version ?? "dev"),
    },
    plugins: [solidPlugin],
    compile: {
      target,
      outfile,
      autoloadBunfig: false,
      autoloadDotenv: false,
    },
  };
}

export function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const exactIndex = args.indexOf(flag);
  if (exactIndex >= 0) {
    return args[exactIndex + 1];
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}

export function currentBunTarget(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): CompileTarget {
  if (platform === "darwin" && arch === "arm64") {
    return "bun-darwin-arm64";
  }
  if (platform === "darwin" && arch === "x64") {
    return "bun-darwin-x64";
  }
  if (platform === "linux" && arch === "arm64") {
    return "bun-linux-arm64";
  }
  if (platform === "linux" && arch === "x64") {
    return "bun-linux-x64";
  }
  if (platform === "win32" && arch === "arm64") {
    return "bun-windows-arm64";
  }
  if (platform === "win32" && arch === "x64") {
    return "bun-windows-x64";
  }

  throw new Error(`Unsupported platform/arch for Bun compile: ${platform}/${arch}`);
}

export function defaultOutfile(target: string): string {
  const extension = target.startsWith("bun-windows-") ? ".exe" : "";
  return `dist/jif-${target}${extension}`;
}

export function resolveInstallBinDir(
  env?: InstallEnv,
): string {
  const resolvedEnv = env ?? process.env;
  const xdgBinHome = resolvedEnv.XDG_BIN_HOME?.trim();
  if (xdgBinHome) {
    return resolve(xdgBinHome);
  }

  const home = resolvedEnv.HOME?.trim() || homedir();
  if (!home) {
    throw new Error("Cannot resolve install directory without HOME or XDG_BIN_HOME");
  }

  return resolve(home, ".local/bin");
}

export function defaultInstallOutfile(
  env?: InstallEnv,
  platform: NodeJS.Platform = process.platform,
): string {
  const extension = platform === "win32" ? ".exe" : "";
  return resolve(resolveInstallBinDir(env), `jif${extension}`);
}
