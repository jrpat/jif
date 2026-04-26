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