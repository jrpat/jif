export type JjCommandAlias = Readonly<{
  name: string;
  expansion: readonly string[];
}>;

const CONFIG_NAME_PREFIX = "aliases.";
const NAME_VALUE_SEPARATOR = "\u001f";
const RECORD_SEPARATOR = "\u001e";

export const COMMAND_ALIAS_CONFIG_TEMPLATE =
  `name ++ "${NAME_VALUE_SEPARATOR}" ++ value ++ "${RECORD_SEPARATOR}"`;

export function parseCommandAliasConfigOutput(output: string): JjCommandAlias[] {
  const aliases: JjCommandAlias[] = [];
  for (const record of output.split(RECORD_SEPARATOR)) {
    if (record.trim().length === 0) continue;
    const separator = record.indexOf(NAME_VALUE_SEPARATOR);
    if (separator < 0) continue;

    const name = parseAliasConfigName(record.slice(0, separator).trim());
    if (!name) continue;

    const expansion = parseTomlStringArray(record.slice(separator + 1).trim());
    if (!expansion || expansion.length === 0 || isUnsupportedFirstToken(expansion[0]!)) continue;

    aliases.push({ name, expansion });
  }
  return aliases;
}

function isUnsupportedFirstToken(token: string): boolean {
  return token === "util" || token.startsWith("-");
}

function parseAliasConfigName(name: string): string | null {
  if (!name.startsWith(CONFIG_NAME_PREFIX)) return null;
  const raw = name.slice(CONFIG_NAME_PREFIX.length);
  if (raw.length === 0) return null;

  const parsed = raw.startsWith("\"") || raw.startsWith("'")
    ? parseTomlStringAt(raw, 0)
    : { value: raw, end: raw.length };
  if (!parsed || parsed.end !== raw.length) return null;
  if (parsed.value.length === 0 || /\s/.test(parsed.value)) return null;
  return parsed.value;
}

function parseTomlStringArray(value: string): string[] | null {
  let offset = skipWhitespace(value, 0);
  if (value[offset] !== "[") return null;
  offset++;

  const items: string[] = [];
  while (offset < value.length) {
    offset = skipWhitespace(value, offset);
    if (value[offset] === "]") {
      return items;
    }

    const parsed = parseTomlStringAt(value, offset);
    if (!parsed) return null;
    items.push(parsed.value);
    offset = skipWhitespace(value, parsed.end);

    if (value[offset] === ",") {
      offset++;
      continue;
    }
    if (value[offset] === "]") {
      return items;
    }
    return null;
  }

  return null;
}

function parseTomlStringAt(input: string, start: number): { value: string; end: number } | null {
  const quote = input[start];
  if (quote !== "\"" && quote !== "'") return null;
  const delimiter = quote.repeat(3);
  const multiline = input.slice(start, start + 3) === delimiter;
  return quote === "'"
    ? parseLiteralString(input, start, multiline)
    : parseBasicString(input, start, multiline);
}

function parseLiteralString(input: string, start: number, multiline: boolean) {
  const delimiter = multiline ? "'''" : "'";
  const bodyStart = start + delimiter.length;
  const end = input.indexOf(delimiter, bodyStart);
  if (end < 0) return null;
  return { value: input.slice(bodyStart, end), end: end + delimiter.length };
}

function parseBasicString(input: string, start: number, multiline: boolean) {
  const delimiter = multiline ? "\"\"\"" : "\"";
  let offset = start + delimiter.length;
  let value = "";

  while (offset < input.length) {
    if (input.slice(offset, offset + delimiter.length) === delimiter) {
      return { value, end: offset + delimiter.length };
    }

    const char = input[offset]!;
    if (char !== "\\") {
      value += char;
      offset++;
      continue;
    }

    const escaped = parseBasicStringEscape(input, offset + 1);
    if (!escaped) return null;
    value += escaped.value;
    offset = escaped.end;
  }

  return null;
}

function parseBasicStringEscape(input: string, offset: number): { value: string; end: number } | null {
  const char = input[offset];
  switch (char) {
    case "b": return { value: "\b", end: offset + 1 };
    case "t": return { value: "\t", end: offset + 1 };
    case "n": return { value: "\n", end: offset + 1 };
    case "f": return { value: "\f", end: offset + 1 };
    case "r": return { value: "\r", end: offset + 1 };
    case "\"": return { value: "\"", end: offset + 1 };
    case "\\": return { value: "\\", end: offset + 1 };
    case "u": return parseUnicodeEscape(input, offset + 1, 4);
    case "U": return parseUnicodeEscape(input, offset + 1, 8);
    default: return null;
  }
}

function parseUnicodeEscape(input: string, offset: number, length: number): { value: string; end: number } | null {
  const hex = input.slice(offset, offset + length);
  if (!new RegExp(`^[0-9A-Fa-f]{${length}}$`).test(hex)) return null;
  const codePoint = Number.parseInt(hex, 16);
  try {
    return { value: String.fromCodePoint(codePoint), end: offset + length };
  } catch {
    return null;
  }
}

function skipWhitespace(input: string, offset: number): number {
  while (offset < input.length && /\s/.test(input[offset]!)) {
    offset++;
  }
  return offset;
}
