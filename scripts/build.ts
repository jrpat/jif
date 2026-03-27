import { basename } from "node:path";
import {
  buildBinary,
  currentBunTarget,
  defaultOutfile,
  readFlagValue,
  type CompileTarget,
} from "./buildBinary.ts";

const argv = process.argv.slice(2);
const targetArg = readFlagValue(argv, "--target");
const outfileArg = readFlagValue(argv, "--outfile");
const minify = argv.includes("--minify");
const bytecode = !argv.includes("--no-bytecode");

const target = (targetArg ?? currentBunTarget()) as CompileTarget;
const outfile = outfileArg ?? defaultOutfile(target);

const built = await buildBinary({
  target,
  outfile,
  minify,
  bytecode,
});

console.log(`Built ${basename(built.outfile)} for ${built.target}`);
console.log(built.outfile);
