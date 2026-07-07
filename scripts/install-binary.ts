import { basename } from "node:path";
import {
  buildBinary,
  currentBunTarget,
  defaultInstallOutfile,
  readFlagValue,
  type CompileTarget,
} from "./buildBinary.ts";

const argv = process.argv.slice(2);
const targetArg = readFlagValue(argv, "--target");
const outfileArg = readFlagValue(argv, "--outfile");
const minify = !argv.includes("--no-minify");
const bytecode = !argv.includes("--no-bytecode");
const version = readFlagValue(argv, "--app-version") ?? process.env.JIF_VERSION;

const target = (targetArg ?? currentBunTarget()) as CompileTarget;
const outfile = outfileArg ?? defaultInstallOutfile();

const built = await buildBinary({
  target,
  outfile,
  minify,
  bytecode,
  version,
});

console.log(`Installed ${basename(built.outfile)} for ${built.target}`);
console.log(built.outfile);
