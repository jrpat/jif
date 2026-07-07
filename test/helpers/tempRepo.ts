import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";

export async function createTempDir(prefix: string): Promise<string> {
  const tmpRoot = join(process.cwd(), ".tmp");
  await mkdir(tmpRoot, { recursive: true });
  return await mkdtemp(join(tmpRoot, `${prefix}-`));
}
