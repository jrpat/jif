import type { CompileTarget } from "../buildBinary.ts";

export type NormalizedTag = {
  tag: string;
  version: string;
  prerelease: boolean;
};

const VERSION_PATTERN =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export function normalizeTag(input: string): NormalizedTag {
  const trimmed = input.trim();
  const match = VERSION_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error(
      `Invalid version ${JSON.stringify(input)}: expected X.Y.Z or vX.Y.Z with an optional prerelease suffix like -beta.1`,
    );
  }

  const version = trimmed.replace(/^v/, "");
  return {
    tag: `v${version}`,
    version,
    prerelease: match[4] !== undefined,
  };
}

export function releaseAssetName(target: CompileTarget, tagOrVersion: string): string {
  const { tag } = normalizeTag(tagOrVersion);
  const platform = target.replace(/^bun-/, "");
  const extension = target.startsWith("bun-windows-") ? "zip" : "tar.gz";
  return `jif-${tag}-${platform}.${extension}`;
}

function runCli(args: readonly string[]): void {
  const [command, ...rest] = args;

  if (command === "normalize" && rest.length === 1) {
    const normalized = normalizeTag(rest[0]!);
    console.log(`tag=${normalized.tag}`);
    console.log(`version=${normalized.version}`);
    console.log(`prerelease=${normalized.prerelease}`);
    return;
  }

  if (command === "name" && rest.length === 2) {
    console.log(releaseAssetName(rest[0] as CompileTarget, rest[1]!));
    return;
  }

  console.error("Usage: bun run scripts/release/assets.ts normalize <version>");
  console.error("       bun run scripts/release/assets.ts name <compile-target> <tag>");
  process.exit(2);
}

if (import.meta.main) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
