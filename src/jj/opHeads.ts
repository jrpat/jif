import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

// Every jj operation rewrites the files in `<repo>/op_heads/heads`, which
// makes that directory a reliable filesystem signal that the repository
// changed. In a primary workspace `.jj/repo` is the repo directory itself;
// workspaces created with `jj workspace add` store a pointer file there
// containing the path to the main repo directory.
export async function resolveOpHeadsPath(workspaceRoot: string): Promise<string | null> {
  const repoMarker = join(workspaceRoot, ".jj", "repo");

  let repoDir: string;
  try {
    const marker = await stat(repoMarker);
    if (marker.isDirectory()) {
      repoDir = repoMarker;
    } else {
      const pointer = (await readFile(repoMarker, "utf8")).trim();
      if (!pointer) {
        return null;
      }
      repoDir = isAbsolute(pointer) ? pointer : resolve(join(workspaceRoot, ".jj"), pointer);
    }
  } catch {
    return null;
  }

  const headsPath = join(repoDir, "op_heads", "heads");
  try {
    return (await stat(headsPath)).isDirectory() ? headsPath : null;
  } catch {
    return null;
  }
}
