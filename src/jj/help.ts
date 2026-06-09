// Parser for jj's compact `-h` help output (jj 0.42.0). We use the compact
// form (not `--help`) because its single-line, column-aligned layout is far
// easier to parse reliably than the multi-paragraph long form.
//
// The parser anchors on documented structure rather than exact text:
//   * the `Usage:` line (whether it ends in a COMMAND token => a group),
//   * section headers (`Commands:`, `Arguments:`, `Options:`, ... `Options:`),
//   * clap's two-space gap between an entry and its description.
// New flags/commands therefore appear automatically. The single fragile
// assumption is the group-vs-leaf COMMAND heuristic, which is cross-checked
// against the presence of a Commands section. On any failure the parser
// returns an empty model so callers fall back to history-only completion.

export type JjHelpFlag = Readonly<{
  short?: string; // "-r"
  long: string; // "--revision"
  valueToken?: string; // "REVSETS" (inner text of <...>); undefined => boolean flag
  possibleValues?: readonly string[]; // from "[possible values: a, b, c]"
  description: string;
}>;

export type JjHelpSubcommand = Readonly<{
  name: string;
  aliases: readonly string[];
  description: string;
}>;

export type JjHelpPositional = Readonly<{
  token: string; // inner text of <TOKEN>/[TOKEN]
  optional: boolean; // [TOKEN] => true, <TOKEN> => false
  variadic: boolean; // trailing "..."
  description: string;
}>;

export type JjHelp = Readonly<{
  kind: "group" | "leaf";
  hasSubcommands: boolean;
  subcommands: readonly JjHelpSubcommand[];
  flags: readonly JjHelpFlag[];
  positionals: readonly JjHelpPositional[];
}>;

const EMPTY_HELP: JjHelp = {
  kind: "leaf",
  hasSubcommands: false,
  subcommands: [],
  flags: [],
  positionals: [],
};

type Section = "none" | "commands" | "arguments" | "options" | "ignored";

// `  -r, --revision <REVSETS>   Which revisions to show`
// `      --reversed             Show revisions ...`
const FLAG_LINE =
  /^\s*(?:(-[A-Za-z0-9]),\s+)?(--[A-Za-z0-9][A-Za-z0-9-]*)(?:[ =](<[^>]+>|\[[^\]]+\]))?\s{2,}(.*)$/;
// `  abandon           Abandon a revision`
const COMMAND_LINE = /^ {2}(\S+)\s{2,}(.+)$/;
// `  [FILESETS]...  Show ...`  /  `  <NAMES>...  The ...`
const POSITIONAL_LINE = /^ {2}(<[^>]+>|\[[^\]]+\])(\.\.\.)?\s{2,}(.+)$/;
const SECTION_HEADER = /^([A-Za-z][A-Za-z ]*):\s*$/;
const USAGE_LINE = /^Usage:\s+jj\b/;

const ANNOTATION = /\s*\[(?:possible values|aliases|default alias|default):[^\]]*\]/g;

