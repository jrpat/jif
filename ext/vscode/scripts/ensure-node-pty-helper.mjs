import { chmodSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

if (process.platform === "win32") {
  process.exit(0);
}

const require = createRequire(import.meta.url);

let packageRoot;

try {
  packageRoot = path.dirname(require.resolve("node-pty/package.json"));
} catch (error) {
  console.warn(`[ensure-node-pty-helper] Unable to resolve node-pty: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(0);
}

const helperPath = path.join(packageRoot, "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper");

if (!existsSync(helperPath)) {
  process.exit(0);
}

const currentMode = statSync(helperPath).mode & 0o777;
const nextMode = currentMode | 0o755;

if (nextMode !== currentMode) {
  chmodSync(helperPath, nextMode);
  console.log(`[ensure-node-pty-helper] Updated ${helperPath} from ${currentMode.toString(8)} to ${nextMode.toString(8)}.`);
}