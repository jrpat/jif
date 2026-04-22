import { materializeSampleRepoCached } from "../src/dev/sampleRepo.ts";

const argv = process.argv.slice(2);
const baseDir = readFlagValue(argv, "--base-dir");
const fixturePath = readFlagValue(argv, "--fixture-path");

if (!baseDir || !fixturePath) {
  throw new Error("Expected --base-dir and --fixture-path");
}

const materialized = await materializeSampleRepoCached({
  baseDir,
  fixturePath,
});

process.stdout.write(`${JSON.stringify(materialized)}\n`);

function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const exactIndex = args.indexOf(flag);
  if (exactIndex >= 0) {
    return args[exactIndex + 1];
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}