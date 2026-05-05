import path from "node:path";
import * as vscode from "vscode";
import * as nodePty from "node-pty";
import type { JjRepository } from "@jif/jj-core";
import { resolveGraphLaunchTarget } from "./jifRuntime.ts";
import { createRevisionUri } from "./jjDocumentProvider.ts";
import { JifPtyIpc } from "./ptyIpc.ts";
import { buildDiffEntries } from "./scmProvider.ts";

const FOCUS_BLINK_INTERVAL_MS = 1000 / 8;
const FOCUS_BLINK_COUNT = 2;

export class JifGraphViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private view: vscode.WebviewView | null = null;
  private pty: nodePty.IPty | null = null;
  private terminalSize = { cols: 80, rows: 24 };
  private hasReceivedPtyData = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly repositoryRoot: string,
    private readonly repository: JjRepository,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

  register(): vscode.Disposable {
    return vscode.window.registerWebviewViewProvider("jifGraph", this, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    });
  }

  async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this.view = webviewView;
    this.view.title = `Graph (${path.basename(this.repositoryRoot)})`;
    this.outputChannel.appendLine("[graph] Resolving graph webview.");

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.renderHtml(webviewView.webview);

    const receiveMessage = webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
      if (!isGraphMessage(message)) {
        return;
      }

      switch (message.type) {
        case "ready":
          this.outputChannel.appendLine("[graph] Webview reported ready.");
          this.startPty();
          break;
        case "input":
          this.pty?.write(message.data);
          break;
        case "resize":
          this.terminalSize = {
            cols: Math.max(2, message.cols),
            rows: Math.max(2, message.rows),
          };
          this.pty?.resize(this.terminalSize.cols, this.terminalSize.rows);
          break;
        case "webview-log":
          this.outputChannel.appendLine(`[graph] ${message.message}`);
          break;
        case "webview-error":
          this.outputChannel.appendLine(`[graph] Webview error: ${message.message}`);
          break;
      }
    });
    this.disposables.push(receiveMessage);

    const visibilityListener = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && !this.pty) {
        this.startPty();
      }
    });
    this.disposables.push(visibilityListener);

    const disposeListener = webviewView.onDidDispose(() => {
      this.stopPty();
      this.view = null;
    });
    this.disposables.push(disposeListener);
  }

  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }

    this.stopPty();
    this.startPty();
  }

  blink(): void {
    void this.view?.webview.postMessage({ type: "blink" });
  }

  notifyTerminalFocus(): void {
    this.pty?.write("\x1b[I");
  }

  dispose(): void {
    this.stopPty();
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private startPty(): void {
    if (!this.view || this.pty) {
      return;
    }

    this.hasReceivedPtyData = false;
    void this.view.webview.postMessage({ type: "status", message: "Starting jif..." });
    const launchTarget = resolveGraphLaunchTarget({
      extensionRoot: this.extensionUri.fsPath,
      shellPath: process.env.SHELL,
    });
    this.outputChannel.appendLine(
      `[graph] Extension root: ${this.extensionUri.fsPath}`,
    );
    this.outputChannel.appendLine(
      `[graph] Spawning ${launchTarget.jifCommand} via ${launchTarget.command} ${launchTarget.args.join(" ")} (${launchTarget.source}) in ${this.repositoryRoot}.`,
    );
    if (launchTarget.configOverridePath) {
      this.outputChannel.appendLine(
        `[graph] Using config override at ${launchTarget.configOverridePath}.`,
      );
    } else {
      this.outputChannel.appendLine(
        `[graph] No VS Code config override found; q/d will use default bindings.`,
      );
    }

    try {
      const pty = this.spawnPty(launchTarget);
      this.attachProcess(pty);
    } catch (error) {
      this.reportStartError(error);
    }
  }

  private spawnPty(launchSpec: PtyLaunchSpec): nodePty.IPty {
    return nodePty.spawn(launchSpec.command, launchSpec.args, {
      name: "xterm-256color",
      cwd: this.repositoryRoot,
      cols: this.terminalSize.cols,
      rows: this.terminalSize.rows,
      env: { ...process.env },
    });
  }

  private attachProcess(pty: nodePty.IPty): void {
    this.pty = pty;
    void this.view?.webview.postMessage({ type: "clear" });

    let chunkCount = 0;
    const ipc = new JifPtyIpc((payload) => this.handleIpcMessage(payload));
    pty.onData((data) => {
      if (this.pty !== pty) {
        return;
      }
      if (!this.hasReceivedPtyData) {
        this.hasReceivedPtyData = true;
        this.outputChannel.appendLine(`[graph] Received initial PTY output (${data.length} bytes).`);
        void this.view?.webview.postMessage({ type: "status", message: "" });
      }
      chunkCount += 1;
      const containsApc = data.includes("\x1b_jif-vscode:");
      if (containsApc) {
        this.outputChannel.appendLine(
          `[graph] PTY chunk #${chunkCount} contains an APC marker (${data.length} bytes).`,
        );
      }
      const forwarded = ipc.process(data);
      if (forwarded.length > 0) {
        void this.view?.webview.postMessage({ type: "data", data: forwarded });
      }
    });
    pty.onExit(({ exitCode }) => {
      this.outputChannel.appendLine(`[graph] PTY process exited with code ${exitCode}.`);
      if (this.pty !== pty) {
        return;
      }
      void this.view?.webview.postMessage({ type: "exit", code: exitCode });
      if (!this.hasReceivedPtyData) {
        void this.view?.webview.postMessage({ type: "status", message: `jif exited before rendering anything (${exitCode}).` });
      }
      this.pty = null;
    });
  }

  private reportStartError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(`[graph] Unable to start jif: ${message}`);
    void this.view?.webview.postMessage({
      type: "error",
      message: `Unable to start jif: ${message}`,
    });
    void this.view?.webview.postMessage({ type: "status", message: `Unable to start jif: ${message}` });
  }

  private stopPty(): void {
    this.pty?.kill();
    this.pty = null;
  }

  private handleIpcMessage(payload: unknown): void {
    if (!isIpcMessage(payload)) {
      this.outputChannel.appendLine(`[graph] Ignoring unknown IPC payload: ${JSON.stringify(payload)}`);
      return;
    }

    this.outputChannel.appendLine(`[graph] IPC ${payload.kind}: ${JSON.stringify(payload)}`);

    if (payload.kind === "debug") {
      return;
    }

    if (payload.kind === "diff-file") {
      void this.openFileDiff(payload.revisionId, payload.path);
      return;
    }

    if (payload.kind === "diff-revision") {
      void this.openRevisionDiff(payload.revisionId);
      return;
    }
  }

  private async openFileDiff(revisionId: string, filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(this.repositoryRoot, filePath);
    const original = createRevisionUri(absolutePath, `${revisionId}-`);
    const modified = createRevisionUri(absolutePath, revisionId);
    const title = `${path.relative(this.repositoryRoot, absolutePath)} (${shortRevisionId(revisionId)})`;
    try {
      await vscode.commands.executeCommand("vscode.diff", original, modified, title);
    } catch (error) {
      this.reportIpcError("vscode.diff", error);
    }
  }

  private async openRevisionDiff(revisionId: string): Promise<void> {
    let result;
    try {
      result = await this.repository.show(revisionId);
    } catch (error) {
      this.reportIpcError(`jj show -r ${revisionId}`, error);
      return;
    }

    if (result.fileStatuses.length === 0) {
      void vscode.window.showInformationMessage(`Revision ${shortRevisionId(revisionId)} has no file changes.`);
      return;
    }

    const entries = buildDiffEntries(result.fileStatuses, {
      baseRevset: `${revisionId}-`,
      targetRevset: revisionId,
    });
    const label = `Revision ${shortRevisionId(revisionId)}`;
    try {
      await vscode.commands.executeCommand("vscode.changes", label, entries);
    } catch (error) {
      this.reportIpcError("vscode.changes", error);
    }
  }

  private reportIpcError(action: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(`[graph] ${action} failed: ${message}`);
  }

  private renderHtml(webview: vscode.Webview): string {
    const nonce = createNonce();
    const terminalAppearance = getTerminalAppearance();
    const xtermCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.extensionUri.fsPath, "node_modules", "xterm", "css", "xterm.css")));
    const xtermJsUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.extensionUri.fsPath, "node_modules", "xterm", "lib", "xterm.js")));
    const fitAddonUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.extensionUri.fsPath, "node_modules", "@xterm", "addon-fit", "lib", "addon-fit.js")));

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; font-src ${webview.cspSource};" />
    <link rel="stylesheet" href="${xtermCssUri}" />
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: var(--vscode-sideBar-background);
      }

      body {
        font-family: var(--vscode-editor-font-family);
        position: relative;
      }

      #terminal {
        position: absolute;
        inset: 0;
        padding-left: 0.5ch;
        box-sizing: border-box;
        overflow: hidden;
      }

      #focus-blink {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 2;
        box-shadow: inset 0 0 0 2px var(--vscode-focusBorder, #007fd4);
        opacity: 0;
      }

      #focus-blink.on {
        opacity: 1;
      }

      .xterm {
        box-sizing: border-box;
      }

      #status {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        box-sizing: border-box;
        color: var(--vscode-descriptionForeground);
        text-align: center;
        white-space: pre-wrap;
        z-index: 1;
        pointer-events: none;
      }

      #status[hidden] {
        display: none;
      }
    </style>
  </head>
  <body>
    <div id="status">Loading Jif graph...</div>
    <div id="terminal"></div>
    <div id="focus-blink"></div>
    <script nonce="${nonce}" src="${xtermJsUri}"></script>
    <script nonce="${nonce}" src="${fitAddonUri}"></script>
    <script nonce="${nonce}">
      const terminalAppearance = ${JSON.stringify(terminalAppearance)};
      const focusBlinkIntervalMs = ${FOCUS_BLINK_INTERVAL_MS};
      const focusBlinkCount = ${FOCUS_BLINK_COUNT};
      const vscode = acquireVsCodeApi();
      const statusElement = document.getElementById('status');
      const terminalElement = document.getElementById('terminal');
      const blinkElement = document.getElementById('focus-blink');
      let blinkTimers = [];
      const runBlink = () => {
        for (const id of blinkTimers) {
          clearTimeout(id);
        }
        blinkTimers = [];
        blinkElement.classList.remove('on');
        const totalSteps = focusBlinkCount * 2;
        for (let step = 0; step < totalSteps; step += 1) {
          const on = step % 2 === 0;
          const id = setTimeout(() => {
            blinkElement.classList.toggle('on', on);
          }, step * focusBlinkIntervalMs);
          blinkTimers.push(id);
        }
      };
      const setStatus = (message) => {
        statusElement.textContent = message;
        statusElement.hidden = !message;
      };
      const readThemeColor = (...names) => {
        const styles = getComputedStyle(document.body);
        for (const name of names) {
          const value = styles.getPropertyValue(name).trim();
          if (value) {
            return value;
          }
        }

        return undefined;
      };
      const postLog = (message) => {
        vscode.postMessage({ type: 'webview-log', message });
      };
      const postError = (message) => {
        setStatus(message);
        vscode.postMessage({ type: 'webview-error', message });
      };

      window.addEventListener('error', (event) => {
        postError(event.error && event.error.stack ? event.error.stack : event.message || 'Unknown webview error');
      });
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        if (reason && typeof reason === 'object' && 'stack' in reason && typeof reason.stack === 'string') {
          postError(reason.stack);
          return;
        }

        postError(String(reason));
      });

      try {
        const terminal = new Terminal({
          convertEol: true,
          cursorBlink: true,
          cursorStyle: 'block',
          fontFamily: terminalAppearance.fontFamily,
          fontSize: terminalAppearance.fontSize,
          theme: {
            background: readThemeColor('--vscode-sideBar-background', '--vscode-terminal-background'),
            foreground: readThemeColor('--vscode-terminal-foreground', '--vscode-editor-foreground'),
            cursor: readThemeColor('--vscode-terminalCursor-foreground', '--vscode-editorCursor-foreground', '--vscode-terminal-foreground', '--vscode-editor-foreground'),
            cursorAccent: readThemeColor('--vscode-terminalCursor-background', '--vscode-sideBar-background'),
          },
        });
        const fitAddon = new FitAddon.FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(terminalElement);

        const fit = () => {
          fitAddon.fit();
          vscode.postMessage({ type: 'resize', cols: terminal.cols, rows: terminal.rows });
        };

        terminal.onData((data) => {
          vscode.postMessage({ type: 'input', data });
        });

        terminalElement.addEventListener('pointerdown', () => {
          terminal.focus();
        });
        window.addEventListener('focus', () => {
          terminal.focus();
        });
        window.addEventListener('resize', fit);
        window.addEventListener('message', (event) => {
          const message = event.data;
          if (!message || typeof message.type !== 'string') {
            return;
          }

          if (message.type === 'status') {
            setStatus(message.message || '');
            return;
          }

          if (message.type === 'clear') {
            terminal.clear();
            return;
          }

          if (message.type === 'data') {
            terminal.write(message.data);
            return;
          }

          if (message.type === 'exit') {
            terminal.writeln('\\r\\n[process exited ' + message.code + ']');
            return;
          }

          if (message.type === 'error') {
            terminal.writeln('\\r\\n' + message.message);
            return;
          }

          if (message.type === 'blink') {
            runBlink();
          }
        });

        setStatus('Booting terminal...');
        fit();
        terminal.focus();
        postLog('Terminal bootstrap completed.');
        vscode.postMessage({ type: 'ready' });
      } catch (error) {
        postError(error && error.stack ? error.stack : String(error));
      }
    </script>
  </body>
