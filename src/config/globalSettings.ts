import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const GLOBAL_SETTINGS_DIR = join(homedir(), ".config", "jif", "settings");

export async function loadGlobalSetting(key: string): Promise<string> {
  try {
    return (await readFile(join(GLOBAL_SETTINGS_DIR, key), "utf8")).trim();
  } catch {
    return "";
  }
}

export async function saveGlobalSetting(key: string, value: string): Promise<void> {
  const path = join(GLOBAL_SETTINGS_DIR, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}
