export type CliOptions = Readonly<{
  command: "run" | "init-config";
  sampleName: string | undefined;
  useLongFlags: boolean;
  explicitRepoPath: string | undefined;
}>;

export function parseCliOptions(argv: readonly string[]): CliOptions {
  const command = argv[0] === "init-config" ? "init-config" : "run";
  const args = command === "init-config" ? argv.slice(1) : argv;

  return {
    command,
    sampleName: readOptionalFlag(args, "--sample"),
    useLongFlags: args.includes("--long-flags"),
    explicitRepoPath: readFlagValue(args, "--repo"),
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