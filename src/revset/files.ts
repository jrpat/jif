import { hasMatch, score } from "fzy.js";

export function formatFilesRevset(path: string): string {
  return `files(${JSON.stringify(path)})`;
}

export function isFilesOnlyRevset(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed.startsWith("files(")) {
    return false;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = "files".length; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index === trimmed.length - 1;
      }
      if (depth < 0) {
        return false;
      }
    }
  }

  return false;
}

export function matchFileSearchPaths(
  query: string,
  paths: readonly string[],
): readonly string[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return paths.slice();
  }

  const matches = paths
    .filter((path) => hasMatch(trimmed, path))
    .map((path) => ({ path, score: score(trimmed, path) }));

  matches.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.path.length - a.path.length;
  });

  return matches.map((match) => match.path).reverse();
}
