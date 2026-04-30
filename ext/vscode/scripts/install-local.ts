import { mkdir, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

const extensionRoot = resolve(import.meta.dir, "..");
const extensionsDir = resolve(process.env.VSCODE_EXTENSIONS_DIR?.trim() || defaultExtensionsDir());
const installPath = resolve(extensionsDir, "local.jif-vscode");

await mkdir(extensionsDir, { recursive: true });
await rm(installPath, { recursive: true, force: true });
await symlink(extensionRoot, installPath, process.platform === "win32" ? "junction" : "dir");

console.log(`Installed local.jif-vscode -> ${extensionRoot}`);
console.log(`VS Code extensions dir: ${extensionsDir}`);
console.log("Reload VS Code to pick up the updated extension.");

function defaultExtensionsDir(): string {
  return resolve(homedir(), ".vscode", "extensions");
}