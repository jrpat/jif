import { platform } from "node:os";

// The jif project's GitHub releases page, opened by the `open-releases` command.
export const JIF_RELEASES_URL = "https://github.com/jrpat/jif/releases";

export type UrlOpenProcess = Readonly<{ exited: Promise<number> }>;
export type SpawnUrlOpener = (command: readonly string[]) => UrlOpenProcess;

// The command that hands a URL to the system default browser. macOS has `open`,
// Windows has the `start` cmd builtin, and everything else gets `xdg-open`.
export function browserOpenCommand(
  url: string,
  os: NodeJS.Platform = platform(),
): readonly string[] {
  switch (os) {
    case "darwin":
      return ["open", url];
    case "win32":
      // `start` is a cmd builtin, not an executable, so it runs through cmd.
      // The empty "" is the window-title placeholder that keeps `start` from
      // mistaking a quoted URL for the title.
      return ["cmd", "/c", "start", "", url];
    default:
      return ["xdg-open", url];
  }
}

// Open a URL in the system default browser. The opener is spawned detached from
// the terminal (all stdio ignored) so it never disturbs the TUI; we still await
// its exit so a missing opener (e.g. no `xdg-open`) surfaces as an error toast.
export async function openUrl(args: Readonly<{
  url: string;
  os?: NodeJS.Platform;
  spawn?: SpawnUrlOpener;
}>): Promise<void> {
  const command = browserOpenCommand(args.url, args.os ?? platform());
  const spawn = args.spawn ?? defaultSpawn;
  const exitCode = await spawn(command).exited;
  if (exitCode !== 0) {
    throw new Error(`Could not open ${args.url} in a browser (exit code ${exitCode}).`);
  }
}

function defaultSpawn(command: readonly string[]): UrlOpenProcess {
  return Bun.spawn({
    cmd: [...command],
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
}
