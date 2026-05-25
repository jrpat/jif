import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type RunInteractiveProcess = (cwd: string, command: readonly string[]) => Promise<void>;

export async function openTextInEditor(args: Readonly<{
  text: string;
  runInteractive: RunInteractiveProcess;
  filename?: string;
  env?: NodeJS.ProcessEnv;
  mkdtempDir?: (prefix: string) => Promise<string>;
  writeFileImpl?: (path: string, data: string) => Promise<void>;
  cleanup?: (dir: string) => Promise<void>;
}>): Promise<void> {
  const env = args.env ?? process.env;
  const editorCommand = (env.EDITOR ?? "vi").trim();
  if (editorCommand.length === 0) {
    throw new Error("No editor configured (set $EDITOR).");
  }
  const editorArgs = editorCommand.split(/\s+/);
  const mkdtempImpl = args.mkdtempDir ?? ((prefix) => mkdtemp(prefix));
  const writeImpl = args.writeFileImpl ?? ((path, data) => writeFile(path, data, "utf8"));
  const cleanupImpl = args.cleanup ?? ((dir) => rm(dir, { recursive: true, force: true }));

  const dir = await mkdtempImpl(join(tmpdir(), "jif-edit-"));
  const filePath = join(dir, args.filename ?? "notification.txt");
  await writeImpl(filePath, args.text);
  try {
    await args.runInteractive(dir, [...editorArgs, filePath]);
  } finally {
    await cleanupImpl(dir);
  }
}