</html>`;
  }
}

function createNonce(length = 32): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  for (let index = 0; index < length; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return nonce;
}

type PtyLaunchSpec = {
  command: string;
  args: string[];
};

function getTerminalAppearance(): { fontFamily: string | undefined; fontSize: number | undefined } {
  const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
  const editorConfig = vscode.workspace.getConfiguration("editor");
  const terminalFontFamily = terminalConfig.get<string>("fontFamily")?.trim();
  const editorFontFamily = editorConfig.get<string>("fontFamily")?.trim();
  const configuredFontSize = terminalConfig.get<number>("fontSize");

  return {
    fontFamily: terminalFontFamily || editorFontFamily || undefined,
    fontSize: typeof configuredFontSize === "number" && configuredFontSize > 0 ? configuredFontSize : undefined,
  };
}

function isGraphMessage(
  message: unknown,
): message is
  | { type: "ready" }
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "webview-log"; message: string }
  | { type: "webview-error"; message: string } {
  if (!message || typeof message !== "object") {
    return false;
  }

  const record = message as Record<string, unknown>;
  if (record.type === "ready") {
    return true;
  }
  if (record.type === "input" && typeof record.data === "string") {
    return true;
  }
  if ((record.type === "webview-log" || record.type === "webview-error") && typeof record.message === "string") {
    return true;
  }
  return record.type === "resize" && typeof record.cols === "number" && typeof record.rows === "number";
}

type IpcMessage =
  | { kind: "diff-revision"; revisionId: string }
  | { kind: "diff-file"; revisionId: string; path: string }
  | { kind: "debug"; message: string; data?: unknown };

function isIpcMessage(payload: unknown): payload is IpcMessage {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const record = payload as Record<string, unknown>;
  if (record.kind === "diff-revision" && typeof record.revisionId === "string") {
    return true;
  }
  if (record.kind === "debug" && typeof record.message === "string") {
    return true;
  }
  return (
    record.kind === "diff-file" &&
    typeof record.revisionId === "string" &&
    typeof record.path === "string"
  );
}

function shortRevisionId(revisionId: string): string {
  return revisionId.length > 8 ? revisionId.slice(0, 8) : revisionId;
}