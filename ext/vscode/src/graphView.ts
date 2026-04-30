import path from "node:path";
import * as vscode from "vscode";
import * as nodePty from "node-pty";
import { resolveGraphLaunchTarget } from "./jifRuntime.ts";

export class JifGraphViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private view: vscode.WebviewView | null = null;
  private pty: nodePty.IPty | null = null;
  private terminalSize = { cols: 80, rows: 24 };
  private hasReceivedPtyData = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly repositoryRoot: string,
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
      `[graph] Spawning ${launchTarget.jifCommand} via ${launchTarget.command} ${launchTarget.args.join(" ")} (${launchTarget.source}) in ${this.repositoryRoot}.`,
    );

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

  private attachProcess(process: nodePty.IPty): void {
    this.pty = process;
    void this.view?.webview.postMessage({ type: "clear" });

    process.onData((data) => {
      if (!this.hasReceivedPtyData) {
        this.hasReceivedPtyData = true;
        this.outputChannel.appendLine("[graph] Received initial PTY output.");
        void this.view?.webview.postMessage({ type: "status", message: "" });
      }
      void this.view?.webview.postMessage({ type: "data", data });
    });
    process.onExit(({ exitCode }) => {
      this.outputChannel.appendLine(`[graph] PTY process exited with code ${exitCode}.`);
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
    <script nonce="${nonce}" src="${xtermJsUri}"></script>
    <script nonce="${nonce}" src="${fitAddonUri}"></script>
    <script nonce="${nonce}">
      const terminalAppearance = ${JSON.stringify(terminalAppearance)};
      const vscode = acquireVsCodeApi();
      const statusElement = document.getElementById('status');
      const terminalElement = document.getElementById('terminal');
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