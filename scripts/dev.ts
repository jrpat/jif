// Dev launcher: run jif against the sample repo and restart it when source
// files change.
//
// This replaces `bun --watch`, which reload-loops with jif: the watcher
// re-triggers faster than the TUI can complete its (opentui 0.4.x) startup, so
// the screen is cleared on every restart and never stays painted. This launcher
// watches only `src/` and `index.ts` (never the runtime-writable tree), so jif's
// own startup activity can't trigger a restart, and it debounces real edits.
import { watch } from "node:fs";

const passthroughArgs = Bun.argv.slice(2);

let child: ReturnType<typeof Bun.spawn> | null = null;
let restarting = false;

function start(): void {
  child = Bun.spawn({
    cmd: ["bun", "run", "index.ts", "--sample", ...passthroughArgs],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
}

async function restart(): Promise<void> {
  if (restarting) return;
  restarting = true;
  if (child) {
    child.kill();
    await child.exited;
  }
  start();
  restarting = false;
}

let debounce: ReturnType<typeof setTimeout> | null = null;
function onChange(): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => void restart(), 150);
}

for (const path of ["src", "index.ts"]) {
  try {
    watch(path, { recursive: true }, onChange);
  } catch {
    // ignore paths that cannot be watched
  }
}

function shutdown(): void {
  child?.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
