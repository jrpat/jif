import { readFile, readdir, stat } from "node:fs/promises";
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

// Reading the repository normally when several operation heads exist makes jj
// reconcile them and write a new operation. Passive jif reads instead load one
// concrete head. Prefer the newest head file so the view tracks the most recent
// observable operation without joining a thundering herd of reconcilers.
export async function resolveLatestOpHeadId(workspaceRoot: string): Promise<string | null> {
  const headsPath = await resolveOpHeadsPath(workspaceRoot);
  if (!headsPath) {
    return null;
  }

  let headIds: string[];
  try {
    headIds = await readdir(headsPath);
  } catch {
    return null;
  }
  if (headIds.length === 0) {
    return null;
  }
  if (headIds.length === 1) {
    return headIds[0]!;
  }

  const headsByModifiedTime = await Promise.all(headIds.map(async (headId) => {
    try {
      return { headId, modifiedAt: (await stat(join(headsPath, headId))).mtimeMs };
    } catch {
      return null;
    }
  }));
  const survivingHeads = headsByModifiedTime
    .filter((head): head is NonNullable<typeof head> => head !== null)
    .sort((left, right) =>
      right.modifiedAt - left.modifiedAt || right.headId.localeCompare(left.headId)
    );

  return survivingHeads[0]?.headId ?? null;
}
