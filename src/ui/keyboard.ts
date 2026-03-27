const SHIFTED_SYMBOLS: Readonly<Record<string, string>> = {
  "`": "~",
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
  "-": "_",
  "=": "+",
  "[": "{",
  "]": "}",
  "\\": "|",
  ";": ":",
  "'": "\"",
  ",": "<",
  ".": ">",
  "/": "?",
};

export function normalizeKey(event: {
  name: string;
  sequence: string;
  shift?: boolean;
}): string | null {
  if (event.name === "return") {
    return "enter";
  }

  if (event.sequence.length === 1 && event.sequence >= " ") {
    if (event.shift && event.sequence === event.name) {
      return SHIFTED_SYMBOLS[event.name] ?? event.sequence;
    }

    return event.sequence;
  }

  if (event.shift && event.name.length === 1) {
    return SHIFTED_SYMBOLS[event.name] ?? event.name.toUpperCase();
  }

  return event.name || null;
}
