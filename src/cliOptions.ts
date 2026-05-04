import { parseArgs } from "node:util";

export type RunOptions = Readonly<{
  sampleName: string | undefined;
  useLongFlags: boolean;
  explicitRepoPath: string | undefined;
  configReplacement: string | undefined;
  configBaseLayers: readonly string[];
  configOverrideLayers: readonly string[];
}>;

export type InitConfigOptions = Readonly<{
  project: boolean;
  projectStartDir: string | undefined;
}>;

export type Command =
  | { readonly kind: "run"; readonly options: RunOptions }
  | { readonly kind: "init-config"; readonly options: InitConfigOptions };

export function parseCommand(argv: readonly string[]): Command {
  if (argv[0] === "init-config") {
    return { kind: "init-config", options: parseInitConfigOptions(argv.slice(1)) };
  }

  return { kind: "run", options: parseRunOptions(argv) };
}

function parseInitConfigOptions(args: readonly string[]): InitConfigOptions {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      project: { type: "boolean", short: "p" },
    },
    allowPositionals: true,
    strict: true,
  });

  const project = values.project === true;

  if (!project && positionals.length > 0) {
    throw new Error(`init config: positional argument requires --project (-p)`);
  }
  if (positionals.length > 1) {
    throw new Error(`init config: only one path argument is allowed`);
  }

  return {
    project,
    projectStartDir: positionals[0],
  };
}

function parseRunOptions(args: readonly string[]): RunOptions {
  return {
    sampleName: readOptionalFlag(args, "--sample"),
    useLongFlags: args.includes("--long-flags"),
    explicitRepoPath: readFlagValue(args, "--repo"),
    configReplacement: readUniqueFlagValue(args, "--config"),
    configBaseLayers: readRepeatedFlagValues(args, "--config-base"),
    configOverrideLayers: readRepeatedFlagValues(args, "--config-override"),
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

function readUniqueFlagValue(args: readonly string[], flag: string): string | undefined {
  const values = readRepeatedFlagValues(args, flag);
  if (values.length === 0) return undefined;
  if (values.length > 1) {
    throw new Error(`${flag} may only be specified once`);
  }
  return values[0];
}

function readRepeatedFlagValues(args: readonly string[], flag: string): readonly string[] {
  const out: string[] = [];
  const inlinePrefix = `${flag}=`;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === flag) {
      const next = args[i + 1];
      if (next === undefined) {
        throw new Error(`${flag} requires a path argument`);
      }
      out.push(next);
      i++;
    } else if (arg.startsWith(inlinePrefix)) {
      out.push(arg.slice(inlinePrefix.length));
    }
  }

  return out;
}
