import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";

export async function createTempDir(prefix: string): Promise<string> {
  return await mkdtemp(join(process.cwd(), `.tmp/${prefix}-`));
}
