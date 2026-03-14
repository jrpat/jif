import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { SampleRepoMaterialization } from "../domain/types.ts";
import { runCommand } from "../jj/process.ts";

const DEFAULT_FIXTURE = resolve("test/fixtures/sample-repo.jsonl");

type JsonlOperation =
  | Readonly<{
      kind: "writeFile";
      workspace?: string;
      path: string;
      content: string;
    }>
  | Readonly<{
      kind: "appendFile";
      workspace?: string;
      path: string;
      content: string;
    }>
  | Readonly<{
      kind: "mkdir";
      workspace?: string;
      path: string;
    }>
  | Readonly<{
      kind: "jj";
      workspace?: string;
      args: readonly string[];
    }>
  | Readonly<{
      kind: "workspaceAdd";
      workspace?: string;
      name: string;
      destination: string;
      revision?: string;
      message?: string;
    }>;

export async function materializeSampleRepo(options?: {
  baseDir?: string;
  fixturePath?: string;
}): Promise<SampleRepoMaterialization> {
  const baseDir =
    options?.baseDir ?? (await mktempDir(join(process.cwd(), ".tmp"), "sample-repo-"));
  const fixturePath = options?.fixturePath ?? DEFAULT_FIXTURE;
  const repoPath = join(baseDir, "repo");

  await mkdir(baseDir, { recursive: true });
  await runCommand(baseDir, ["jj", "git", "init", "repo"]);

  const workspacePaths = new Map<string, string>([["default", repoPath]]);
  const operations = await loadOperations(fixturePath);

  for (const operation of operations) {
    const workspace = workspacePaths.get(operation.workspace ?? "default");
    if (!workspace) {
      throw new Error(`Unknown workspace: ${operation.workspace ?? "default"}`);
    }

    switch (operation.kind) {
      case "mkdir": {
        await mkdir(join(workspace, operation.path), { recursive: true });
        break;
      }
      case "writeFile": {
        const targetPath = join(workspace, operation.path);
        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, operation.content, "utf8");
        break;
      }
      case "appendFile": {
        const targetPath = join(workspace, operation.path);
        await mkdir(dirname(targetPath), { recursive: true });
        let current = "";
        try {
          current = await readFile(targetPath, "utf8");
        } catch {
          current = "";
        }
        await writeFile(targetPath, `${current}${operation.content}`, "utf8");
        break;
      }
      case "jj": {
        await runCommand(workspace, ["jj", ...operation.args]);
        break;
      }
      case "workspaceAdd": {
        const destinationPath = join(baseDir, operation.destination);
        const args = [
          "jj",
          "workspace",
          "add",
          destinationPath,
          "--name",
          operation.name,
        ];
        if (operation.revision) {
          args.push("--revision", operation.revision);
        }
        if (operation.message) {
          args.push("--message", operation.message);
        }
        await runCommand(workspace, args);
        workspacePaths.set(operation.name, destinationPath);
        break;
      }
    }
  }

  return {
    repoPath,
    workspacePaths: Object.freeze(Object.fromEntries(workspacePaths)),
  };
}

async function loadOperations(path: string): Promise<readonly JsonlOperation[]> {
  const content = await readFile(path, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as JsonlOperation);
}

async function mktempDir(parentDir: string, prefix: string): Promise<string> {
  await mkdir(parentDir, { recursive: true });
  return await Bun.$`mktemp -d ${join(parentDir, `${prefix}XXXXXX`)}`.text().then((value) => value.trim());
}
