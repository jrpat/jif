import { basename, resolve } from "node:path";
import {
  buildBinary,
  currentBunTarget,
  readFlagValue,
  type CompileTarget,
} from "../../../scripts/buildBinary.ts";
import { resolveBundledJifPath } from "../src/jifRuntime.ts";

const argv = process.argv.slice(2);
const targetArg = readFlagValue(argv, "--target");
const outfileArg = readFlagValue(argv, "--outfile");
const minify = argv.includes("--minify");
const bytecode = !argv.includes("--no-bytecode");
const extensionRoot = resolve(import.meta.dir, "..");
const repositoryRoot = resolve(import.meta.dir, "../../..");

const target = (targetArg ?? currentBunTarget()) as CompileTarget;
const outfile = resolve(outfileArg ?? resolveBundledJifPath(extensionRoot, platformForTarget(target)));

process.chdir(repositoryRoot);

const built = await buildBinary({
  target,
  outfile,
  minify,
  bytecode,
});

console.log(`Bundled ${basename(built.outfile)} for ${built.target}`);
console.log(built.outfile);

function platformForTarget(target: CompileTarget): NodeJS.Platform {
  if (target.startsWith("bun-darwin-")) {
    return "darwin";
  }
  if (target.startsWith("bun-linux-")) {
    return "linux";
  }

  return "win32";
}