function extractList(description: string, label: string): string[] {
  const match = description.match(new RegExp(`\\[${label}:\\s*([^\\]]+)\\]`));
  if (!match) return [];
  return match[1]!
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function cleanDescription(description: string): string {
  return description.replace(ANNOTATION, "").trim();
}

export function parseJjHelp(text: string): JjHelp {
  try {
    return parse(text);
  } catch {
    return EMPTY_HELP;
  }
}

function parse(text: string): JjHelp {
  const lines = text.split("\n");

  let usageHasCommand = false;
  let section: Section = "none";

  const subcommands: JjHelpSubcommand[] = [];
  const flags: JjHelpFlag[] = [];
  const positionals: JjHelpPositional[] = [];
  // The raw description string for the entry a continuation line should extend.
  let lastDescriptionTarget: { append: (text: string) => void } | null = null;

  for (const line of lines) {
    if (USAGE_LINE.test(line)) {
      usageHasCommand = /(?:<COMMAND>|\[COMMAND\])\s*$/.test(line);
      section = "none";
      lastDescriptionTarget = null;
      continue;
    }

    const header = line.match(SECTION_HEADER);
    if (header) {
      const name = header[1]!;
      if (name === "Commands") section = "commands";
      else if (name === "Arguments") section = "arguments";
      else if (/Options$/.test(name)) section = "options";
      else section = "ignored";
      lastDescriptionTarget = null;
      continue;
    }

    if (line.trim().length === 0) {
      // Blank lines never break an entry inside a section in compact help, but
      // there are none mid-entry; clearing the continuation target is safe.
      lastDescriptionTarget = null;
      continue;
    }

    if (section === "options") {
      const match = line.match(FLAG_LINE);
      if (match) {
        const [, short, long, rawValue, rawDescription] = match;
        const entry = {
          short: short ?? undefined,
          long: long!,
          valueToken: rawValue ? stripBrackets(rawValue) : undefined,
          rawDescription: rawDescription ?? "",
        };
        const index = flags.length;
        flags.push({
          short: entry.short,
          long: entry.long,
          valueToken: entry.valueToken,
          description: "",
        });
        lastDescriptionTarget = {
          append: (text) => {
            const current = flags[index]!;
            const joined = current.description
              ? `${current.description} ${text}`
              : text;
            const possibleValues = extractList(joined, "possible values");
            flags[index] = {
              ...current,
              description: cleanDescription(joined),
              possibleValues: possibleValues.length > 0 ? possibleValues : undefined,
            };
          },
        };
        lastDescriptionTarget.append(entry.rawDescription);
      } else if (lastDescriptionTarget) {
        lastDescriptionTarget.append(line.trim());
      }
      continue;
    }

    if (section === "commands") {
      const match = line.match(COMMAND_LINE);
      if (match) {
        const [, name, rawDescription] = match;
        const index = subcommands.length;
        subcommands.push({ name: name!, aliases: [], description: "" });
        lastDescriptionTarget = {
          append: (text) => {
            const current = subcommands[index]!;
            const joined = current.description
              ? `${current.description} ${text}`
              : text;
            const aliases = [
              ...extractList(joined, "aliases"),
              ...extractList(joined, "default alias"),
            ];
            subcommands[index] = {
              name: current.name,
              aliases,
              description: cleanDescription(joined),
            };
          },
        };
        lastDescriptionTarget.append(rawDescription ?? "");
      } else if (lastDescriptionTarget) {
        lastDescriptionTarget.append(line.trim());
      }
      continue;
    }

    if (section === "arguments") {
      const match = line.match(POSITIONAL_LINE);
      if (match) {
        const [, rawToken, variadic, rawDescription] = match;
        const optional = rawToken!.startsWith("[");
        const index = positionals.length;
        positionals.push({
          token: stripBrackets(rawToken!),
          optional,
          variadic: variadic === "...",
          description: "",
        });
        lastDescriptionTarget = {
          append: (text) => {
            const current = positionals[index]!;
            const joined = current.description
              ? `${current.description} ${text}`
              : text;
            positionals[index] = { ...current, description: cleanDescription(joined) };
          },
        };
        lastDescriptionTarget.append(rawDescription ?? "");
      } else if (lastDescriptionTarget) {
        lastDescriptionTarget.append(line.trim());
      }
      continue;
    }
  }

  const hasSubcommands = usageHasCommand || subcommands.length > 0;

  if (subcommands.length === 0 && flags.length === 0 && positionals.length === 0) {
    return EMPTY_HELP;
  }

  return {
    kind: hasSubcommands ? "group" : "leaf",
    hasSubcommands,
    subcommands,
    flags,
    positionals,
  };
}

function stripBrackets(token: string): string {
  return token.replace(/^[<\[]/, "").replace(/[>\]]$/, "");
}
