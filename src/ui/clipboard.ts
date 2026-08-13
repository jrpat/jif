import { platform } from "node:os";

export type ClipboardWriteProcess = Readonly<{ exited: Promise<number> }>;
export type SpawnClipboardWriter = (
  command: readonly string[],
  text: string,
) => ClipboardWriteProcess;

type Env = Readonly<Record<string, string | undefined>>;

// The command that reads stdin and puts it on the system clipboard. macOS has
// `pbcopy`, Windows has `clip`, and Linux/BSD split by display server: Wayland
// sessions get `wl-copy`, X11 gets `xclip`.
export function clipboardCopyCommand(
  os: NodeJS.Platform = platform(),
  env: Env = process.env,
): readonly string[] {
  switch (os) {
    case "darwin":
      return ["pbcopy"];
    case "win32":
      return ["clip"];
    default:
      return env.WAYLAND_DISPLAY ? ["wl-copy"] : ["xclip", "-selection", "clipboard"];
  }
}

// The same command written as a shell pipeline fragment, for prefilling the
// shell command bar. No argument needs quoting, so a plain join is enough.
export function clipboardCopyCommandText(os?: NodeJS.Platform, env?: Env): string {
  return clipboardCopyCommand(os ?? platform(), env ?? process.env).join(" ");
}

// Put `text` on the system clipboard. The writer is spawned with the text as
// its stdin buffer and all other stdio ignored, so it never disturbs the TUI;
// a missing helper (e.g. no `xclip`) surfaces as a rejected promise.
export async function copyToClipboard(args: Readonly<{
  text: string;
  os?: NodeJS.Platform;
  env?: Env;
  spawn?: SpawnClipboardWriter;
}>): Promise<void> {
  const command = clipboardCopyCommand(args.os ?? platform(), args.env ?? process.env);
  const spawn = args.spawn ?? defaultSpawn;
  const exitCode = await spawn(command, args.text).exited;
  if (exitCode !== 0) {
    throw new Error(
      `Could not copy to the clipboard (\`${command.join(" ")}\` exited with code ${exitCode}).`,
    );
  }
}

function defaultSpawn(command: readonly string[], text: string): ClipboardWriteProcess {
  return Bun.spawn({
    cmd: [...command],
    stdin: new TextEncoder().encode(text),
    stdout: "ignore",
    stderr: "ignore",
  });
}
