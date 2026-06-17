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

export type KeyToken = {
  name: string;
  sequence: string;
  shift?: boolean;
  ctrl?: boolean;
  option?: boolean;
  meta?: boolean;
  eventType?: string;
};

/**
 * Translate a raw OpenTUI key event into the `alt-`/`ctrl-` prefixed token used
 * by the keymap, or `null` when the event should be ignored.
 *
 * OpenTUI reports Alt/Option keypresses with BOTH `option` and `meta` set, so a
 * naive `if (meta) ignore` swallows every Alt binding. We only discard a true
 * Meta/Command combo: `meta` set WITHOUT `option`.
 */
export function resolveKeyToken(event: KeyToken): string | null {
  if (event.eventType === "release" || (event.meta && !event.option)) {
    return null;
  }

  const altPrefix = event.option ? "alt-" : "";
  const ctrlPrefix = event.ctrl ? "ctrl-" : "";
  let baseKey: string | null;
  if (event.ctrl || event.option) {
    baseKey = event.name === "return" ? "enter" : event.name;
  } else {
    baseKey = normalizeKey(event);
  }

  return baseKey === null ? null : `${altPrefix}${ctrlPrefix}${baseKey}`;
}
