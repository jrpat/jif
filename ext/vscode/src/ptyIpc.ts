// Buffered parser for private APC sequences emitted by the jif binary
// (`\x1b_jif-vscode:{json}\x1b\\`). Strips the matched bytes from the PTY
// output stream and forwards the remainder to xterm; emits the JSON payload
// for each completed sequence.

const APC_START = "\x1b_jif-vscode:";
const ST = "\x1b\\";

export class JifPtyIpc {
  private buffer = "";

  constructor(private readonly onMessage: (payload: unknown) => void) {}

  process(chunk: string): string {
    this.buffer += chunk;
    let out = "";

    while (true) {
      const start = this.buffer.indexOf(APC_START);
      if (start < 0) {
        const holdFrom = findHoldBackStart(this.buffer);
        out += this.buffer.slice(0, holdFrom);
        this.buffer = this.buffer.slice(holdFrom);
        return out;
      }

      out += this.buffer.slice(0, start);
      const bodyStart = start + APC_START.length;
      const end = this.buffer.indexOf(ST, bodyStart);
      if (end < 0) {
        this.buffer = this.buffer.slice(start);
        return out;
      }

      const body = this.buffer.slice(bodyStart, end);
      this.buffer = this.buffer.slice(end + ST.length);

      try {
        this.onMessage(JSON.parse(body));
      } catch {
        // Ignore malformed payloads.
      }
    }
  }
}

function findHoldBackStart(buffer: string): number {
  const maxKeep = Math.min(buffer.length, APC_START.length - 1);
  for (let keep = maxKeep; keep > 0; keep -= 1) {
    if (APC_START.startsWith(buffer.slice(buffer.length - keep))) {
      return buffer.length - keep;
    }
  }
  return buffer.length;
}
