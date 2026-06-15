export type ForceRetryCandidate = Readonly<{
  commandArgs: readonly string[];
  stderr: string;
}>;

export type ForceRetryPlan = Readonly<{
  ruleId: string;
  commandArgs: readonly string[];
}>;

type ForceRetryRule = Readonly<{
  id: string;
  matches: (candidate: ForceRetryCandidate) => boolean;
  rewrite: (commandArgs: readonly string[]) => readonly string[];
}>;

const FORCE_RETRY_RULES: readonly ForceRetryRule[] = [
  {
    id: "bookmark-backwards",
    matches: ({ stderr }) => /allow-backwards|move bookmark backwards or sideways/i.test(stderr),
    rewrite: (commandArgs) => appendUniqueFlag(commandArgs, "--allow-backwards"),
  },
  {
    id: "immutable",
    matches: ({ stderr }) => /ignore-immutable|immutable/i.test(stderr),
    rewrite: (commandArgs) => appendUniqueFlag(commandArgs, "--ignore-immutable"),
  },
  {
    id: "file-track-include-ignored",
    matches: ({ commandArgs, stderr }) =>
      isFileTrackCommand(commandArgs) && /refused to snapshot some files/i.test(stderr),
    rewrite: (commandArgs) => insertUniqueFlagAfterPrefix(commandArgs, "--include-ignored", 2),
  },
];

export function buildForceRetryPlan(
  candidate: ForceRetryCandidate,
): ForceRetryPlan | null {
  for (const rule of FORCE_RETRY_RULES) {
    if (!rule.matches(candidate)) {
      continue;
    }

    return {
      ruleId: rule.id,
      commandArgs: rule.rewrite(candidate.commandArgs),
    };
  }

  return null;
}

function appendUniqueFlag(commandArgs: readonly string[], flag: string): readonly string[] {
  if (commandArgs.includes(flag)) {
    return commandArgs;
  }

  return [...commandArgs, flag];
}

function insertUniqueFlagAfterPrefix(
  commandArgs: readonly string[],
  flag: string,
  prefixLength: number,
): readonly string[] {
  if (commandArgs.includes(flag)) {
    return commandArgs;
  }

  return [
    ...commandArgs.slice(0, prefixLength),
    flag,
    ...commandArgs.slice(prefixLength),
  ];
}

function isFileTrackCommand(commandArgs: readonly string[]): boolean {
  return commandArgs[0] === "file" && commandArgs[1] === "track";
}
