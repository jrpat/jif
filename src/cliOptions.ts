export type CliOptions = Readonly<{
  sampleName: string | undefined;
  useLongFlags: boolean;
  explicitRepoPath: string | undefined;
}>;

export function parseCliOptions(argv: readonly string[]): CliOptions {
  return {
    sampleName: readOptionalFlag(argv, "--sample"),
    useLongFlags: argv.includes("--long-flags"),
    explicitRepoPath: readFlagValue(argv, "--repo"),
  };
}

function readOptionalFlag(args: readonly string[], flag: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) {
    return inline.slice(flag.length + 1);
  }

  const exactIndex = args.indexOf(flag);
  if (exactIndex < 0) {
    return undefined;
  }

  const next = args[exactIndex + 1];
  if (next === undefined || next.startsWith("--")) {
    return "";
  }

  return next;
}

function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const exactIndex = args.indexOf(flag);
  if (exactIndex >= 0) {
    return args[exactIndex + 1];
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}