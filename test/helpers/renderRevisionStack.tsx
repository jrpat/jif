import { For } from "solid-js";
import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { createAppStore } from "../../src/state/appStore.ts";
import type { RevisionSummary } from "../../src/domain/types.ts";
import { RevisionItem } from "../../src/ui/render.tsx";
import type { AppLayout } from "../../src/domain/types.ts";

function createRevision(
  revisionId: string,
  description: string,
  graphRows: readonly string[],
): RevisionSummary {
  return {
    revisionId,
    changeIdPrefixLength: 2,
    commitId: `${revisionId.replace("/", "")}commit`,
    description,
    localTimestamp: "2026-04-15 12:00:00",
    bookmarks: [],
    workspaces: [],
    graphRows,
    isEmpty: false,
    hasConflict: false,
    marker: "plain",
    filesLoaded: false,
    files: [],
  };
}

async function renderRevisionStack(
  layout: AppLayout,
  focusedRevisionId: string | null,
  expandedRevisionId: string | null = null,
) {
  const revisions = [
    createRevision("prev", "above", ["│ ○  ", "│ │  "]),
    createRevision("curr", "branch", ["│ ○  ", "├─╯  "]),
    createRevision("next", "below", ["○  ", "│  "]),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });
  if (expandedRevisionId === "curr") {
    store.actions.setRevisionFiles("curr", [{ status: "M", path: "src/layout.ts" }]);
  }

  const rendered = await testRender(() => (
    <box width={32} flexDirection="column">
      <For each={store.state.revisions}>
        {(revision, index) => (
          <RevisionItem
            state={store.state}
            revision={revision}
            index={index()}
            previousRevisionId={store.state.revisions[index() - 1]?.revisionId ?? null}
            nextRevisionId={store.state.revisions[index() + 1]?.revisionId ?? null}
            config={resolveAppConfig({ commands: { layout } })}
            focusedRevisionId={focusedRevisionId}
            selectedRevisionIds={new Set()}
            expandedRevisionId={expandedRevisionId}
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

async function renderLayoutCycleAfterMount() {
  const revisions = [
    createRevision("curr", "branch", ["│ ○  ", "├─╯  "]),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout: "condensed" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });

  const rendered = await testRender(() => (
    <box width={32} flexDirection="column">
      <RevisionItem
        state={store.state}
        revision={store.state.revisions[0]!}
        index={0}
        previousRevisionId={null}
        nextRevisionId={null}
        config={resolveAppConfig({ commands: { layout: "condensed" } })}
        focusedRevisionId="curr"
        selectedRevisionIds={new Set()}
        expandedRevisionId={null}
        commandTargetId={null}
        searchQuery=""
      />
    </box>
  ), { width: 32, height: 6 });

  await rendered.renderOnce();
  store.actions.cycleLayout();
  await rendered.renderOnce();
  const frame = rendered.captureCharFrame();
  rendered.renderer.destroy();
  return frame;
}

async function renderLongSuperCondensedDescription() {
  const revisions = [
    createRevision(
      "curr",
      "this is a very long commit message that should truncate instead of wrapping onto a second line",
      ["○  "],
    ),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout: "super-condensed" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });

  const rendered = await testRender(() => (
    <box width={24} flexDirection="column">
      <RevisionItem
        state={store.state}
        revision={store.state.revisions[0]!}
        index={0}
        previousRevisionId={null}
        nextRevisionId={null}
        config={resolveAppConfig({ commands: { layout: "super-condensed" } })}
        focusedRevisionId="curr"
        selectedRevisionIds={new Set()}
        expandedRevisionId={null}
        commandTargetId={null}
        searchQuery=""
      />
    </box>
  ), { width: 24, height: 4 });

  await rendered.renderOnce();
  const frame = rendered.captureCharFrame();
  rendered.renderer.destroy();
  return frame;
}

async function renderDivergentFocusedRevision() {
  const revisions = [
    createRevision("shared/0", "older divergent", ["│ ○  ", "│ │  "]),
    createRevision("shared/1", "focused divergent", ["│ ○  ", "├─╯  "]),
    createRevision("next", "below", ["○  ", "│  "]),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout: "condensed" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });

  const rendered = await testRender(() => (
    <box width={32} flexDirection="column">
      <For each={store.state.revisions}>
        {(revision, index) => (
          <RevisionItem
            state={store.state}
            revision={revision}
            index={index()}
            previousRevisionId={store.state.revisions[index() - 1]?.revisionId ?? null}
            nextRevisionId={store.state.revisions[index() + 1]?.revisionId ?? null}
            config={resolveAppConfig({ commands: { layout: "condensed" } })}
            focusedRevisionId="shared/1"
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

const condensedUnfocused = await renderRevisionStack("condensed", null);
const condensedFocused = await renderRevisionStack("condensed", "curr");
const superCondensed = await renderRevisionStack("super-condensed", "curr");
const superCondensedExpanded = await renderRevisionStack("super-condensed", "curr", "curr");
const cycledToSuperCondensed = await renderLayoutCycleAfterMount();
const longSuperCondensed = await renderLongSuperCondensedDescription();
const divergentFocused = await renderDivergentFocusedRevision();

console.log(JSON.stringify({
  condensedUnfocused,
  condensedFocused,
  superCondensed,
  superCondensedExpanded,
  cycledToSuperCondensed,
  longSuperCondensed,
  divergentFocused,
}));
