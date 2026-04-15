import { For } from "solid-js";
import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { createAppStore } from "../../src/state/appStore.ts";
import type { RevisionSummary } from "../../src/domain/types.ts";
import { RevisionItem } from "../../src/ui/render.tsx";

function createRevision(
  changeId: string,
  description: string,
  graphRows: readonly string[],
): RevisionSummary {
  return {
    changeId,
    changeIdPrefixLength: 2,
    commitId: `${changeId}commit`,
    description,
    localTimestamp: "2026-04-15 12:00:00",
    bookmarks: [],
    workspaces: [],
    graphRows,
    isEmpty: false,
    marker: "plain",
    filesLoaded: false,
    files: [],
  };
}

async function renderRevisionStack(focusedRevisionId: string | null) {
  const revisions = [
    createRevision("prev", "above", ["│ ○  ", "│ │  "]),
    createRevision("curr", "branch", ["│ ○  ", "├─╯  "]),
    createRevision("next", "below", ["○  ", "│  "]),
  ] as const;
  const store = createAppStore("/tmp/repo", { condensedLayout: true });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });

  const rendered = await testRender(() => (
    <box width={32} flexDirection="column">
      <For each={revisions}>
        {(revision, index) => (
          <RevisionItem
            state={store.state}
            revision={revision}
            index={index()}
            previousRevisionId={revisions[index() - 1]?.changeId ?? null}
            nextRevisionId={revisions[index() + 1]?.changeId ?? null}
            config={resolveAppConfig({ commands: { condensedLayout: true } })}
            focusedRevisionId={focusedRevisionId}
            selectedRevisionIds={new Set()}
            expandedRevisionId={null}
            commandTargetId={null}
            searchQuery=""
          />
        )}
      </For>
    </box>
  ), { width: 32, height: 12 });

  await rendered.renderOnce();
  const frame = rendered.captureCharFrame();
  rendered.renderer.destroy();
  return frame;
}

const unfocused = await renderRevisionStack(null);
const focused = await renderRevisionStack("curr");

console.log(JSON.stringify({ unfocused, focused }));
