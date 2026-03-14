import type { ResolvedThemeMode } from "./schema.ts";

type ReadableTtyLike = NodeJS.ReadableStream & {
  isTTY?: boolean;
  isRaw?: boolean;
  isPaused?: () => boolean;
  pause?: () => void;
  resume?: () => void;
  setRawMode?: (mode: boolean) => void;
};

type WritableTtyLike = NodeJS.WritableStream & {
  isTTY?: boolean;
};

type RgbColor = Readonly<{
  r: number;
  g: number;
  b: number;
}>;

const OSC11_QUERY = "\u001b]11;?\u0007";
const OSC11_RESPONSE_PATTERN =
  /\u001b\]11;rgb:([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})(?:\u0007|\u001b\\)/;

export async function detectTerminalThemeMode(options: Readonly<{
  env?: NodeJS.ProcessEnv;
  stdin?: ReadableTtyLike;
  stdout?: WritableTtyLike;
  timeoutMs?: number;
}> = {}): Promise<ResolvedThemeMode | null> {
  const background = await queryTerminalBackground(options);
  if (background !== null) {
    return inferThemeModeFromRgb(background);
  }

  return detectThemeModeFromColorFgbg(options.env ?? process.env);
}

export function inferThemeModeFromRgb(color: RgbColor): ResolvedThemeMode {
  const brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
  return brightness >= 128 ? "light" : "dark";
}

export function parseOsc11Response(response: string): RgbColor | null {
  const match = OSC11_RESPONSE_PATTERN.exec(response);
  if (!match) {
    return null;
  }

  const [, rawR, rawG, rawB] = match;
  if (rawR === undefined || rawG === undefined || rawB === undefined) {
    return null;
  }

  return {
    r: normalizeHexChannel(rawR),
    g: normalizeHexChannel(rawG),
    b: normalizeHexChannel(rawB),
  };
}

export function detectThemeModeFromColorFgbg(
  env: NodeJS.ProcessEnv,
): ResolvedThemeMode | null {
  const value = env.COLORFGBG;
  if (!value) {
    return null;
  }

  const parts = value
    .split(/[;:]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const backgroundIndex = Number.parseInt(parts.at(-1) ?? "", 10);
  if (!Number.isInteger(backgroundIndex) || backgroundIndex < 0) {
    return null;
  }

  return inferThemeModeFromAnsiIndex(backgroundIndex);
}

export async function queryTerminalBackground(
  options: Readonly<{
    stdin?: ReadableTtyLike;
    stdout?: WritableTtyLike;
    timeoutMs?: number;
  }> = {},
): Promise<RgbColor | null> {
  const stdin = options.stdin ?? (process.stdin as ReadableTtyLike);
  const stdout = options.stdout ?? (process.stdout as WritableTtyLike);
  const timeoutMs = options.timeoutMs ?? 120;

  if (stdin.isTTY !== true || stdout.isTTY !== true) {
    return null;
  }

  const wasRaw = stdin.isRaw === true;
  const wasPaused = stdin.isPaused?.() ?? false;

  return new Promise<RgbColor | null>((resolve) => {
    let settled = false;
    let buffer = "";

    const cleanup = (result: RgbColor | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      stdin.off?.("data", onData);
      stdin.off?.("error", onError);
      if (!wasRaw) {
        stdin.setRawMode?.(false);
      }
      if (wasPaused) {
        stdin.pause?.();
      }
      resolve(result);
    };

    const onData = (chunk: string | Buffer) => {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const parsed = parseOsc11Response(buffer);
      if (parsed !== null) {
        cleanup(parsed);
      }
    };

    const onError = () => {
      cleanup(null);
    };

    const timer = setTimeout(() => {
      cleanup(null);
    }, timeoutMs);

    stdin.on("data", onData);
    stdin.on("error", onError);
    if (!wasRaw) {
      stdin.setRawMode?.(true);
    }
    stdin.resume?.();
    stdout.write(OSC11_QUERY);
  });
}

function normalizeHexChannel(hex: string): number {
  const value = Number.parseInt(hex, 16);
  const maxValue = 16 ** hex.length - 1;
  if (!Number.isFinite(value) || maxValue <= 0) {
    return 0;
  }

  return Math.round((value / maxValue) * 255);
}

function inferThemeModeFromAnsiIndex(index: number): ResolvedThemeMode {
  const ansiBrightness = [
    0,
    95,
    95,
    175,
    95,
    135,
    175,
    230,
    127,
    255,
    255,
    255,
    128,
    255,
    255,
    255,
  ];
  const normalizedIndex = index % ansiBrightness.length;
  const brightness = ansiBrightness[normalizedIndex] ?? 0;
  return brightness >= 128 ? "light" : "dark";
}
