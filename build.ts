import { mkdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

const argv = process.argv.slice(2);
const targetArg = readFlagValue(argv, "--target");
const outfileArg = readFlagValue(argv, "--outfile");
const minify = argv.includes("--minify");
const bytecode = !argv.includes("--no-bytecode");

const defaultTarget = currentBunTarget();
const target = (targetArg ?? defaultTarget) as CompileTarget;
const outfile = resolve(outfileArg ?? defaultOutfile(target));

await mkdir(resolve("dist"), { recursive: true });

const result = await Bun.build({
  entrypoints: ["./index.ts"],
  target: "bun",
  format: "esm",
  sourcemap: "linked",
  minify,
  bytecode,
  compile: {
    target,
    outfile,
  },
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log.message);
  }
  process.exit(1);
}

console.log(`Built ${basename(outfile)} for ${target}`);
console.log(outfile);

function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const exactIndex = args.indexOf(flag);
  if (exactIndex >= 0) {
    return args[exactIndex + 1];
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}

type CompileTarget =
  | "bun-darwin-arm64"
  | "bun-darwin-x64"
  | "bun-linux-arm64"
  | "bun-linux-x64"
  | "bun-windows-arm64"
  | "bun-windows-x64";

function currentBunTarget(): CompileTarget {
  const platform = process.platform;
  const arch = process.arch;

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

function defaultOutfile(target: string): string {
  const extension = target.startsWith("bun-windows-") ? ".exe" : "";
  return `dist/jif-${target}${extension}`;
}
