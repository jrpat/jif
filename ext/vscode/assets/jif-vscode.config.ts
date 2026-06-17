// Loaded by the bundled jif binary as a `--config-override` layer when launched
// from inside the VS Code extension. Custom commands here emit private APC
// sequences (`\x1b_jif-vscode:{json}\x1b\\`) on stdout; the extension's PTY
// data handler intercepts them and dispatches the corresponding VS Code
// commands.

// OpenTUI replaces process.stdout.write with a capture wrapper once the
// renderer starts, so we bypass it by writing to fd 1 directly via fs.
import { writeSync } from "node:fs";

const writeIpc = (payload: object): void => {
  writeSync(1, `\x1b_jif-vscode:${JSON.stringify(payload)}\x1b\\`);
};

const config = {
  keymap: {
    _global: {
      q: {
        id: "vscode-noop-quit",
        title: "Quit (disabled in VS Code)",
        description: "Quitting is disabled when jif runs inside the VS Code extension.",
        run: () => {},
      },
    },
    normal: {
      d: {
        id: "vscode-open-revision-diff",
        title: "Open revision diff in VS Code",
        description: "Open the focused revision's diff in the VS Code editor.",
        // `state.rev`/`state.file` are now plain strings; the structured
        // objects (with revisionId/marker/path) live under focusedRevision /
        // focusedFile.
        canExecute: (state: any) =>
          state.focusedRevision !== null && state.focusedRevision.marker !== "elided",
        run: (_controller: unknown, state: any) => {
          if (!state.focusedRevision) return;
          writeIpc({ kind: "diff-revision", revisionId: state.focusedRevision.revisionId });
        },
      },
    },
    files: {
      d: {
        id: "vscode-open-file-diff",
        title: "Open file diff in VS Code",
        description: "Open the focused file's diff in the VS Code editor.",
        canExecute: (state: any) =>
          state.focusedRevision !== null && state.focusedFile !== null,
        run: (_controller: unknown, state: any) => {
          if (!state.focusedRevision || !state.focusedFile) return;
          writeIpc({
            kind: "diff-file",
            revisionId: state.focusedRevision.revisionId,
            path: state.focusedFile.path,
          });
        },
      },
    },
  },
};

export default config;
